import type { CaseStageDefinition } from './types';

export const STAGE_DEFINITIONS: CaseStageDefinition[] = [
  { key: 'intake', label: 'Intake', description: 'Alert intake and case setup.' },
  { key: 'evidence', label: 'Evidence', description: 'Evidence collection and extraction.' },
  { key: 'investigation', label: 'Investigation', description: 'Investigator review and correlation.' },
  { key: 'provider-response', label: 'Provider Response', description: 'Provider records request and response review.' },
  { key: 'supervisor-review', label: 'Supervisor Review', description: 'Supervisor disposition and approval.' },
  { key: 'closure', label: 'Closure', description: 'Case closure and final record.' },
];
