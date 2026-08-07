// Step 1a: create PI360 choice sets + values (tenant level), then re-read authoritative NumberId maps.
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const OUT = path.join(__dirname, 'cloud-playground-choiceset-ids.json');

function uip(args) {
  const cmd = 'uip ' + args + ' --output json';
  const raw = execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  const j = JSON.parse(raw);
  if (j.Result && j.Result !== 'Success') throw new Error('FAILED: ' + cmd + '\n' + JSON.stringify(j));
  return j;
}
function q(s){ return '"' + String(s).replace(/"/g,'\\"') + '"'; }

// [systemName, displayName, description, [ [valueName, valueDisplay], ... ] ]
const SETS = [
  ['PI360Priority','PI360 Priority','Case priority / signal severity (shared High/Medium/Low)',
    [['high','High'],['medium','Medium'],['low','Low']]],
  ['PI360CaseStage','PI360 Case Stage',null,
    [['alert_intake_triage','Alert intake and triage'],
     ['automated_evidence_collection','Automated evidence collection'],
     ['document_extraction_validation','Document extraction and validation'],
     ['evidence_correlation_planning','Evidence correlation and investigation planning'],
     ['investigator_human_review','Investigator human review'],
     ['provider_records_request','Provider records request and wait state'],
     ['supervisor_approval_disposition','Supervisor approval / disposition'],
     ['approved_action_execution','Approved action execution'],
     ['closure_monitoring','Closure and monitoring']]],
  ['PI360CaseStatus','PI360 Case Status',null,
    [['open','Open'],['in_review','In Review'],['awaiting_provider','Awaiting Provider'],
     ['pending_approval','Pending Approval'],['closed','Closed']]],
  ['PI360CaptureMethod','PI360 EVV Capture Method',null,
    [['mobile_gps','Mobile-GPS'],['telephony','Telephony'],['manual','Manual']]],
  ['PI360GpsConfirmed','PI360 GPS Confirmed',null,
    [['yes','Yes'],['no','No'],['na','N/A']]],
  ['PI360ClaimStatus','PI360 Claim Status',null,
    [['under_review','Under Review'],['cleared','Cleared'],['flagged','Flagged']]],
  ['PI360DocType','PI360 Evidence Document Type',null,
    [['timesheet','Timesheet'],['plan_of_care','Plan of Care'],['service_note','Service Note'],
     ['personnel_packet','Personnel Packet'],['correspondence','Correspondence']]],
  ['PI360ValidationStatus','PI360 Validation Status',null,
    [['auto_confirmed','Auto-confirmed'],['needs_review','Needs review'],['human_validated','Human-validated']]],
  ['PI360ActorKind','PI360 Actor Kind',null,
    [['human','Human'],['system','System'],['agent','Agent']]],
  ['PI360DecisionRole','PI360 Decision Role',null,
    [['investigator','Investigator'],['supervisor','Supervisor']]],
];

// existing PI360 sets (reuse on re-run)
const existing = uip('df choice-sets list').Data || [];
const byName = {};
for (const cs of existing) byName[cs.Name] = cs.Id;

const result = {};
for (const [name, disp, desc, values] of SETS) {
  let id = byName[name];
  if (id) { console.log('reuse set', name, id); }
  else {
    const descriptionArg = desc ? ` --description ${q(desc)}` : '';
    const r = uip(`df choice-sets create ${name} --display-name ${q(disp)}${descriptionArg}`);
    id = r.Data.Id;
    console.log('created set', name, id);
  }
  // existing values
  const lvRaw = uip(`df choice-sets list-values ${id} --limit 100`).Data;
  const items = lvRaw.Items || lvRaw || [];
  const existingVals = {};
  for (const v of items) existingVals[v.Name] = v;
  for (const [vn, vd] of values) {
    if (existingVals[vn]) { console.log('  reuse val', name, vn); continue; }
    uip(`df choice-set-values create ${id} ${vn} --display-name ${q(vd)}`);
    console.log('  created val', name, vn);
  }
  result[name] = { id, byDisplay: {}, byName: {} };
}

// authoritative re-read of NumberIds
for (const name of Object.keys(result)) {
  const id = result[name].id;
  const lvRaw = uip(`df choice-sets list-values ${id} --limit 100`).Data;
  const items = lvRaw.Items || lvRaw || [];
  for (const v of items) {
    result[name].byName[v.Name] = v.NumberId;
    result[name].byDisplay[v.DisplayName] = v.NumberId;
  }
}
fs.writeFileSync(OUT, JSON.stringify(result, null, 2));
console.log('\nWROTE', OUT);
console.log(JSON.stringify(Object.fromEntries(Object.entries(result).map(([k,v])=>[k,{id:v.id,vals:v.byDisplay}])), null, 2));
