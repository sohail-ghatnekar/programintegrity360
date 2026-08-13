import { StrictMode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { UiPath, UiPathSDKConfig } from '@uipath/uipath-typescript/core';
import type { OAuthTokenResponse } from '../auth/pkce';
import { AuthProvider, useAuth } from './useAuth';
import type { PkceClient } from './useAuth';

const { getSettingsMock, userConstructorMock } = vi.hoisted(() => ({
  getSettingsMock: vi.fn(),
  userConstructorMock: vi.fn(),
}));

vi.mock('@uipath/uipath-typescript/conversational-agent', () => ({
  User: class UserMock {
    constructor(sdk: UiPath) {
      userConstructorMock(sdk);
    }

    getSettings() {
      return getSettingsMock();
    }
  },
}));

const authConfig: UiPathSDKConfig = {
  clientId: 'test-client-id',
  orgName: 'uipathlabs',
  tenantName: 'Playground',
  baseUrl: 'https://staging.api.uipath.com',
  redirectUri: 'http://localhost',
  scope: 'OR.Users.Read',
};

const oauthToken: OAuthTokenResponse = {
  access_token: 'access-token-value',
  expires_in: 3600,
  token_type: 'Bearer',
};

function createSdkMock({ authenticated, callback }: {
  authenticated: boolean;
  callback: boolean;
}) {
  return {
    completeOAuth: vi.fn().mockResolvedValue(true),
    initialize: vi.fn().mockResolvedValue(undefined),
    isAuthenticated: vi.fn(() => authenticated),
    isInOAuthCallback: vi.fn(() => callback),
  } as unknown as UiPath;
}

function createPkceClientMock({
  callback,
  completion = oauthToken,
}: {
  callback: boolean;
  completion?: OAuthTokenResponse | Promise<OAuthTokenResponse>;
}): PkceClient {
  return {
    clear: vi.fn(),
    completeAuthorization: vi.fn().mockImplementation(() => Promise.resolve(completion)),
    isCallback: vi.fn(() => callback
      && new URL(window.location.href).searchParams.has('code')
      && new URL(window.location.href).searchParams.has('state')),
    startAuthorization: vi.fn().mockResolvedValue(undefined),
    storeToken: vi.fn((clientId, token) => {
      sessionStorage.setItem(`uipath_sdk_user_token-${clientId}`, JSON.stringify({
        token: token.access_token,
        type: 'oauth',
      }));
    }),
  };
}

function AuthState() {
  const {
    currentUserEmail,
    currentUserName,
    error,
    isAuthenticated,
    login,
    logout,
  } = useAuth();
  return (
    <>
      <div data-testid="auth-state">{isAuthenticated ? 'authenticated' : 'anonymous'}</div>
      <div data-testid="auth-name">{currentUserName || 'none'}</div>
      <div data-testid="auth-email">{currentUserEmail || 'none'}</div>
      <div data-testid="auth-error">{error || 'none'}</div>
      <button type="button" onClick={() => void login()}>Login</button>
      <button type="button" onClick={logout}>Logout</button>
    </>
  );
}

function renderAuthProvider(
  sdk: UiPath,
  options: { pkceClient?: PkceClient; strict?: boolean; sdkFactory?: () => UiPath } = {},
) {
  const content = (
    <AuthProvider
      config={authConfig}
      pkceClient={options.pkceClient || createPkceClientMock({ callback: false })}
      sdkFactory={options.sdkFactory || (() => sdk)}
    >
      <AuthState />
    </AuthProvider>
  );

  return render(
    options.strict ? <StrictMode>{content}</StrictMode> : content,
  );
}

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });

  return { promise, reject, resolve };
}

describe('AuthProvider', () => {
  beforeEach(() => {
    history.replaceState({}, '', '/');
    sessionStorage.clear();
    getSettingsMock.mockReset();
    getSettingsMock.mockRejectedValue(new Error('profile unavailable'));
    userConstructorMock.mockReset();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('does not clear a valid SDK session on a normal refresh', async () => {
    const removeItem = vi.fn();
    const getItem = vi.fn(() => null);
    vi.stubGlobal('sessionStorage', {
      getItem,
      removeItem,
    });
    const sdk = createSdkMock({ authenticated: true, callback: false });

    renderAuthProvider(sdk);

    await waitFor(() => expect(screen.getByTestId('auth-state')).toHaveTextContent('authenticated'));

    expect(sessionStorage.removeItem).not.toHaveBeenCalled();
    expect(getItem).not.toHaveBeenCalled();
    expect(screen.getByTestId('auth-name')).toHaveTextContent('Authenticated UiPath user');
  });

  it('loads the authenticated user name and email from UiPath settings', async () => {
    const sdk = createSdkMock({ authenticated: true, callback: false });
    getSettingsMock.mockResolvedValue({
      company: 'UiPath',
      country: 'United States',
      createdTime: '2026-08-10T12:00:00Z',
      department: 'Public Sector',
      email: 'sohail@example.gov',
      name: 'Sohail Ghatnekar',
      role: 'Investigator',
      timezone: 'America/New_York',
      updatedTime: '2026-08-10T12:00:00Z',
      userId: '2f199503-ff2b-4c87-ad95-e24f50ad5bb8',
    });

    renderAuthProvider(sdk);

    expect(await screen.findByTestId('auth-name')).toHaveTextContent('Sohail Ghatnekar');
    expect(screen.getByTestId('auth-email')).toHaveTextContent('sohail@example.gov');
    expect(screen.getByTestId('auth-state')).toHaveTextContent('authenticated');
    expect(userConstructorMock).toHaveBeenCalledWith(sdk);
  });

  it('keeps OAuth authenticated when the user profile request fails', async () => {
    const sdk = createSdkMock({ authenticated: true, callback: false });
    getSettingsMock.mockRejectedValue(new Error('profile request failed'));

    renderAuthProvider(sdk);

    await waitFor(() => expect(getSettingsMock).toHaveBeenCalledTimes(1));
    expect(screen.getByTestId('auth-state')).toHaveTextContent('authenticated');
    expect(screen.getByTestId('auth-name')).toHaveTextContent('Authenticated UiPath user');
    expect(screen.getByTestId('auth-email')).toHaveTextContent('none');
    expect(screen.getByTestId('auth-error')).toHaveTextContent('none');
  });

  it('normalizes malformed or empty profile identity values', async () => {
    const sdk = createSdkMock({ authenticated: true, callback: false });
    getSettingsMock.mockResolvedValue({
      company: null,
      country: null,
      createdTime: '2026-08-10T12:00:00Z',
      department: null,
      email: { unexpected: true },
      name: '   ',
      role: null,
      timezone: null,
      updatedTime: '2026-08-10T12:00:00Z',
      userId: '2f199503-ff2b-4c87-ad95-e24f50ad5bb8',
    });

    renderAuthProvider(sdk);

    await waitFor(() => expect(getSettingsMock).toHaveBeenCalledTimes(1));
    expect(screen.getByTestId('auth-name')).toHaveTextContent('Authenticated UiPath user');
    expect(screen.getByTestId('auth-email')).toHaveTextContent('none');
  });

  it('does not repopulate profile identity when a late settings request resolves after logout', async () => {
    const deferred = createDeferred<{
      email: string;
      name: string;
    }>();
    const authenticatedSdk = createSdkMock({ authenticated: true, callback: false });
    const loggedOutSdk = createSdkMock({ authenticated: false, callback: false });
    const sdkFactory = vi.fn()
      .mockReturnValueOnce(authenticatedSdk)
      .mockReturnValue(loggedOutSdk);
    getSettingsMock.mockReturnValue(deferred.promise);

    renderAuthProvider(authenticatedSdk, { sdkFactory });

    await waitFor(() => expect(getSettingsMock).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole('button', { name: 'Logout' }));

    await act(async () => {
      deferred.resolve({
        email: 'stale@example.gov',
        name: 'Stale User',
      });
      await deferred.promise;
    });

    expect(screen.getByTestId('auth-state')).toHaveTextContent('anonymous');
    expect(screen.getByTestId('auth-name')).toHaveTextContent('none');
    expect(screen.getByTestId('auth-email')).toHaveTextContent('none');
  });

  it('starts the exact-scope PKCE flow instead of the SDK OAuth initializer', async () => {
    const sdk = createSdkMock({ authenticated: false, callback: false });
    const startAuthorization = vi.fn().mockResolvedValue(undefined);

    render(
      <AuthProvider
        config={authConfig}
        sdkFactory={() => sdk}
        pkceClient={{
          clear: vi.fn(),
          completeAuthorization: vi.fn(),
          isCallback: vi.fn(() => false),
          startAuthorization,
          storeToken: vi.fn(),
        }}
      >
        <AuthState />
      </AuthProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Login' }));

    await waitFor(() => expect(startAuthorization).toHaveBeenCalledWith({
      clientId: authConfig.clientId,
      redirectUri: authConfig.redirectUri,
      scope: authConfig.scope,
    }));
    expect(sdk.initialize).not.toHaveBeenCalled();
  });

  it('completes an OAuth callback once and removes code parameters', async () => {
    history.replaceState({}, '', '/?code=abc&state=xyz');
    const sdk = createSdkMock({ authenticated: true, callback: true });
    const pkceClient = createPkceClientMock({ callback: true });

    renderAuthProvider(sdk, { pkceClient });

    await waitFor(() => expect(pkceClient.completeAuthorization).toHaveBeenCalledTimes(1));

    expect(location.search).toBe('');
    expect(sdk.completeOAuth).not.toHaveBeenCalled();
  });

  it('preserves unrelated callback URL parameters', async () => {
    history.replaceState({}, '', '/?code=abc&state=xyz&returnTo=case-41');
    const sdk = createSdkMock({ authenticated: true, callback: true });
    const pkceClient = createPkceClientMock({ callback: true });

    renderAuthProvider(sdk, { pkceClient });

    await waitFor(() => expect(pkceClient.completeAuthorization).toHaveBeenCalledTimes(1));

    expect(location.search).toBe('?returnTo=case-41');
  });

  it('clears OAuth storage and callback parameters after token persistence fails', async () => {
    history.replaceState({}, '', '/?code=store-failed&state=xyz');
    const removeItem = vi.fn();
    vi.stubGlobal('sessionStorage', { getItem: vi.fn(() => null), removeItem });
    const sdk = createSdkMock({ authenticated: false, callback: true });
    const pkceClient = createPkceClientMock({ callback: true });
    vi.mocked(pkceClient.storeToken).mockImplementation(() => {
      throw new Error('token persistence failed');
    });

    renderAuthProvider(sdk, { pkceClient });

    await waitFor(() => expect(screen.getByTestId('auth-error')).toHaveTextContent('Authentication failed'));

    expect(removeItem).toHaveBeenCalledTimes(3);
    expect(pkceClient.clear).toHaveBeenCalledWith(authConfig.clientId);
    expect(pkceClient.storeToken).toHaveBeenCalledWith(authConfig.clientId, oauthToken);
    expect(screen.getByTestId('auth-state')).toHaveTextContent('anonymous');
    expect(location.search).toBe('');
  });

  it('clears OAuth storage and keeps a recoverable error after callback rejection', async () => {
    history.replaceState({}, '', '/?code=rejected-result&state=xyz');
    const removeItem = vi.fn();
    vi.stubGlobal('sessionStorage', { getItem: vi.fn(() => null), removeItem });
    const sdk = createSdkMock({
      authenticated: false,
      callback: true,
    });
    const pkceClient = createPkceClientMock({ callback: true });
    vi.mocked(pkceClient.completeAuthorization).mockRejectedValue(
      new Error('callback exchange failed'),
    );

    renderAuthProvider(sdk, { pkceClient });

    await waitFor(() => expect(screen.getByTestId('auth-error')).toHaveTextContent('Authentication failed'));

    expect(removeItem).toHaveBeenCalledTimes(3);
    expect(pkceClient.clear).toHaveBeenCalledWith(authConfig.clientId);
    expect(screen.getByTestId('auth-state')).toHaveTextContent('anonymous');
    expect(location.search).toBe('');
  });

  it('does not complete an OAuth callback twice in StrictMode', async () => {
    history.replaceState({}, '', '/?code=abc&state=xyz');
    const sdk = createSdkMock({ authenticated: true, callback: true });
    const pkceClient = createPkceClientMock({ callback: true });

    renderAuthProvider(sdk, { pkceClient, strict: true });

    await waitFor(() => expect(screen.getByTestId('auth-state')).toHaveTextContent('authenticated'));

    expect(pkceClient.completeAuthorization).toHaveBeenCalledTimes(1);
  });

  it('reconstructs the SDK after a successful callback stores the token', async () => {
    history.replaceState({}, '', '/?code=fresh-token&state=xyz');
    const initialSdk = createSdkMock({ authenticated: false, callback: false });
    const authenticatedSdk = createSdkMock({ authenticated: true, callback: false });
    const sdkFactory = vi.fn()
      .mockReturnValueOnce(initialSdk)
      .mockReturnValue(authenticatedSdk);
    const pkceClient = createPkceClientMock({ callback: true });

    renderAuthProvider(initialSdk, { pkceClient, sdkFactory });

    await waitFor(() => expect(screen.getByTestId('auth-state')).toHaveTextContent('authenticated'));

    expect(sdkFactory).toHaveBeenCalledTimes(2);
    expect(initialSdk.isAuthenticated).not.toHaveBeenCalled();
    expect(authenticatedSdk.isAuthenticated).toHaveBeenCalled();
  });

  it('does not restore authentication after logout while a callback is pending', async () => {
    history.replaceState({}, '', '/?code=pending-logout&state=xyz');
    const deferred = createDeferred<OAuthTokenResponse>();
    const pendingSdk = createSdkMock({ authenticated: true, callback: true });
    const loggedOutSdk = createSdkMock({ authenticated: false, callback: false });
    const pkceClient = createPkceClientMock({ callback: true, completion: deferred.promise });
    const sdkFactory = vi.fn()
      .mockReturnValueOnce(pendingSdk)
      .mockReturnValue(loggedOutSdk);

    renderAuthProvider(pendingSdk, { pkceClient, sdkFactory });

    await waitFor(() => expect(pkceClient.completeAuthorization).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole('button', { name: 'Logout' }));

    await act(async () => {
      deferred.resolve(oauthToken);
    });

    await waitFor(() => expect(screen.getByTestId('auth-state')).toHaveTextContent('anonymous'));
    expect(pkceClient.storeToken).not.toHaveBeenCalled();
    expect(pendingSdk.isAuthenticated).not.toHaveBeenCalled();
  });

  it('does not let an in-flight callback restore a token after logout', async () => {
    history.replaceState({}, '', '/?code=pending-token-write&state=xyz');
    const deferred = createDeferred<OAuthTokenResponse>();
    const pendingSdk = createSdkMock({ authenticated: false, callback: true });
    const loggedOutSdk = createSdkMock({ authenticated: false, callback: false });
    const pkceClient = createPkceClientMock({ callback: true });
    vi.mocked(pkceClient.completeAuthorization).mockReturnValue(deferred.promise);
    const sdkFactory = vi.fn()
      .mockReturnValueOnce(pendingSdk)
      .mockReturnValue(loggedOutSdk);

    renderAuthProvider(pendingSdk, { pkceClient, sdkFactory });

    await waitFor(() => expect(pkceClient.completeAuthorization).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole('button', { name: 'Logout' }));

    await act(async () => {
      deferred.resolve(oauthToken);
      await deferred.promise;
    });

    expect(sessionStorage.getItem(`uipath_sdk_user_token-${authConfig.clientId}`)).toBeNull();
    expect(pkceClient.storeToken).not.toHaveBeenCalled();
    expect(screen.getByTestId('auth-state')).toHaveTextContent('anonymous');
  });

  it('does not update authentication after unmount while a callback is pending', async () => {
    history.replaceState({}, '', '/?code=pending-unmount&state=xyz');
    const deferred = createDeferred<OAuthTokenResponse>();
    const sdk = createSdkMock({ authenticated: true, callback: true });
    const pkceClient = createPkceClientMock({ callback: true, completion: deferred.promise });
    const view = renderAuthProvider(sdk, { pkceClient });

    await waitFor(() => expect(pkceClient.completeAuthorization).toHaveBeenCalledTimes(1));
    view.unmount();

    await act(async () => {
      deferred.resolve(oauthToken);
    });

    expect(sdk.isAuthenticated).not.toHaveBeenCalled();
  });

  it('does not overwrite a newer session when a stale callback resolves after logout', async () => {
    history.replaceState({}, '', '/?code=stale-success-logout&state=xyz');
    const removeItem = vi.fn();
    vi.stubGlobal('sessionStorage', { getItem: vi.fn(() => null), removeItem });
    const deferred = createDeferred<OAuthTokenResponse>();
    const pendingSdk = createSdkMock({ authenticated: false, callback: true });
    const loggedOutSdk = createSdkMock({ authenticated: false, callback: false });
    const pkceClient = createPkceClientMock({ callback: true, completion: deferred.promise });
    const sdkFactory = vi.fn()
      .mockReturnValueOnce(pendingSdk)
      .mockReturnValue(loggedOutSdk);

    renderAuthProvider(pendingSdk, { pkceClient, sdkFactory });

    await waitFor(() => expect(pkceClient.completeAuthorization).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole('button', { name: 'Logout' }));
    removeItem.mockClear();

    await act(async () => {
      deferred.resolve(oauthToken);
      await deferred.promise;
    });

    expect(removeItem).not.toHaveBeenCalled();
    expect(pkceClient.storeToken).not.toHaveBeenCalled();
  });

  it('does not clear a newer session when a stale callback rejects after logout', async () => {
    history.replaceState({}, '', '/?code=stale-rejected-logout&state=xyz');
    const removeItem = vi.fn();
    vi.stubGlobal('sessionStorage', { getItem: vi.fn(() => null), removeItem });
    const deferred = createDeferred<OAuthTokenResponse>();
    const pendingSdk = createSdkMock({ authenticated: false, callback: true });
    const loggedOutSdk = createSdkMock({ authenticated: false, callback: false });
    const pkceClient = createPkceClientMock({ callback: true, completion: deferred.promise });
    const sdkFactory = vi.fn()
      .mockReturnValueOnce(pendingSdk)
      .mockReturnValue(loggedOutSdk);

    renderAuthProvider(pendingSdk, { pkceClient, sdkFactory });

    await waitFor(() => expect(pkceClient.completeAuthorization).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole('button', { name: 'Logout' }));
    removeItem.mockClear();

    await act(async () => {
      deferred.reject(new Error('callback exchange failed'));
      try {
        await deferred.promise;
      } catch {
        // The provider handles the rejected callback promise.
      }
    });

    expect(removeItem).not.toHaveBeenCalled();
  });

  it('does not overwrite a current session when a stale callback resolves after unmount', async () => {
    history.replaceState({}, '', '/?code=stale-success-unmount&state=xyz');
    const removeItem = vi.fn();
    vi.stubGlobal('sessionStorage', { getItem: vi.fn(() => null), removeItem });
    const deferred = createDeferred<OAuthTokenResponse>();
    const sdk = createSdkMock({ authenticated: false, callback: true });
    const pkceClient = createPkceClientMock({ callback: true, completion: deferred.promise });
    const view = renderAuthProvider(sdk, { pkceClient });

    await waitFor(() => expect(pkceClient.completeAuthorization).toHaveBeenCalledTimes(1));
    view.unmount();

    await act(async () => {
      deferred.resolve(oauthToken);
      await deferred.promise;
    });

    expect(removeItem).not.toHaveBeenCalled();
    expect(pkceClient.storeToken).not.toHaveBeenCalled();
  });

  it('does not clear a current session when a stale callback rejects after unmount', async () => {
    history.replaceState({}, '', '/?code=stale-rejected-unmount&state=xyz');
    const removeItem = vi.fn();
    vi.stubGlobal('sessionStorage', { getItem: vi.fn(() => null), removeItem });
    const deferred = createDeferred<OAuthTokenResponse>();
    const sdk = createSdkMock({ authenticated: false, callback: true });
    const pkceClient = createPkceClientMock({ callback: true, completion: deferred.promise });
    const view = renderAuthProvider(sdk, { pkceClient });

    await waitFor(() => expect(pkceClient.completeAuthorization).toHaveBeenCalledTimes(1));
    view.unmount();

    await act(async () => {
      deferred.reject(new Error('callback exchange failed'));
      try {
        await deferred.promise;
      } catch {
        // The provider handles the rejected callback promise.
      }
    });

    expect(removeItem).not.toHaveBeenCalled();
  });

  it('does not complete the same in-flight callback again after provider remount', async () => {
    history.replaceState({}, '', '/?code=provider-remount&state=xyz');
    const deferred = createDeferred<OAuthTokenResponse>();
    const firstSdk = createSdkMock({ authenticated: true, callback: true });
    const remountedSdk = createSdkMock({ authenticated: true, callback: true });
    const pkceClient = createPkceClientMock({ callback: true, completion: deferred.promise });
    const firstView = renderAuthProvider(firstSdk, { pkceClient });

    await waitFor(() => expect(pkceClient.completeAuthorization).toHaveBeenCalledTimes(1));
    firstView.unmount();
    renderAuthProvider(remountedSdk, { pkceClient });

    expect(pkceClient.completeAuthorization).toHaveBeenCalledTimes(1);

    await act(async () => {
      deferred.resolve(oauthToken);
      await deferred.promise;
    });

    await waitFor(() => expect(screen.getByTestId('auth-state')).toHaveTextContent('authenticated'));
    expect(pkceClient.completeAuthorization).toHaveBeenCalledTimes(1);
    expect(pkceClient.storeToken).toHaveBeenCalledTimes(1);
  });

  it('keeps an in-flight callback deduplicated after its former timeout and provider remount', async () => {
    vi.useFakeTimers();
    history.replaceState({}, '', '/?code=provider-remount-after-timeout&state=xyz');
    const deferred = createDeferred<OAuthTokenResponse>();
    const firstSdk = createSdkMock({ authenticated: true, callback: true });
    const remountedSdk = createSdkMock({ authenticated: true, callback: true });
    const pkceClient = createPkceClientMock({ callback: true, completion: deferred.promise });
    const firstView = renderAuthProvider(firstSdk, { pkceClient });

    await act(async () => {
      await Promise.resolve();
    });
    expect(pkceClient.completeAuthorization).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_001);
    });
    firstView.unmount();
    renderAuthProvider(remountedSdk, { pkceClient });

    await act(async () => {
      await Promise.resolve();
    });
    expect(pkceClient.completeAuthorization).toHaveBeenCalledTimes(1);

    await act(async () => {
      deferred.resolve(oauthToken);
      await deferred.promise;
    });
  });
});
