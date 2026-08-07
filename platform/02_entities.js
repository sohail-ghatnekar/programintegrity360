// Step 1b: add missing fields to the nine existing PI360 entities.
// Playground is at its Data Fabric object cap, so the C-light model stores the
// hospice claim lines and institutional encounter on existing aggregate rows.
// This script is intentionally additive: it never removes or renames a field.
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const CHOICE_SET_IDS = path.join(__dirname, 'cloud-playground-choiceset-ids.json');
const ENTITY_IDS = path.join(__dirname, 'cloud-playground-entity-ids.json');
const CS = JSON.parse(fs.readFileSync(CHOICE_SET_IDS, 'utf8'));

function uip(args) {
  const raw = execFileSync('uip', [...args, '--output', 'json'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  const j = JSON.parse(raw);
  if (j.Result && j.Result !== 'Success') throw new Error('FAILED: uip ' + args.join(' ') + '\n' + JSON.stringify(j));
  return j;
}
function items(data) {
  if (Array.isArray(data)) return data;
  return (data && (data.Items || data.items)) || [];
}
const cs = n => CS[n].id;
const S=(fieldName,extra={})=>({fieldName,type:'STRING',...extra});
const T=(fieldName,lengthLimit=1000)=>({fieldName,type:'MULTILINE_TEXT',lengthLimit});
const N=(fieldName,decimalPrecision=0)=>({fieldName,type:'DECIMAL',decimalPrecision});
const B=(fieldName)=>({fieldName,type:'BOOLEAN'});
const D=(fieldName)=>({fieldName,type:'DATE'});
const TS=(fieldName)=>({fieldName,type:'DATETIME_WITH_TZ'});
const C=(fieldName,setName)=>({fieldName,type:'CHOICE_SET_SINGLE',choiceSetId:cs(setName)});
const key=(fieldName)=>({fieldName,type:'STRING',isRequired:true,isUnique:true});

const ENTITIES = [
  ['PI360ProgramIntegrityCase','Program Integrity Case', [
    key('case_id'), S('case_type'), S('title',{lengthLimit:400}), S('program'), S('trigger_type'), S('trigger_ref'),
    S('provider_id'), S('member_id'), S('member_name',{lengthLimit:300}), D('member_date_of_birth'),
    S('member_medicaid_id'), S('attendant_id'), S('caregiver_name',{lengthLimit:300}),
    D('service_period_start'), D('service_period_end'), N('claim_total_billed',2), N('claim_threshold',2),
    C('priority','PI360Priority'), C('stage','PI360CaseStage'), C('status','PI360CaseStatus'),
    N('risk_signal_count'), N('potential_exposure_low',2), N('potential_exposure_period_estimate',2),
    N('potential_exposure_high',2), S('exposure_disclaimer',{lengthLimit:1000}),
    S('assigned_investigator'), S('assigned_supervisor'), D('alert_date'),
    TS('opened_at'), TS('sla_due'), TS('closed_at'), S('disposition',{lengthLimit:1000}),
    TS('created_at'), TS('updated_at')
  ]],
  ['PI360Provider','Provider', [
    key('provider_id'), S('name',{lengthLimit:300}), S('medicaid_provider_id'), S('npi'),
    S('address',{lengthLimit:500}), S('enrollment_status'), N('active_attendant_count'),
    S('prior_integrity_history',{lengthLimit:1000}), B('watch_list'), S('watch_list_reason',{lengthLimit:1000})
  ]],
  ['PI360Attendant','Attendant', [
    key('attendant_id'), S('name',{lengthLimit:300}), S('provider_id'), S('role'),
    S('credential_id'), D('credential_expiry'), B('personnel_docs_complete'), S('missing_docs',{lengthLimit:1000})
  ]],
  ['PI360Claim','Claim', [
    key('claim_id'), S('case_id'), S('case_type'), S('program'), S('provider_id'),
    S('attendant_id'), S('member_id'), D('date_of_service'),
    N('units_billed'), N('unit_rate',2), N('billed_amount',2), N('evv_supported_units'),
    N('timesheet_supported_units'), N('poc_daily_units'), N('improper_units'),
    T('claim_lines_json',4000), S('flagged_line_id'), S('service_type',{lengthLimit:500}),
    S('place_of_service_code'), S('place_of_service_description',{lengthLimit:300}),
    TS('claimed_service_start_at'), TS('claimed_service_end_at'), N('unit_minutes'),
    S('source_claim_status'), C('status','PI360ClaimStatus'),
    S('notes',{lengthLimit:1000}), S('method_flag')
  ]],
  ['PI360EvvVisit','EVV Visit', [
    key('evv_id'), S('attendant_id'), S('member_id'), D('service_date'),
    S('start_time'), S('end_time'), N('units'),
    C('capture_method','PI360CaptureMethod'), C('gps_confirmed','PI360GpsConfirmed'), S('overlaps_with')
  ]],
  ['PI360RiskSignal','Risk Signal', [
    key('signal_id'), S('case_id'), S('name',{lengthLimit:300}), T('rule_expression'),
    T('inputs',4000), T('result_value'), C('severity','PI360Priority'), S('computed_by'), TS('computed_at')
  ]],
  ['PI360EvidenceDocument','Evidence Document', [
    key('doc_id'), S('case_id'), C('doc_type','PI360DocType'), S('source_system'),
    S('storage_uri',{lengthLimit:500}), T('extracted_fields',4000), N('extraction_confidence',2),
    C('validation_status','PI360ValidationStatus'), S('validated_by'), S('ixp_model',{lengthLimit:300}),
    S('ixp_model_version'), B('reference_only'), S('patient_class'), S('encounter_id'),
    S('facility_name',{lengthLimit:500}), S('care_area',{lengthLimit:500}),
    TS('encounter_arrival_at'), TS('encounter_discharge_at'), S('encounter_disposition',{lengthLimit:500}),
    S('note',{lengthLimit:1000})
  ]],
  ['PI360InvestigationAction','Investigation Action', [
    key('action_id'), S('case_id'), S('action_type'), S('actor'), C('actor_kind','PI360ActorKind'),
    TS('timestamp'), T('detail'), T('before_value',4000), T('after_value',4000)
  ]],
  ['PI360Decision','Decision', [
    key('decision_id'), S('case_id'), S('decision_type'), S('recommended_by'), S('decided_by'),
    C('decision_role','PI360DecisionRole'), T('rationale',4000), B('adverse_or_financial'), B('approved'), TS('decided_at')
  ]],
];

const existing = items(uip(['df','entities','list','--native-only']).Data);
const byName = {}; for (const entity of existing) byName[entity.Name] = entity.Id;

const out = {};
for (const [name, displayName, fields] of ENTITIES) {
  let id = byName[name];
  if (!id) {
    throw new Error(`Required existing PI360 entity is missing: ${name}. No new entities are created at the tenant cap.`);
  }
  const live = uip(['df','entities','get', id]).Data;
  const liveNames = new Set((live.Fields || []).map(field => field.Name));
  const addFields = fields.filter(field => !liveNames.has(field.fieldName));
  if (addFields.length) {
    uip(['df','entities','update', id, '--body', JSON.stringify({ addFields })]);
    console.log('extended entity', name, addFields.map(field => field.fieldName).join(', '));
  } else {
    console.log('reuse entity', name, id);
  }
  out[name] = id;
}
fs.writeFileSync(ENTITY_IDS, JSON.stringify(out, null, 2));
console.log('\nWROTE', ENTITY_IDS);
console.log(JSON.stringify(out, null, 2));
