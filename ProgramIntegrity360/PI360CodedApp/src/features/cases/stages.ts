import type { CaseStageDefinition } from './types';

export const STAGE_DEFINITIONS: CaseStageDefinition[] = [
  { key: 'intake', label: 'Alert intake and triage', description: 'Alert intake and case setup.' },
  { key: 'evidence', label: 'Evidence acquisition and validation', description: 'Evidence collection and extraction.' },
  { key: 'investigation', label: 'Investigation and case management', description: 'Investigator review and correlation.' },
  { key: 'provider-response', label: 'Provider response', description: 'Provider records request and response review.' },
  { key: 'supervisor-review', label: 'Supervisor review and approval', description: 'Supervisor disposition and approval.' },
  { key: 'closure', label: 'Closure and monitoring', description: 'Case closure and final record.' },
];
