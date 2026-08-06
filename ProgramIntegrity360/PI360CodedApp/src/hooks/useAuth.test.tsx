import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import type { UiPath, UiPathSDKConfig } from '@uipath/uipath-typescript/core';
import { AuthProvider, useAuth } from './useAuth';

const authConfig: UiPathSDKConfig = {
  clientId: 'test-client-id',
  orgName: 'uipathlabs',
  tenantName: 'Playground',
  baseUrl: 'https://staging.api.uipath.com',
  redirectUri: 'http://localhost',
  scope: 'OR.Users.Read',
};

function createSdkMock({ authenticated, callback }: { authenticated: boolean; callback: boolean }) {
  return {
    completeOAuth: vi.fn().mockResolvedValue(true),
    initialize: vi.fn().mockResolvedValue(undefined),
    isAuthenticated: vi.fn(() => authenticated),
    isInOAuthCallback: vi.fn(() => callback),
  } as unknown as UiPath;
}

function AuthState() {
  const { isAuthenticated } = useAuth();
  return <div data-testid="auth-state">{isAuthenticated ? 'authenticated' : 'anonymous'}</div>;
}

function renderAuthProvider(sdk: UiPath) {
  return render(
    <AuthProvider config={authConfig} sdkFactory={() => sdk}>
      <AuthState />
    </AuthProvider>,
  );
}

describe('AuthProvider', () => {
  beforeEach(() => {
    history.replaceState({}, '', '/');
    sessionStorage.clear();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('does not clear a valid SDK session on a normal refresh', async () => {
    const removeItem = vi.fn();
    vi.stubGlobal('sessionStorage', {
      getItem: vi.fn(() => null),
      removeItem,
    });
    const sdk = createSdkMock({ authenticated: true, callback: false });

    renderAuthProvider(sdk);

    await waitFor(() => expect(screen.getByTestId('auth-state')).toHaveTextContent('authenticated'));

    expect(sessionStorage.removeItem).not.toHaveBeenCalled();
  });

  it('completes an OAuth callback once and removes code parameters', async () => {
    history.replaceState({}, '', '/?code=abc&state=xyz');
    const sdk = createSdkMock({ authenticated: true, callback: true });

    renderAuthProvider(sdk);

    await waitFor(() => expect(sdk.completeOAuth).toHaveBeenCalledTimes(1));

    expect(location.search).toBe('');
  });
});
