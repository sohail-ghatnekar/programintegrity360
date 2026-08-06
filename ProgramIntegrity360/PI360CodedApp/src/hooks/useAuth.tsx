import React, { useState, useEffect, createContext, useContext } from 'react';
import type { ReactNode } from 'react';
import { UiPath, UiPathError } from '@uipath/uipath-typescript/core';
import type { UiPathSDKConfig } from '@uipath/uipath-typescript/core';

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

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const parts = token.split('.');
  if (parts.length < 2) {
    return null;
  }

  try {
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
    const json = atob(padded);
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function getCurrentUserProfile(clientId?: string): { email: string | null; name: string | null } {
  if (!clientId) {
    return { email: null, name: null };
  }

  const rawTokenEntry = sessionStorage.getItem(`uipath_sdk_user_token-${clientId}`);
  if (!rawTokenEntry) {
    return { email: null, name: null };
  }

  try {
    const parsedEntry = JSON.parse(rawTokenEntry) as {
      token?: string;
      id_token?: string;
      access_token?: string;
    };

    const payload = decodeJwtPayload(parsedEntry.token || parsedEntry.id_token || parsedEntry.access_token || '');
    const email = payload?.email || payload?.preferred_username || payload?.upn || payload?.unique_name;
    const firstName = typeof payload?.first_name === 'string' ? payload.first_name.trim() : '';
    const lastName = typeof payload?.last_name === 'string' ? payload.last_name.trim() : '';
    const combinedName = [firstName, lastName].filter(Boolean).join(' ').trim();
    const fallbackName = typeof payload?.name === 'string' ? payload.name : null;

    return {
      email: typeof email === 'string' ? email : null,
      name: combinedName || fallbackName,
    };
  } catch {
    return { email: null, name: null };
  }
}

function clearOAuthSession(clientId?: string) {
  if (!clientId) {
    return;
  }

  sessionStorage.removeItem(`uipath_sdk_user_token-${clientId}`);
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
  sdkFactory = (sdkConfig) => new UiPath(sdkConfig),
}) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sdk, setSdk] = useState<UiPath>(() => sdkFactory(config));
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);
  const [currentUserName, setCurrentUserName] = useState<string | null>(null);

  useEffect(() => {
    const initializeAuth = async () => {
      setIsLoading(true);
      setError(null);

      try {
        if (sdk.isInOAuthCallback()) {
          const completed = await sdk.completeOAuth();
          if (!completed) {
            clearOAuthSession(config.clientId);
            throw new Error('Invalid OAuth callback');
          }
          removeOAuthCallbackParameters();
        }
        setIsAuthenticated(sdk.isAuthenticated());
        const profile = getCurrentUserProfile(config.clientId);
        setCurrentUserEmail(profile.email);
        setCurrentUserName(profile.name);
      } catch (err) {
        setError(err instanceof UiPathError ? err.message : 'Authentication failed');
        setIsAuthenticated(false);
        setCurrentUserEmail(null);
        setCurrentUserName(null);
      } finally {
        setIsLoading(false);
      }
    };

    void initializeAuth();
  }, [sdk]);

  const login = async () => {
    setIsLoading(true);
    setError(null);

    try {
      await sdk.initialize();
      setIsAuthenticated(sdk.isAuthenticated());
      const profile = getCurrentUserProfile(config.clientId);
      setCurrentUserEmail(profile.email);
      setCurrentUserName(profile.name);
    } catch (err) {
      setError(err instanceof UiPathError ? err.message : 'Login failed');
      setIsAuthenticated(false);
      setCurrentUserEmail(null);
      setCurrentUserName(null);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
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
