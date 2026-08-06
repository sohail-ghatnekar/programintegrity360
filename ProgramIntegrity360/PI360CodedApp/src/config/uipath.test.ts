import { expect, it } from 'vitest';
import { getUiPathAuthSetup } from './uipath';

it('reports missing local client ID without exposing credentials', () => {
  const setup = getUiPathAuthSetup({ clientId: '', orgName: 'uipathlabs', tenantName: 'Playground' });

  expect(setup.missingFields).toContain('VITE_UIPATH_CLIENT_ID');
  expect(JSON.stringify(setup)).not.toContain('access_token');
});
