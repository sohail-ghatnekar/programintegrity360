import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { UiPath } from '@uipath/uipath-typescript/core';
import type { UiPathSDKConfig } from '@uipath/uipath-typescript/core';

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

type AuthProviderProps = {
  children: ReactNode;
  config: UiPathSDKConfig;
  sdkFactory?: SdkFactory;
};

type CallbackCompletion = {
  result: Promise<boolean>;
  timeoutId: ReturnType<typeof setTimeout>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const defaultSdkFactory: SdkFactory = (config) => new UiPath(config);
const CALLBACK_COMPLETION_TTL_MS = 60_000;
const callbackCompletions = new Map<string, CallbackCompletion>();

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

function getCallbackCompletion(key: string, callbackSdk: UiPath): Promise<boolean> {
  const existing = callbackCompletions.get(key);
  if (existing) {
    return existing.result;
  }

  const result = Promise.resolve().then(() => callbackSdk.completeOAuth());
  const timeoutId = setTimeout(() => {
    const completion = callbackCompletions.get(key);
    if (completion?.result === result) {
      callbackCompletions.delete(key);
    }
  }, CALLBACK_COMPLETION_TTL_MS);

  callbackCompletions.set(key, { result, timeoutId });
  return result;
}

function dismissCallbackCompletion(key: string) {
  const completion = callbackCompletions.get(key);
  if (!completion) {
    return;
  }

  clearTimeout(completion.timeoutId);
  callbackCompletions.delete(key);
}

export const AuthProvider: React.FC<AuthProviderProps> = ({
  children,
  config,
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

      if (sdk.isInOAuthCallback()) {
        const callbackKey = getCallbackCompletionKey(config.clientId);
        let completed: boolean;
        try {
          completed = await getCallbackCompletion(callbackKey, sdk);
        } catch {
          if (!isCurrent()) {
            return;
          }

          clearOAuthSession(config.clientId);
          dismissCallbackCompletion(callbackKey);
          failAuthentication();
          setIsLoading(false);
          return;
        }

        if (!completed) {
          if (!isCurrent()) {
            return;
          }

          clearOAuthSession(config.clientId);
          dismissCallbackCompletion(callbackKey);
          failAuthentication();
          setIsLoading(false);
          return;
        }

        if (!isCurrent()) {
          return;
        }

        removeOAuthCallbackParameters();
        dismissCallbackCompletion(callbackKey);
      }

      if (!isCurrent()) {
        return;
      }

      try {
        setAuthenticationState(sdk.isAuthenticated());
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
  }, [config.clientId, sdk]);

  const login = async () => {
    const generation = ++authGenerationRef.current;
    setIsLoading(true);
    setError(null);

    try {
      await sdk.initialize();
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
