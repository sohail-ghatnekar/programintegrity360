import type { UiPathSDKConfig } from '@uipath/uipath-typescript/core';

type UiPathDefaults = {
  clientId?: string;
  orgName?: string;
  tenantName?: string;
  baseUrl?: string;
  redirectUri?: string;
  scope?: string;
  folderPath?: string;
  folderKey?: string;
  folderId?: number;
  caseProcessName?: string;
  recordAgentName?: string;
};

declare const __UIPATH_DEFAULTS__: UiPathDefaults;

const runtimeDefaults: UiPathDefaults =
  typeof __UIPATH_DEFAULTS__ === 'undefined' ? {} : __UIPATH_DEFAULTS__;

function readValue(...values: Array<string | undefined>): string {
  for (const value of values) {
    const normalized = value?.trim();
    if (normalized) {
      return normalized;
    }
  }

  return '';
}

function getPlatformBaseUrl(overrides: UiPathDefaults): string {
  return readValue(
    overrides.baseUrl,
    import.meta.env.VITE_UIPATH_BASE_URL,
    runtimeDefaults.baseUrl,
  );
}

function getAppBaseUrl(platformBaseUrl: string): string {
  if (import.meta.env.DEV && platformBaseUrl) {
    return window.location.origin;
  }

  return platformBaseUrl || window.location.origin;
}

function getRedirectUri(overrides: UiPathDefaults): string {
  if (import.meta.env.DEV) {
    return window.location.origin;
  }

  return readValue(
    overrides.redirectUri,
    import.meta.env.VITE_UIPATH_REDIRECT_URI,
    runtimeDefaults.redirectUri,
    window.location.origin,
  );
}

function readNumber(...values: Array<number | undefined>): number | null {
  return values.find((value) => Number.isFinite(value)) ?? null;
}

export type UiPathAuthSetup = {
  config: UiPathSDKConfig;
  platformBaseUrl: string;
  missingFields: string[];
};

export type UiPathRuntimeConfig = UiPathAuthSetup & {
  folderPath: string;
  folderKey: string;
  folderId: number | null;
  caseProcessName: string;
  recordAgentName: string;
};

export function getUiPathAuthSetup(overrides: UiPathDefaults = {}): UiPathAuthSetup {
  const platformBaseUrl = getPlatformBaseUrl(overrides);
  const clientId = readValue(
    overrides.clientId,
    import.meta.env.VITE_UIPATH_CLIENT_ID,
    runtimeDefaults.clientId,
  );
  const orgName = readValue(
    overrides.orgName,
    import.meta.env.VITE_UIPATH_ORG_NAME,
    runtimeDefaults.orgName,
  );
  const tenantName = readValue(
    overrides.tenantName,
    import.meta.env.VITE_UIPATH_TENANT_NAME,
    runtimeDefaults.tenantName,
  );
  const redirectUri = getRedirectUri(overrides);
  const scope = readValue(
    overrides.scope,
    import.meta.env.VITE_UIPATH_SCOPE,
    import.meta.env.VITE_UIPATH_SCOPES,
    runtimeDefaults.scope,
  );

  const missingFields = [
    !clientId && 'VITE_UIPATH_CLIENT_ID',
    !orgName && 'VITE_UIPATH_ORG_NAME',
    !tenantName && 'VITE_UIPATH_TENANT_NAME',
    !platformBaseUrl && 'VITE_UIPATH_BASE_URL',
    !import.meta.env.DEV && !redirectUri && 'VITE_UIPATH_REDIRECT_URI',
    !scope && 'VITE_UIPATH_SCOPE',
  ].filter(Boolean) as string[];

  return {
    config: {
      clientId,
      orgName,
      tenantName,
      baseUrl: getAppBaseUrl(platformBaseUrl),
      redirectUri,
      scope,
    },
    platformBaseUrl,
    missingFields,
  };
}

export function getUiPathRuntimeConfig(overrides: UiPathDefaults = {}): UiPathRuntimeConfig {
  return {
    ...getUiPathAuthSetup(overrides),
    folderPath: readValue(overrides.folderPath, runtimeDefaults.folderPath),
    folderKey: readValue(overrides.folderKey, runtimeDefaults.folderKey),
    folderId: readNumber(overrides.folderId, runtimeDefaults.folderId),
    caseProcessName: readValue(overrides.caseProcessName, runtimeDefaults.caseProcessName),
    recordAgentName: readValue(overrides.recordAgentName, runtimeDefaults.recordAgentName),
  };
}

export function getUiPathConfigurationError(missingFields: string[]): string | null {
  if (missingFields.length === 0) {
    return null;
  }

  return `Local OAuth is not configured. Set ${missingFields.join(', ')} in .env.development before logging in.`;
}
