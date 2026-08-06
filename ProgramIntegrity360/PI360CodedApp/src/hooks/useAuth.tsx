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
  sdk: UiPath;
  result: Promise<boolean>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const defaultSdkFactory: SdkFactory = (config) => new UiPath(config);

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
  const callbackCompletionRef = useRef<CallbackCompletion | null>(null);

  const getCallbackCompletion = (callbackSdk: UiPath): Promise<boolean> => {
    if (callbackCompletionRef.current?.sdk === callbackSdk) {
      return callbackCompletionRef.current.result;
    }

    const result = Promise.resolve().then(() => callbackSdk.completeOAuth());
    callbackCompletionRef.current = { sdk: callbackSdk, result };
    return result;
  };

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
        let completed: boolean;
        try {
          completed = await getCallbackCompletion(sdk);
        } catch {
          clearOAuthSession(config.clientId);
          failAuthentication();
          if (isCurrent()) {
            setIsLoading(false);
          }
          return;
        }

        if (!completed) {
          clearOAuthSession(config.clientId);
          failAuthentication();
          if (isCurrent()) {
            setIsLoading(false);
          }
          return;
        }

        if (!isCurrent()) {
          return;
        }

        removeOAuthCallbackParameters();
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
    callbackCompletionRef.current = null;
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
