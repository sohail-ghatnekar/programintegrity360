import { StrictMode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
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

function createSdkMock({
  authenticated,
  callback,
  completion = true,
}: {
  authenticated: boolean;
  callback: boolean;
  completion?: boolean | Promise<boolean>;
}) {
  return {
    completeOAuth: vi.fn().mockImplementation(() => Promise.resolve(completion)),
    initialize: vi.fn().mockResolvedValue(undefined),
    isAuthenticated: vi.fn(() => authenticated),
    isInOAuthCallback: vi.fn(() => callback),
  } as unknown as UiPath;
}

function AuthState() {
  const { currentUserName, error, isAuthenticated, logout } = useAuth();
  return (
    <>
      <div data-testid="auth-state">{isAuthenticated ? 'authenticated' : 'anonymous'}</div>
      <div data-testid="auth-name">{currentUserName || 'none'}</div>
      <div data-testid="auth-error">{error || 'none'}</div>
      <button type="button" onClick={logout}>Logout</button>
    </>
  );
}

function renderAuthProvider(sdk: UiPath, options: { strict?: boolean; sdkFactory?: () => UiPath } = {}) {
  const content = (
    <AuthProvider config={authConfig} sdkFactory={options.sdkFactory || (() => sdk)}>
      <AuthState />
    </AuthProvider>
  );

  return render(
    options.strict ? <StrictMode>{content}</StrictMode> : content,
  );
}

function createDeferred() {
  let resolve!: (value: boolean) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<boolean>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });

  return { promise, reject, resolve };
}

describe('AuthProvider', () => {
  beforeEach(() => {
    history.replaceState({}, '', '/');
    sessionStorage.clear();
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

  it('completes an OAuth callback once and removes code parameters', async () => {
    history.replaceState({}, '', '/?code=abc&state=xyz');
    const sdk = createSdkMock({ authenticated: true, callback: true });

    renderAuthProvider(sdk);

    await waitFor(() => expect(sdk.completeOAuth).toHaveBeenCalledTimes(1));

    expect(location.search).toBe('');
  });

  it('preserves unrelated callback URL parameters', async () => {
    history.replaceState({}, '', '/?code=abc&state=xyz&returnTo=case-41');
    const sdk = createSdkMock({ authenticated: true, callback: true });

    renderAuthProvider(sdk);

    await waitFor(() => expect(sdk.completeOAuth).toHaveBeenCalledTimes(1));

    expect(location.search).toBe('?returnTo=case-41');
  });

  it('clears OAuth storage and keeps a recoverable error after a false callback result', async () => {
    const removeItem = vi.fn();
    vi.stubGlobal('sessionStorage', { getItem: vi.fn(() => null), removeItem });
    const sdk = createSdkMock({ authenticated: false, callback: true, completion: false });

    renderAuthProvider(sdk);

    await waitFor(() => expect(screen.getByTestId('auth-error')).toHaveTextContent('Authentication failed'));

    expect(removeItem).toHaveBeenCalledTimes(3);
    expect(screen.getByTestId('auth-state')).toHaveTextContent('anonymous');
  });

  it('clears OAuth storage and keeps a recoverable error after callback rejection', async () => {
    const removeItem = vi.fn();
    vi.stubGlobal('sessionStorage', { getItem: vi.fn(() => null), removeItem });
    const sdk = createSdkMock({
      authenticated: false,
      callback: true,
      completion: Promise.reject(new Error('callback exchange failed')),
    });

    renderAuthProvider(sdk);

    await waitFor(() => expect(screen.getByTestId('auth-error')).toHaveTextContent('Authentication failed'));

    expect(removeItem).toHaveBeenCalledTimes(3);
    expect(screen.getByTestId('auth-state')).toHaveTextContent('anonymous');
  });

  it('does not complete an OAuth callback twice in StrictMode', async () => {
    history.replaceState({}, '', '/?code=abc&state=xyz');
    const sdk = createSdkMock({ authenticated: true, callback: true });

    renderAuthProvider(sdk, { strict: true });

    await waitFor(() => expect(screen.getByTestId('auth-state')).toHaveTextContent('authenticated'));

    expect(sdk.completeOAuth).toHaveBeenCalledTimes(1);
  });

  it('does not restore authentication after logout while a callback is pending', async () => {
    history.replaceState({}, '', '/?code=pending-logout&state=xyz');
    const deferred = createDeferred();
    const pendingSdk = createSdkMock({ authenticated: true, callback: true, completion: deferred.promise });
    const loggedOutSdk = createSdkMock({ authenticated: false, callback: false });
    const sdkFactory = vi.fn()
      .mockReturnValueOnce(pendingSdk)
      .mockReturnValue(loggedOutSdk);

    renderAuthProvider(pendingSdk, { sdkFactory });

    await waitFor(() => expect(pendingSdk.completeOAuth).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole('button', { name: 'Logout' }));

    await act(async () => {
      deferred.resolve(true);
    });

    await waitFor(() => expect(screen.getByTestId('auth-state')).toHaveTextContent('anonymous'));
    expect(pendingSdk.isAuthenticated).not.toHaveBeenCalled();
  });

  it('does not update authentication after unmount while a callback is pending', async () => {
    history.replaceState({}, '', '/?code=pending-unmount&state=xyz');
    const deferred = createDeferred();
    const sdk = createSdkMock({ authenticated: true, callback: true, completion: deferred.promise });
    const view = renderAuthProvider(sdk);

    await waitFor(() => expect(sdk.completeOAuth).toHaveBeenCalledTimes(1));
    view.unmount();

    await act(async () => {
      deferred.resolve(true);
    });

    expect(sdk.isAuthenticated).not.toHaveBeenCalled();
  });

  it('does not clear a newer session when a stale callback resolves false after logout', async () => {
    history.replaceState({}, '', '/?code=stale-false-logout&state=xyz');
    const removeItem = vi.fn();
    vi.stubGlobal('sessionStorage', { getItem: vi.fn(() => null), removeItem });
    const deferred = createDeferred();
    const pendingSdk = createSdkMock({ authenticated: false, callback: true, completion: deferred.promise });
    const loggedOutSdk = createSdkMock({ authenticated: false, callback: false });
    const sdkFactory = vi.fn()
      .mockReturnValueOnce(pendingSdk)
      .mockReturnValue(loggedOutSdk);

    renderAuthProvider(pendingSdk, { sdkFactory });

    await waitFor(() => expect(pendingSdk.completeOAuth).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole('button', { name: 'Logout' }));
    removeItem.mockClear();

    await act(async () => {
      deferred.resolve(false);
      await deferred.promise;
    });

    expect(removeItem).not.toHaveBeenCalled();
  });

  it('does not clear a newer session when a stale callback rejects after logout', async () => {
    history.replaceState({}, '', '/?code=stale-rejected-logout&state=xyz');
    const removeItem = vi.fn();
    vi.stubGlobal('sessionStorage', { getItem: vi.fn(() => null), removeItem });
    const deferred = createDeferred();
    const pendingSdk = createSdkMock({ authenticated: false, callback: true, completion: deferred.promise });
    const loggedOutSdk = createSdkMock({ authenticated: false, callback: false });
    const sdkFactory = vi.fn()
      .mockReturnValueOnce(pendingSdk)
      .mockReturnValue(loggedOutSdk);

    renderAuthProvider(pendingSdk, { sdkFactory });

    await waitFor(() => expect(pendingSdk.completeOAuth).toHaveBeenCalledTimes(1));
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

  it('does not clear a current session when a stale callback resolves false after unmount', async () => {
    history.replaceState({}, '', '/?code=stale-false-unmount&state=xyz');
    const removeItem = vi.fn();
    vi.stubGlobal('sessionStorage', { getItem: vi.fn(() => null), removeItem });
    const deferred = createDeferred();
    const sdk = createSdkMock({ authenticated: false, callback: true, completion: deferred.promise });
    const view = renderAuthProvider(sdk);

    await waitFor(() => expect(sdk.completeOAuth).toHaveBeenCalledTimes(1));
    view.unmount();

    await act(async () => {
      deferred.resolve(false);
      await deferred.promise;
    });

    expect(removeItem).not.toHaveBeenCalled();
  });

  it('does not clear a current session when a stale callback rejects after unmount', async () => {
    history.replaceState({}, '', '/?code=stale-rejected-unmount&state=xyz');
    const removeItem = vi.fn();
    vi.stubGlobal('sessionStorage', { getItem: vi.fn(() => null), removeItem });
    const deferred = createDeferred();
    const sdk = createSdkMock({ authenticated: false, callback: true, completion: deferred.promise });
    const view = renderAuthProvider(sdk);

    await waitFor(() => expect(sdk.completeOAuth).toHaveBeenCalledTimes(1));
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
    const deferred = createDeferred();
    const firstSdk = createSdkMock({ authenticated: true, callback: true, completion: deferred.promise });
    const remountedSdk = createSdkMock({ authenticated: true, callback: true });
    const firstView = renderAuthProvider(firstSdk);

    await waitFor(() => expect(firstSdk.completeOAuth).toHaveBeenCalledTimes(1));
    firstView.unmount();
    renderAuthProvider(remountedSdk);

    expect(remountedSdk.completeOAuth).not.toHaveBeenCalled();

    await act(async () => {
      deferred.resolve(true);
      await deferred.promise;
    });

    await waitFor(() => expect(screen.getByTestId('auth-state')).toHaveTextContent('authenticated'));
    expect(firstSdk.completeOAuth).toHaveBeenCalledTimes(1);
    expect(remountedSdk.completeOAuth).not.toHaveBeenCalled();
  });

  it('keeps an in-flight callback deduplicated after its former timeout and provider remount', async () => {
    vi.useFakeTimers();
    history.replaceState({}, '', '/?code=provider-remount-after-timeout&state=xyz');
    const deferred = createDeferred();
    const firstSdk = createSdkMock({ authenticated: true, callback: true, completion: deferred.promise });
    const remountedSdk = createSdkMock({ authenticated: true, callback: true });
    const firstView = renderAuthProvider(firstSdk);

    await act(async () => {
      await Promise.resolve();
    });
    expect(firstSdk.completeOAuth).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_001);
    });
    firstView.unmount();
    renderAuthProvider(remountedSdk);

    await act(async () => {
      await Promise.resolve();
    });
    expect(firstSdk.completeOAuth).toHaveBeenCalledTimes(1);
    expect(remountedSdk.completeOAuth).not.toHaveBeenCalled();

    await act(async () => {
      deferred.resolve(true);
      await deferred.promise;
    });
  });
});
