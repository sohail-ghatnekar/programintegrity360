const AUTHORIZATION_ENDPOINT = 'https://cloud.uipath.com/identity_/connect/authorize';
const TOKEN_ENDPOINT = 'https://cloud.uipath.com/identity_/connect/token';

export type PublicOAuthConfig = {
  clientId: string;
  redirectUri: string;
  scope: string;
};

export type OAuthTokenResponse = {
  access_token: string;
  expires_in?: number;
  token_type?: string;
};

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

type PkceTransaction = {
  codeVerifier: string;
  state: string;
};

function encodeBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

function randomBase64Url(byteLength: number, cryptoImplementation: Crypto): string {
  return encodeBase64Url(cryptoImplementation.getRandomValues(new Uint8Array(byteLength)));
}

export function getPkceTransactionKey(clientId: string): string {
  return `pi360_pkce_transaction-${clientId}`;
}

export function buildAuthorizationUrl(
  config: PublicOAuthConfig,
  codeChallenge: string,
  state: string,
): string {
  const query = new URLSearchParams({
    response_type: 'code',
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    scope: config.scope,
    state,
  });

  return `${AUTHORIZATION_ENDPOINT}?${query.toString()}`;
}

export async function exchangeAuthorizationCode(
  config: PublicOAuthConfig,
  code: string,
  codeVerifier: string,
  fetchImplementation: FetchLike = fetch,
): Promise<OAuthTokenResponse> {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: config.clientId,
    code,
    redirect_uri: config.redirectUri,
    code_verifier: codeVerifier,
  });
  const response = await fetchImplementation(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!response.ok) {
    throw new Error(`OAuth token exchange failed with status ${response.status}`);
  }

  const token = await response.json() as OAuthTokenResponse;
  if (!token.access_token) {
    throw new Error('OAuth token exchange returned no access token');
  }

  return token;
}

export function storeSdkOAuthToken(
  clientId: string,
  token: OAuthTokenResponse,
  storage: Storage = sessionStorage,
  now = Date.now(),
): void {
  const expiresAt = token.expires_in
    ? new Date(now + token.expires_in * 1000).toISOString()
    : undefined;

  storage.setItem(`uipath_sdk_user_token-${clientId}`, JSON.stringify({
    token: token.access_token,
    type: 'oauth',
    ...(expiresAt ? { expiresAt } : {}),
  }));
}

export async function createPkceAuthorizationRequest(
  config: PublicOAuthConfig,
  storage: Storage = sessionStorage,
  cryptoImplementation: Crypto = crypto,
): Promise<string> {
  const codeVerifier = randomBase64Url(32, cryptoImplementation);
  const state = randomBase64Url(16, cryptoImplementation);
  const digest = await cryptoImplementation.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(codeVerifier),
  );
  const codeChallenge = encodeBase64Url(new Uint8Array(digest));

  storage.setItem(getPkceTransactionKey(config.clientId), JSON.stringify({
    codeVerifier,
    state,
  } satisfies PkceTransaction));

  return buildAuthorizationUrl(config, codeChallenge, state);
}

export async function completePkceAuthorization(
  config: PublicOAuthConfig,
  callbackUrl: string = window.location.href,
  storage: Storage = sessionStorage,
  fetchImplementation: FetchLike = fetch,
): Promise<OAuthTokenResponse> {
  const transactionKey = getPkceTransactionKey(config.clientId);
  const storedTransaction = storage.getItem(transactionKey);
  storage.removeItem(transactionKey);

  const callback = new URL(callbackUrl);
  const code = callback.searchParams.get('code');
  const returnedState = callback.searchParams.get('state');
  const transaction = storedTransaction
    ? JSON.parse(storedTransaction) as PkceTransaction
    : null;

  if (!code || !returnedState || !transaction?.codeVerifier || !transaction.state) {
    throw new Error('OAuth callback is missing its PKCE transaction');
  }
  if (returnedState !== transaction.state) {
    throw new Error('OAuth state validation failed');
  }

  return exchangeAuthorizationCode(
    config,
    code,
    transaction.codeVerifier,
    fetchImplementation,
  );
}
