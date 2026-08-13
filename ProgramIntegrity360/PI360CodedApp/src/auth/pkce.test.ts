import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  buildAuthorizationUrl,
  completePkceAuthorization,
  createPkceAuthorizationRequest,
  exchangeAuthorizationCode,
  getPkceTransactionKey,
  storeSdkOAuthToken,
} from './pkce';

const exactScopes = 'OR.Administration.Read OR.Assets.Read OR.Buckets OR.Buckets.Read OR.Buckets.Write OR.Execution.Read OR.Folders.Read OR.Jobs.Read OR.Jobs.Write OR.Queues.Read OR.Tasks OR.Tasks.Read OR.Tasks.Write PIMS DataFabric.Data.Read DataFabric.Data.Write DataFabric.Schema.Read ConversationalAgents';

const oauthConfig = {
  clientId: '57201488-1566-4f9b-a696-1b3773c2af33',
  redirectUri: 'https://uipathlabs.uipath.host/pi360-coded-app',
  scope: exactScopes,
};

afterEach(() => {
  sessionStorage.clear();
  vi.restoreAllMocks();
});

describe('PI360 PKCE OAuth', () => {
  it('requests exactly the configured scopes from the published authorization endpoint', () => {
    const authorizationUrl = new URL(buildAuthorizationUrl(oauthConfig, 'test-challenge', 'test-state'));

    expect(`${authorizationUrl.origin}${authorizationUrl.pathname}`).toBe(
      'https://cloud.uipath.com/identity_/connect/authorize',
    );
    expect(authorizationUrl.searchParams.get('response_type')).toBe('code');
    expect(authorizationUrl.searchParams.get('client_id')).toBe(oauthConfig.clientId);
    expect(authorizationUrl.searchParams.get('redirect_uri')).toBe(oauthConfig.redirectUri);
    expect(authorizationUrl.searchParams.get('code_challenge')).toBe('test-challenge');
    expect(authorizationUrl.searchParams.get('code_challenge_method')).toBe('S256');
    expect(authorizationUrl.searchParams.get('state')).toBe('test-state');
    expect(authorizationUrl.searchParams.get('scope')).toBe(exactScopes);
    expect(authorizationUrl.searchParams.get('scope')?.split(' ')).toHaveLength(18);
    expect(authorizationUrl.searchParams.get('scope')).not.toContain('offline_access');
  });

  it('exchanges the authorization code without a client secret', async () => {
    const fetchStub = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      access_token: 'access-token-value',
      expires_in: 3600,
      token_type: 'Bearer',
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }));

    const token = await exchangeAuthorizationCode(oauthConfig, 'authorization-code', 'code-verifier', fetchStub);

    expect(token.access_token).toBe('access-token-value');
    expect(fetchStub).toHaveBeenCalledTimes(1);
    const [requestUrl, requestInit] = fetchStub.mock.calls[0] as [string, RequestInit];
    expect(requestUrl).toBe('https://cloud.uipath.com/identity_/connect/token');
    expect(requestInit.method).toBe('POST');
    expect(requestInit.headers).toEqual({ 'Content-Type': 'application/x-www-form-urlencoded' });
    const body = new URLSearchParams(String(requestInit.body));
    expect(Object.fromEntries(body)).toEqual({
      grant_type: 'authorization_code',
      client_id: oauthConfig.clientId,
      code: 'authorization-code',
      redirect_uri: oauthConfig.redirectUri,
      code_verifier: 'code-verifier',
    });
    expect(body.has('client_secret')).toBe(false);
  });

  it('stores the access token in the UiPath SDK session format', () => {
    storeSdkOAuthToken(oauthConfig.clientId, {
      access_token: 'access-token-value',
      expires_in: 3600,
      token_type: 'Bearer',
    }, sessionStorage, 1_700_000_000_000);

    expect(JSON.parse(sessionStorage.getItem(
      `uipath_sdk_user_token-${oauthConfig.clientId}`,
    ) || '{}')).toEqual({
      token: 'access-token-value',
      type: 'oauth',
      expiresAt: '2023-11-14T23:13:20.000Z',
    });
  });

  it('creates a PKCE transaction without changing the configured scope list', async () => {
    let randomCall = 0;
    const cryptoStub = {
      getRandomValues: vi.fn((bytes: Uint8Array) => {
        randomCall += 1;
        bytes.fill(randomCall);
        return bytes;
      }),
      subtle: {
        digest: vi.fn().mockResolvedValue(Uint8Array.from([3, 4]).buffer),
      },
    } as unknown as Crypto;

    const authorizationUrl = new URL(await createPkceAuthorizationRequest(
      oauthConfig,
      sessionStorage,
      cryptoStub,
    ));
    const transaction = JSON.parse(sessionStorage.getItem(
      getPkceTransactionKey(oauthConfig.clientId),
    ) || '{}');

    expect(transaction.codeVerifier).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(transaction.state).toMatch(/^[A-Za-z0-9_-]{22}$/);
    expect(authorizationUrl.searchParams.get('code_challenge')).toBe('AwQ');
    expect(authorizationUrl.searchParams.get('state')).toBe(transaction.state);
    expect(authorizationUrl.searchParams.get('scope')).toBe(exactScopes);
    expect(authorizationUrl.searchParams.get('scope')).not.toContain('offline_access');
  });

  it('exchanges a matching PKCE callback without committing the token', async () => {
    sessionStorage.setItem(getPkceTransactionKey(oauthConfig.clientId), JSON.stringify({
      codeVerifier: 'stored-code-verifier',
      state: 'stored-state',
    }));
    const fetchStub = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      access_token: 'access-token-value',
      expires_in: 3600,
      token_type: 'Bearer',
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }));

    const token = await completePkceAuthorization(
      oauthConfig,
      `${oauthConfig.redirectUri}?code=authorization-code&state=stored-state`,
      sessionStorage,
      fetchStub,
    );

    expect(token).toEqual({
      access_token: 'access-token-value',
      expires_in: 3600,
      token_type: 'Bearer',
    });
    expect(sessionStorage.getItem(getPkceTransactionKey(oauthConfig.clientId))).toBeNull();
    expect(sessionStorage.getItem(`uipath_sdk_user_token-${oauthConfig.clientId}`)).toBeNull();
  });

  it('rejects a callback whose state does not match the PKCE transaction', async () => {
    sessionStorage.setItem(getPkceTransactionKey(oauthConfig.clientId), JSON.stringify({
      codeVerifier: 'stored-code-verifier',
      state: 'stored-state',
    }));
    const fetchStub = vi.fn();

    await expect(completePkceAuthorization(
      oauthConfig,
      `${oauthConfig.redirectUri}?code=authorization-code&state=wrong-state`,
      sessionStorage,
      fetchStub,
    )).rejects.toThrow('OAuth state validation failed');

    expect(fetchStub).not.toHaveBeenCalled();
    expect(sessionStorage.getItem(getPkceTransactionKey(oauthConfig.clientId))).toBeNull();
  });
});
