import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { UiPath } from '@uipath/uipath-typescript/core';
import type { UiPathSDKConfig } from '@uipath/uipath-typescript/core';
import {
  completePkceAuthorization,
  createPkceAuthorizationRequest,
  getPkceTransactionKey,
  storeSdkOAuthToken,
} from '../auth/pkce';
import type { OAuthTokenResponse, PublicOAuthConfig } from '../auth/pkce';

const AUTHENTICATED_USER_NAME = 'Authenticated UiPath user';

export interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  sdk: UiPath;
  currentUserEmail: string | null;
  currentUserName: string | null;
  login: () => Promise<void>;
  logout: () => void;
  error: string | null;
}

type SdkFactory = (config: UiPathSDKConfig) => UiPath;

export type PkceClient = {
  clear: (clientId?: string) => void;
  completeAuthorization: (config: PublicOAuthConfig) => Promise<OAuthTokenResponse>;
  isCallback: () => boolean;
  startAuthorization: (config: PublicOAuthConfig) => Promise<void>;
  storeToken: (clientId: string, token: OAuthTokenResponse) => void;
};

type AuthProviderProps = {
  children: ReactNode;
  config: UiPathSDKConfig;
  pkceClient?: PkceClient;
  sdkFactory?: SdkFactory;
};

type CallbackCompletion = {
  result: Promise<OAuthTokenResponse>;
  timeoutId?: ReturnType<typeof setTimeout>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const defaultSdkFactory: SdkFactory = (config) => new UiPath(config);
const defaultPkceClient: PkceClient = {
  clear: (clientId) => {
    if (clientId) {
      sessionStorage.removeItem(getPkceTransactionKey(clientId));
    }
  },
  completeAuthorization: completePkceAuthorization,
  isCallback: () => {
    const callbackUrl = new URL(window.location.href);
    return callbackUrl.searchParams.has('code') && callbackUrl.searchParams.has('state');
  },
  startAuthorization: async (config) => {
    const authorizationUrl = await createPkceAuthorizationRequest(config);
    window.location.assign(authorizationUrl);
  },
  storeToken: storeSdkOAuthToken,
};
const CALLBACK_COMPLETION_TTL_MS = 60_000;
const callbackCompletions = new Map<string, CallbackCompletion>();

function getPublicOAuthConfig(config: UiPathSDKConfig): PublicOAuthConfig {
  if (!config.clientId || !config.redirectUri || !config.scope) {
    throw new Error('PI360 requires public OAuth configuration');
  }

  return {
    clientId: config.clientId,
    redirectUri: config.redirectUri,
    scope: config.scope,
  };
}

function clearOAuthSession(clientId?: string) {
  if (clientId) {
    sessionStorage.removeItem(`uipath_sdk_user_token-${clientId}`);
  }
  sessionStorage.removeItem('uipath_sdk_oauth_context');
  sessionStorage.removeItem('uipath_sdk_code_verifier');
}

function removeOAuthCallbackParameters() {
  const callbackUrl = new URL(window.location.href);
  callbackUrl.searchParams.delete('code');
  callbackUrl.searchParams.delete('state');
  window.history.replaceState(window.history.state, '', `${callbackUrl.pathname}${callbackUrl.search}${callbackUrl.hash}`);
}

function getCallbackCompletionKey(clientId?: string) {
  const callbackIdentity = `${clientId || ''}\u0000${window.location.href}`;
  let hash = 2_166_136_261;

  for (let index = 0; index < callbackIdentity.length; index += 1) {
    hash ^= callbackIdentity.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }

  return (hash >>> 0).toString(36);
}

function getCallbackCompletion(
  key: string,
  completeAuthorization: () => Promise<OAuthTokenResponse>,
): Promise<OAuthTokenResponse> {
  const existing = callbackCompletions.get(key);
  if (existing) {
    return existing.result;
  }

  const result = Promise.resolve().then(completeAuthorization);
  callbackCompletions.set(key, { result });

  const scheduleSettledCompletionExpiry = () => {
    const completion = callbackCompletions.get(key);
    if (!completion || completion.result !== result) {
      return;
    }

    completion.timeoutId = setTimeout(() => {
      if (callbackCompletions.get(key)?.result === result) {
        callbackCompletions.delete(key);
      }
    }, CALLBACK_COMPLETION_TTL_MS);
  };

  // A pending code exchange stays deduplicated; only abandoned settled entries expire.
  void result.then(scheduleSettledCompletionExpiry, scheduleSettledCompletionExpiry);
  return result;
}

function dismissCallbackCompletion(key: string) {
  const completion = callbackCompletions.get(key);
  if (!completion) {
    return;
  }

  if (completion.timeoutId !== undefined) {
    clearTimeout(completion.timeoutId);
  }
  callbackCompletions.delete(key);
}

export const AuthProvider: React.FC<AuthProviderProps> = ({
  children,
  config,
  pkceClient = defaultPkceClient,
  sdkFactory = defaultSdkFactory,
}) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sdk, setSdk] = useState<UiPath>(() => sdkFactory(config));
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);
  const [currentUserName, setCurrentUserName] = useState<string | null>(null);
  const authGenerationRef = useRef(0);

  useEffect(() => {
    let active = true;
    const generation = ++authGenerationRef.current;
    const isCurrent = () => active && generation === authGenerationRef.current;

    const setAuthenticationState = (authenticated: boolean) => {
      setIsAuthenticated(authenticated);
      setCurrentUserEmail(null);
      setCurrentUserName(authenticated ? AUTHENTICATED_USER_NAME : null);
    };

    const failAuthentication = () => {
      if (!isCurrent()) {
        return;
      }

      setError('Authentication failed');
      setAuthenticationState(false);
    };

    const initializeAuth = async () => {
      setIsLoading(true);
      setError(null);

      let activeSdk = sdk;

      if (pkceClient.isCallback()) {
        const publicOAuthConfig = getPublicOAuthConfig(config);
        const callbackKey = getCallbackCompletionKey(config.clientId);
        let token: OAuthTokenResponse;
        try {
          token = await getCallbackCompletion(
            callbackKey,
            () => pkceClient.completeAuthorization(publicOAuthConfig),
          );

          if (!isCurrent()) {
            return;
          }

          pkceClient.storeToken(publicOAuthConfig.clientId, token);
        } catch {
          if (!isCurrent()) {
            return;
          }

          clearOAuthSession(config.clientId);
          pkceClient.clear(config.clientId);
          removeOAuthCallbackParameters();
          dismissCallbackCompletion(callbackKey);
          failAuthentication();
          setIsLoading(false);
          return;
        }

        removeOAuthCallbackParameters();
        dismissCallbackCompletion(callbackKey);
        activeSdk = sdkFactory(config);
        setSdk(activeSdk);
      }

      if (!isCurrent()) {
        return;
      }

      try {
        setAuthenticationState(activeSdk.isAuthenticated());
      } catch {
        failAuthentication();
      } finally {
        if (isCurrent()) {
          setIsLoading(false);
        }
      }
    };

    void initializeAuth();

    return () => {
      active = false;
    };
  }, [config, pkceClient, sdk, sdkFactory]);

  const login = async () => {
    const generation = ++authGenerationRef.current;
    setIsLoading(true);
    setError(null);

    try {
      await pkceClient.startAuthorization(getPublicOAuthConfig(config));
      if (generation !== authGenerationRef.current) {
        return;
      }

      const authenticated = sdk.isAuthenticated();
      setIsAuthenticated(authenticated);
      setCurrentUserEmail(null);
      setCurrentUserName(authenticated ? AUTHENTICATED_USER_NAME : null);
    } catch {
      if (generation !== authGenerationRef.current) {
        return;
      }

      setError('Login failed');
      setIsAuthenticated(false);
      setCurrentUserEmail(null);
      setCurrentUserName(null);
    } finally {
      if (generation === authGenerationRef.current) {
        setIsLoading(false);
      }
    }
  };

  const logout = () => {
    authGenerationRef.current += 1;
    clearOAuthSession(config.clientId);
    pkceClient.clear(config.clientId);
    removeOAuthCallbackParameters();

    setIsAuthenticated(false);
    setError(null);
    setCurrentUserEmail(null);
    setCurrentUserName(null);
    setSdk(sdkFactory(config));
  };

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        isLoading,
        sdk,
        currentUserEmail,
        currentUserName,
        login,
        logout,
        error,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const useOptionalAuth = () => useContext(AuthContext);
