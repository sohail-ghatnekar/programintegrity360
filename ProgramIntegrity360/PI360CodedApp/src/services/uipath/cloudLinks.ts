export const DEFAULT_UIPATH_PORTAL_ORIGIN = 'https://cloud.uipath.com';

export function portalOriginFromApiBase(apiBaseUrl?: string): string {
  if (!apiBaseUrl) {
    return DEFAULT_UIPATH_PORTAL_ORIGIN;
  }

  try {
    const url = new URL(apiBaseUrl);
    if (url.hostname === 'api.uipath.com') {
      return DEFAULT_UIPATH_PORTAL_ORIGIN;
    }

    url.hostname = url.hostname.replace('.api.', '.');
    return url.origin;
  } catch {
    return DEFAULT_UIPATH_PORTAL_ORIGIN;
  }
}

type MaestroProcessUrlOptions = {
  folderKey: string;
  instanceKey: string;
  organizationName: string;
  portalOrigin?: string;
  processKey: string;
  tenantName: string;
};

export function buildMaestroProcessUrl({
  folderKey,
  instanceKey,
  organizationName,
  portalOrigin = DEFAULT_UIPATH_PORTAL_ORIGIN,
  processKey,
  tenantName,
}: MaestroProcessUrlOptions): string {
  const origin = new URL(portalOrigin).origin;
  const path = [
    organizationName,
    tenantName,
    'maestro_',
    'processes',
    processKey,
    'instances',
    instanceKey,
  ].map((segment) => encodeURIComponent(segment.trim())).join('/');
  const url = new URL(`${origin}/${path}`);
  url.searchParams.set('folderKey', folderKey);
  return url.toString();
}
