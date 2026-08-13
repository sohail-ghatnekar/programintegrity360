import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { createDemoCaseWorkspace } from './demoRepository';
import type { CaseWorkspaceSnapshot } from './types';
import { CaseOverview } from './CaseOverview';

describe('CaseOverview', () => {
  it('labels the hospice member and caregiver without presenting service evidence as EVV', () => {
    const workspace = structuredClone(createDemoCaseWorkspace()) as unknown as CaseWorkspaceSnapshot;
    Object.assign(workspace.case, {
      caseType: 'StateMedicaidHospice',
      memberId: 'MBR-071426',
      memberName: 'Jordan Ellis',
      program: 'State Medicaid Hospice',
    });
    Object.assign(workspace.attendant, {
      name: 'Taylor Brooks',
      id: 'ATT-HSP-4401',
      role: 'Hospice Caregiver',
    });

    render(<CaseOverview workspace={workspace} role="investigator" />);

    expect(screen.getByText('Member')).toBeInTheDocument();
    expect(screen.getByText('Jordan Ellis')).toBeInTheDocument();
    expect(screen.getByText('MBR-071426')).toBeInTheDocument();
    expect(screen.getByText('Caregiver')).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Service record' })).toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: 'EVV' })).not.toBeInTheDocument();
  });
});
