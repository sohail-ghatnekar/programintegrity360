import { createDemoCaseWorkspace as createWorkspaceSnapshot } from './demoCase';
import type { CaseRepository, CaseWorkspaceSnapshot, TaskRefreshSnapshot } from './types';

export function createDemoCaseWorkspace(): CaseWorkspaceSnapshot {
  return createWorkspaceSnapshot();
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

  async refreshTasks(caseId: string): Promise<TaskRefreshSnapshot> {
    const workspace = await this.loadWorkspace(caseId);

    return {
      caseTasks: workspace.caseTasks,
      folderTasks: workspace.folderTasks,
    };
  }
}
