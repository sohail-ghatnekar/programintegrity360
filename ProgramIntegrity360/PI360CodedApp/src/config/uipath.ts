import type { UiPathSDKConfig } from '@uipath/uipath-typescript/core';

type UiPathAuthDefaults = {
  clientId?: string;
  orgName?: string;
  tenantName?: string;
  baseUrl?: string;
  redirectUri?: string;
  scope?: string;
};

type UiPathRuntimeDefaults = {
  folderPath?: string;
  folderKey?: string;
  folderId?: number;
  caseProcessName?: string;
  recordAgentName?: string;
};

declare const __PI360_RUNTIME_DEFAULTS__: UiPathRuntimeDefaults;

const runtimeDefaults: UiPathRuntimeDefaults =
  typeof __PI360_RUNTIME_DEFAULTS__ === 'undefined' ? {} : __PI360_RUNTIME_DEFAULTS__;

const metadataNames = {
  clientId: 'uipath:client-id',
  scope: 'uipath:scope',
  orgName: 'uipath:org-name',
  tenantName: 'uipath:tenant-name',
  baseUrl: 'uipath:base-url',
  redirectUri: 'uipath:redirect-uri',
} as const;

function readValue(...values: Array<string | undefined>): string {
  for (const value of values) {
    const normalized = value?.trim();
    if (normalized) {
      return normalized;
    }
  }

  return '';
}

function readRuntimeMetadata(name: string): string | undefined {
  return document.querySelector<HTMLMetaElement>(`meta[name="${name}"]`)?.content;
}

function readLocalEnvironment(value: string | undefined): string | undefined {
  return import.meta.env.DEV ? value : undefined;
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

export function getUiPathAuthSetup(overrides: UiPathAuthDefaults = {}): UiPathAuthSetup {
  const clientId = readValue(
    overrides.clientId,
    readRuntimeMetadata(metadataNames.clientId),
    readLocalEnvironment(import.meta.env.VITE_UIPATH_CLIENT_ID),
  );
  const orgName = readValue(
    overrides.orgName,
    readRuntimeMetadata(metadataNames.orgName),
    readLocalEnvironment(import.meta.env.VITE_UIPATH_ORG_NAME),
  );
  const tenantName = readValue(
    overrides.tenantName,
    readRuntimeMetadata(metadataNames.tenantName),
    readLocalEnvironment(import.meta.env.VITE_UIPATH_TENANT_NAME),
  );
  const platformBaseUrl = readValue(
    overrides.baseUrl,
    readRuntimeMetadata(metadataNames.baseUrl),
    readLocalEnvironment(import.meta.env.VITE_UIPATH_BASE_URL),
  );
  const redirectUri = readValue(
    overrides.redirectUri,
    readRuntimeMetadata(metadataNames.redirectUri),
    readLocalEnvironment(import.meta.env.VITE_UIPATH_REDIRECT_URI),
  );
  const scope = readValue(
    overrides.scope,
    readRuntimeMetadata(metadataNames.scope),
    readLocalEnvironment(import.meta.env.VITE_UIPATH_SCOPE),
    readLocalEnvironment(import.meta.env.VITE_UIPATH_SCOPES),
  );

  const missingFields = [
    !clientId && 'VITE_UIPATH_CLIENT_ID',
    !orgName && 'VITE_UIPATH_ORG_NAME',
    !tenantName && 'VITE_UIPATH_TENANT_NAME',
    !platformBaseUrl && 'VITE_UIPATH_BASE_URL',
    !redirectUri && 'VITE_UIPATH_REDIRECT_URI',
    !scope && 'VITE_UIPATH_SCOPE',
  ].filter(Boolean) as string[];

  return {
    config: {
      clientId,
      orgName,
      tenantName,
      baseUrl: platformBaseUrl,
      redirectUri,
      scope,
    },
    platformBaseUrl,
    missingFields,
  };
}

export function getUiPathRuntimeConfig(overrides: UiPathAuthDefaults & UiPathRuntimeDefaults = {}): UiPathRuntimeConfig {
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
