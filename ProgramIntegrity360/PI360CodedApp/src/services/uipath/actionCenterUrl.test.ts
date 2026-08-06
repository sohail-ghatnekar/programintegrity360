import { describe, expect, it } from 'vitest';
import { buildActionCenterTaskUrl } from './actionCenterUrl';

describe('buildActionCenterTaskUrl', () => {
  it('builds the configured UiPath tenant task route', () => {
    expect(buildActionCenterTaskUrl({
      portalOrigin: 'https://staging.uipath.com',
      organizationName: 'uipathlabs',
      tenantName: 'Playground',
      taskId: 123,
    })).toBe('https://staging.uipath.com/uipathlabs/Playground/actions_/tasks/123');
  });

  it('encodes tenant path segments and removes an origin path', () => {
    expect(buildActionCenterTaskUrl({
      portalOrigin: 'https://cloud.uipath.com/ignored/path',
      organizationName: 'Public Sector',
      tenantName: 'Demo Tenant',
      taskId: 42,
    })).toBe('https://cloud.uipath.com/Public%20Sector/Demo%20Tenant/actions_/tasks/42');
  });

  it('rejects missing route identity instead of producing malformed links', () => {
    expect(() => buildActionCenterTaskUrl({
      portalOrigin: 'https://cloud.uipath.com',
      organizationName: '',
      tenantName: 'Playground',
      taskId: 123,
    })).toThrow('organizationName');
  });
});
