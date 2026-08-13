import { afterEach, expect, it, vi } from 'vitest';
import { getUiPathAuthSetup, getUiPathRuntimeConfig } from './uipath';

const runtimeMetadata = {
  'uipath:client-id': 'runtime-client-id',
  'uipath:scope': 'OR.Users.Read',
  'uipath:org-name': 'uipathlabs',
  'uipath:tenant-name': 'Playground',
  'uipath:base-url': 'https://staging.api.uipath.com',
  'uipath:redirect-uri': 'https://staging.uipath.com/uipathlabs/Playground/apps_/pi360',
};

function setRuntimeMetadata(values: Partial<typeof runtimeMetadata>) {
  for (const [name, content] of Object.entries(values)) {
    const meta = document.createElement('meta');
    meta.name = name;
    meta.content = content;
    document.head.append(meta);
  }
}

afterEach(() => {
  document.querySelectorAll('meta[name^="uipath:"]').forEach((meta) => meta.remove());
  vi.unstubAllEnvs();
});

it('reports missing local client ID without exposing credentials', () => {
  vi.stubEnv('VITE_UIPATH_CLIENT_ID', '');
  const setup = getUiPathAuthSetup({ clientId: '', orgName: 'uipathlabs', tenantName: 'Playground' });

  expect(setup.missingFields).toContain('VITE_UIPATH_CLIENT_ID');
  expect(JSON.stringify(setup)).not.toContain('access_token');
});

it('reads the deployed UiPath client ID from runtime metadata', () => {
  vi.stubEnv('VITE_UIPATH_CLIENT_ID', 'local-client-id');
  setRuntimeMetadata(runtimeMetadata);

  const setup = getUiPathAuthSetup();

  expect(setup.config).toMatchObject({
    clientId: 'runtime-client-id',
    orgName: 'uipathlabs',
    tenantName: 'Playground',
    baseUrl: 'https://staging.api.uipath.com',
    redirectUri: 'https://staging.uipath.com/uipathlabs/Playground/apps_/pi360',
    scope: 'OR.Users.Read',
  });
  expect(setup.missingFields).toEqual([]);
});

it('uses local environment fallback only when runtime metadata is absent', () => {
  vi.stubEnv('VITE_UIPATH_CLIENT_ID', 'local-client-id');
  vi.stubEnv('VITE_UIPATH_ORG_NAME', 'uipathlabs');
  vi.stubEnv('VITE_UIPATH_TENANT_NAME', 'Playground');
  vi.stubEnv('VITE_UIPATH_BASE_URL', 'https://staging.api.uipath.com');
  vi.stubEnv('VITE_UIPATH_REDIRECT_URI', 'http://localhost:5173');
  vi.stubEnv('VITE_UIPATH_SCOPE', 'OR.Users.Read');

  const setup = getUiPathAuthSetup();

  expect(setup.config.clientId).toBe('local-client-id');
  expect(setup.missingFields).toEqual([]);
});

it('carries the nine configured PI360 Data Fabric entity IDs into the live repository config', () => {
  const entityIds = {
    cases: 'case-entity-id',
    providers: 'provider-entity-id',
    attendants: 'attendant-entity-id',
    claims: 'claim-entity-id',
    evvVisits: 'evv-entity-id',
    riskSignals: 'risk-entity-id',
    evidenceDocuments: 'evidence-entity-id',
    investigationActions: 'action-entity-id',
    decisions: 'decision-entity-id',
  };

  const runtime = getUiPathRuntimeConfig({ entityIds });

  expect(runtime.entityIds).toEqual(entityIds);
});
