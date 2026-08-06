import type { UiPathSDKConfig } from '@uipath/uipath-typescript/core';

type UiPathDefaults = {
  clientId?: string;
  orgName?: string;
  tenantName?: string;
  baseUrl?: string;
  redirectUri?: string;
  scope?: string;
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

function getPlatformBaseUrl(): string {
  return readValue(
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

function getRedirectUri(): string {
  if (import.meta.env.DEV) {
    return window.location.origin;
  }

  return readValue(
    import.meta.env.VITE_UIPATH_REDIRECT_URI,
    runtimeDefaults.redirectUri,
    window.location.origin,
  );
}

export type UiPathAuthSetup = {
  config: UiPathSDKConfig;
  platformBaseUrl: string;
  missingFields: string[];
};

export function getUiPathAuthSetup(): UiPathAuthSetup {
  const platformBaseUrl = getPlatformBaseUrl();
  const clientId = readValue(
    import.meta.env.VITE_UIPATH_CLIENT_ID,
    runtimeDefaults.clientId,
  );
  const orgName = readValue(
    import.meta.env.VITE_UIPATH_ORG_NAME,
    runtimeDefaults.orgName,
  );
  const tenantName = readValue(
    import.meta.env.VITE_UIPATH_TENANT_NAME,
    runtimeDefaults.tenantName,
  );
  const redirectUri = getRedirectUri();
  const scope = readValue(
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

export function getUiPathConfigurationError(missingFields: string[]): string | null {
  if (missingFields.length === 0) {
    return null;
  }

  return `Local OAuth is not configured. Set ${missingFields.join(', ')} in .env.development before logging in.`;
}
