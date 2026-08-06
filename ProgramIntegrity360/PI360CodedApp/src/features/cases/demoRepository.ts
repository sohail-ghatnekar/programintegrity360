import { DEMO_CASE_WORKSPACE } from './demoCase';
import type { CaseRepository, CaseWorkspaceModel } from './types';

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) {
      deepFreeze(child);
    }
  }

  return value;
}

export function createDemoCaseWorkspace(): CaseWorkspaceModel {
  return deepFreeze(structuredClone(DEMO_CASE_WORKSPACE));
}

export class DemoCaseRepository implements CaseRepository {
  async listCases() {
    return [createDemoCaseWorkspace().case];
  }

  async loadWorkspace(caseId: string) {
    const workspace = createDemoCaseWorkspace();

    if (caseId !== workspace.case.id) {
      throw new Error(`Demo case not found: ${caseId}`);
    }

    return workspace;
  }

  async refreshTasks(caseId: string) {
    const workspace = await this.loadWorkspace(caseId);

    return {
      caseTasks: workspace.caseTasks,
      folderTasks: workspace.folderTasks,
    };
  }
}
