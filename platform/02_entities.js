// Step 1b: create the 9 PI360 entities (tenant level), wired to choice sets. Idempotent by name.
const { execFileSync } = require('child_process');
const fs = require('fs');
const DIR = '/private/tmp/claude-502/-Users-sohail-ghatnekar/eb288e80-a012-4b20-9273-d4e15126dbf6/scratchpad/pi360';
const CS = JSON.parse(fs.readFileSync(DIR + '/choicesets.json', 'utf8'));

function uip(args) {
  const raw = execFileSync('uip', [...args, '--output', 'json'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  const j = JSON.parse(raw);
  if (j.Result && j.Result !== 'Success') throw new Error('FAILED: uip ' + args.join(' ') + '\n' + JSON.stringify(j));
  return j;
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
    key('case_id'), S('title',{lengthLimit:400}), S('program'), S('trigger_type'), S('trigger_ref'),
    S('provider_id'), S('attendant_id'), D('service_period_start'), D('service_period_end'),
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
    key('claim_id'), S('case_id'), S('attendant_id'), S('member_id'), D('date_of_service'),
    N('units_billed'), N('unit_rate',2), N('billed_amount',2), N('evv_supported_units'),
    N('timesheet_supported_units'), N('poc_daily_units'), N('improper_units'),
    C('status','PI360ClaimStatus'), S('notes',{lengthLimit:1000}), S('method_flag')
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
    C('validation_status','PI360ValidationStatus'), S('validated_by'), S('note',{lengthLimit:1000})
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

const existing = uip(['df','entities','list','--native-only']).Data || [];
const byName = {}; for (const e of existing) byName[e.Name] = e.Id;

const out = {};
for (const [name, disp, fields] of ENTITIES) {
  if (byName[name]) { out[name] = byName[name]; console.log('reuse entity', name, byName[name]); continue; }
  const body = JSON.stringify({ displayName: disp, description: 'Program Integrity 360 demo (synthetic data).', fields });
  const r = uip(['df','entities','create', name, '--body', body]);
  out[name] = r.Data.Id;
  console.log('created entity', name, r.Data.Id);
}
fs.writeFileSync(DIR + '/entities.json', JSON.stringify(out, null, 2));
console.log('\nWROTE entities.json'); console.log(JSON.stringify(out, null, 2));
