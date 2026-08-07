// Step 1c: seed records from data/*.json. Maps display labels -> choice NumberIds; serializes nested JSON.
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const DATA = path.resolve(__dirname, '..', 'data');
const CS = JSON.parse(fs.readFileSync(path.join(__dirname, 'cloud-playground-choiceset-ids.json'), 'utf8'));
const ENT = JSON.parse(fs.readFileSync(path.join(__dirname, 'cloud-playground-entity-ids.json'), 'utf8'));

function uip(args) {
  const raw = execFileSync('uip', [...args, '--output', 'json'], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  const j = JSON.parse(raw);
  if (j.Result && j.Result !== 'Success') throw new Error('FAILED: uip ' + args.slice(0,4).join(' ') + '\n' + JSON.stringify(j));
  return j;
}
function mapChoice(setName, label) {
  const m = CS[setName].byDisplay;
  if (!(label in m)) throw new Error(`No NumberId for "${label}" in ${setName}. Have: ${Object.keys(m).join(', ')}`);
  return m[label];
}

const CFG = [
  ['PI360ProgramIntegrityCase','cases.json', {priority:'PI360Priority',stage:'PI360CaseStage',status:'PI360CaseStatus'}, []],
  ['PI360Provider','providers.json', {}, []],
  ['PI360Attendant','attendants.json', {}, ['missing_docs']],
  ['PI360Claim','claims.json', {status:'PI360ClaimStatus'}, []],
  ['PI360EvvVisit','evv_visits.json', {capture_method:'PI360CaptureMethod',gps_confirmed:'PI360GpsConfirmed'}, []],
  ['PI360RiskSignal','risk_signals.json', {severity:'PI360Priority'}, ['inputs']],
  ['PI360EvidenceDocument','evidence_documents.json', {doc_type:'PI360DocType',validation_status:'PI360ValidationStatus'}, ['extracted_fields']],
  ['PI360InvestigationAction','investigation_actions.json', {actor_kind:'PI360ActorKind'}, ['before_value','after_value']],
  ['PI360Decision','decisions.json', {decision_role:'PI360DecisionRole'}, []],
];

for (const [ename, file, choices, jsonFields] of CFG) {
  const rows = JSON.parse(fs.readFileSync(`${DATA}/${file}`, 'utf8'));
  const out = rows.map(r => {
    const rec = {};
    for (const [k, v] of Object.entries(r)) {
      if (v === null || v === undefined) continue;
      if (k in choices) { rec[k] = mapChoice(choices[k], v); continue; }
      if (jsonFields.includes(k)) { rec[k] = (typeof v === 'string') ? v : JSON.stringify(v); continue; }
      rec[k] = v;
    }
    return rec;
  });
  const eid = ENT[ename];
  const r = uip(['df','records','insert', eid, '--body', JSON.stringify(out)]);
  const n = Array.isArray(r.Data) ? r.Data.length : (r.Data && r.Data.length) || out.length;
  console.log(`seeded ${ename}: ${out.length} rows (resp ok)`);
}
console.log('\nSEED COMPLETE');
