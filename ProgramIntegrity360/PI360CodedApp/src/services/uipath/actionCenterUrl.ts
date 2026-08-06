export type ActionCenterTaskUrlOptions = {
  portalOrigin: string;
  organizationName: string;
  tenantName: string;
  taskId: number;
};

function requiredSegment(name: string, value: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`${name} is required to build an Action Center task URL.`);
  }

  return encodeURIComponent(normalized);
}

export function buildActionCenterTaskUrl({
  portalOrigin,
  organizationName,
  tenantName,
  taskId,
}: ActionCenterTaskUrlOptions): string {
  if (!Number.isSafeInteger(taskId) || taskId < 0) {
    throw new Error('taskId must be a non-negative integer.');
  }

  const origin = new URL(portalOrigin).origin;
  const organization = requiredSegment('organizationName', organizationName);
  const tenant = requiredSegment('tenantName', tenantName);

  return `${origin}/${organization}/${tenant}/actions_/tasks/${taskId}`;
}
