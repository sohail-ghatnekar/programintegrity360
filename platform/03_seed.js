// Step 1c: idempotently upsert the C-light data model by each entity's natural key.
// The tenant-cap fallback consolidates hospice claim lines into one Claim row,
// member identity into the Case row, and encounter columns into the hospital EvidenceDocument row.
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const DATA = path.resolve(__dirname, '..', 'data');
const CS = JSON.parse(fs.readFileSync(path.join(__dirname, 'cloud-playground-choiceset-ids.json'), 'utf8'));
const ENT = JSON.parse(fs.readFileSync(path.join(__dirname, 'cloud-playground-entity-ids.json'), 'utf8'));

function uip(args) {
  const raw = execFileSync('uip', [...args, '--output', 'json'], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  const j = JSON.parse(raw);
  if (j.Result && j.Result !== 'Success') throw new Error('FAILED: uip ' + args.slice(0, 4).join(' ') + '\n' + JSON.stringify(j));
  return j;
}
function items(data) {
  if (Array.isArray(data)) return data;
  return (data && (data.Items || data.items)) || [];
}
function fixture(file) {
  return JSON.parse(fs.readFileSync(path.join(DATA, file), 'utf8'));
}
function mapChoice(setName, label) {
  const byDisplay = CS[setName].byDisplay || {};
  const byName = CS[setName].byName || {};
  if (label in byDisplay) return byDisplay[label];
  if (label in byName) return byName[label];
  throw new Error(`No NumberId for "${label}" in ${setName}. Have: ${Object.keys(byDisplay).join(', ')}`);
}

const hospiceClaimLines = fixture('hospice_claims.json');
const hospiceMembers = fixture('hospice_members.json');
const institutionalEncounters = fixture('institutional_encounters.json');
const memberById = new Map(hospiceMembers.map(member => [member.member_id, member]));
const encounterByDocumentId = new Map(institutionalEncounters.map(encounter => [encounter.source_document_id, encounter]));
const flaggedLine = hospiceClaimLines.find(line => line.line_id === 'LINE-0714-01');
if (!flaggedLine) throw new Error('Missing canonical hospice flagged line LINE-0714-01');

const hospiceClaimHeader = {
  claim_id: flaggedLine.claim_id,
  case_id: flaggedLine.case_id,
  case_type: flaggedLine.case_type,
  program: flaggedLine.program,
  provider_id: flaggedLine.provider_id,
  attendant_id: flaggedLine.attendant_id,
  member_id: flaggedLine.member_id,
  date_of_service: flaggedLine.date_of_service,
  units_billed: hospiceClaimLines.reduce((sum, line) => sum + line.units_billed, 0),
  unit_rate: flaggedLine.unit_rate,
  billed_amount: hospiceClaimLines.reduce((sum, line) => sum + line.billed_amount, 0),
  claim_lines_json: hospiceClaimLines,
  flagged_line_id: flaggedLine.line_id,
  service_type: flaggedLine.service_type,
  place_of_service_code: flaggedLine.place_of_service_code,
  place_of_service_description: flaggedLine.place_of_service_description,
  claimed_service_start_at: flaggedLine.claimed_service_start_at,
  claimed_service_end_at: flaggedLine.claimed_service_end_at,
  unit_minutes: flaggedLine.unit_minutes,
  source_claim_status: flaggedLine.source_claim_status,
  status: 'Flagged',
  method_flag: 'Institutional location conflict - review indicator only',
  notes: 'The July 14 claimed home-service interval overlaps an Observation encounter by 360 minutes. Human validation is required.',
};

function loadRows(file) {
  if (file === 'cases.json') {
    return fixture(file).map(row => {
      const member = memberById.get(row.member_id);
      return member ? {
        ...row,
        member_name: member.name,
        member_date_of_birth: member.date_of_birth,
        member_medicaid_id: member.medicaid_id,
      } : row;
    });
  }
  if (file === 'claims.json') {
    return [
      ...fixture(file).map(row => ({...row, case_type: 'MedicaidPCS', program: 'Medicaid PCS', provider_id: 'PRV-100482'})),
      hospiceClaimHeader,
    ];
  }
  if (file === 'evidence_documents.json') {
    return fixture(file).map(row => {
      const encounter = encounterByDocumentId.get(row.doc_id);
      if (!encounter) return row;
      return {
        ...row,
        patient_class: encounter.patient_class,
        encounter_id: encounter.encounter_id,
        facility_name: encounter.facility_name,
        care_area: encounter.care_area,
        encounter_arrival_at: encounter.arrival_at,
        encounter_discharge_at: encounter.discharge_at,
        encounter_disposition: encounter.disposition,
      };
    });
  }
  return fixture(file);
}

// [entity, fixture, naturalKey, choice fields, JSON fields]
const CFG = [
  ['PI360ProgramIntegrityCase','cases.json','case_id',
    {priority:'PI360Priority',stage:'PI360CaseStage',status:'PI360CaseStatus'}, []],
  ['PI360Provider','providers.json','provider_id', {}, []],
  ['PI360Attendant','attendants.json','attendant_id', {}, ['missing_docs']],
  ['PI360Claim','claims.json','claim_id', {status:'PI360ClaimStatus'}, ['claim_lines_json']],
  ['PI360EvvVisit','evv_visits.json','evv_id',
    {capture_method:'PI360CaptureMethod',gps_confirmed:'PI360GpsConfirmed'}, []],
  ['PI360RiskSignal','risk_signals.json','signal_id', {severity:'PI360Priority'}, ['inputs','result_value']],
  ['PI360EvidenceDocument','evidence_documents.json','doc_id',
    {doc_type:'PI360DocType',validation_status:'PI360ValidationStatus'}, ['extracted_fields']],
  ['PI360InvestigationAction','investigation_actions.json','action_id',
    {actor_kind:'PI360ActorKind'}, ['before_value','after_value']],
  ['PI360Decision','decisions.json','decision_id', {decision_role:'PI360DecisionRole'}, []],
];

function normalizeRecord(row, choices, jsonFields) {
  const record = {};
  for (const [key, value] of Object.entries(row)) {
    if (value === null || value === undefined) continue;
    if (key in choices) {
      record[key] = mapChoice(choices[key], value);
    } else if (jsonFields.includes(key)) {
      record[key] = typeof value === 'string' ? value : JSON.stringify(value);
    } else {
      record[key] = value;
    }
  }
  return record;
}

for (const [entityName, file, naturalKey, choices, jsonFields] of CFG) {
  const entityId = ENT[entityName];
  if (!entityId) throw new Error(`Missing entity ID for ${entityName}`);
  const rows = loadRows(file);
  let inserted = 0;
  let updated = 0;

  for (const row of rows) {
    const naturalValue = row[naturalKey];
    if (naturalValue === null || naturalValue === undefined) {
      throw new Error(`${entityName} row in ${file} is missing natural key ${naturalKey}`);
    }
    const query = {
      filterGroup: {
        logicalOperator: 0,
        queryFilters: [{fieldName: naturalKey, operator: '=', value: naturalValue}],
      },
      selectedFields: ['Id', naturalKey],
    };
    const matches = items(uip(['df','records','query', entityId, '--limit', '2', '--body', JSON.stringify(query)]).Data);
    if (matches.length > 1) {
      throw new Error(`${entityName} has duplicate records for ${naturalKey}=${naturalValue}`);
    }

    const record = normalizeRecord(row, choices, jsonFields);
    if (matches.length === 1) {
      uip(['df','records','update', entityId, '--body', JSON.stringify({Id: matches[0].Id, ...record})]);
      updated += 1;
    } else {
      uip(['df','records','insert', entityId, '--body', JSON.stringify(record)]);
      inserted += 1;
    }
  }
  console.log(`upserted ${entityName}: ${rows.length} rows (${inserted} inserted, ${updated} updated)`);
}
console.log('\nSEED COMPLETE');
