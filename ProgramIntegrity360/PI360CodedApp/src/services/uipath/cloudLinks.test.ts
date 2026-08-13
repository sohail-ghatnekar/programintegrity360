import { describe, expect, it } from 'vitest';
import {
  DEFAULT_UIPATH_PORTAL_ORIGIN,
  buildMaestroProcessUrl,
  portalOriginFromApiBase,
} from './cloudLinks';

describe('production UiPath Cloud links', () => {
  it('uses production Automation Cloud as the default portal', () => {
    expect(DEFAULT_UIPATH_PORTAL_ORIGIN).toBe('https://cloud.uipath.com');
  });

  it('maps the production API origin to the production portal', () => {
    expect(portalOriginFromApiBase('https://api.uipath.com')).toBe(
      'https://cloud.uipath.com',
    );
  });

  it('builds the Playground Maestro deep link on production Cloud', () => {
    expect(buildMaestroProcessUrl({
      folderKey: '5db31dd1-1073-4f9e-b44b-76f5484e03c4',
      instanceKey: 'instance-41',
      organizationName: 'uipathlabs',
      processKey: 'process-360',
      tenantName: 'Playground',
    })).toBe(
      'https://cloud.uipath.com/uipathlabs/Playground/maestro_/processes/process-360/instances/instance-41?folderKey=5db31dd1-1073-4f9e-b44b-76f5484e03c4',
    );
  });
});
