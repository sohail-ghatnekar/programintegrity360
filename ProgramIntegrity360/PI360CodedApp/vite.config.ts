import fs from 'node:fs';
import path from 'node:path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

type UiPathDefaults = {
  clientId?: string;
  orgName?: string;
  tenantName?: string;
  baseUrl?: string;
  redirectUri?: string;
  scope?: string;
};

function readUiPathJson(rootDir: string): Partial<UiPathDefaults> {
  const configPath = path.join(rootDir, 'uipath.json');
  if (!fs.existsSync(configPath)) return {};

  try {
    return JSON.parse(fs.readFileSync(configPath, 'utf8')) as Partial<UiPathDefaults>;
  } catch {
    return {};
  }
}

function firstNonEmpty(...values: Array<string | undefined>): string | undefined {
  return values.find((value) => value && value.trim());
}

export default defineConfig(({ mode }) => {
  const rootDir = process.cwd();
  const env = loadEnv(mode, rootDir, '');
  const fileDefaults = readUiPathJson(rootDir);

  const defaults: UiPathDefaults = {
    clientId: firstNonEmpty(env.VITE_UIPATH_CLIENT_ID, env.UIPATH_CLIENT_ID, fileDefaults.clientId),
    orgName: firstNonEmpty(env.VITE_UIPATH_ORG_NAME, fileDefaults.orgName),
    tenantName: firstNonEmpty(env.VITE_UIPATH_TENANT_NAME, fileDefaults.tenantName),
    baseUrl: firstNonEmpty(env.VITE_UIPATH_BASE_URL, env.UIPATH_BASE_URL, fileDefaults.baseUrl),
    redirectUri: firstNonEmpty(env.VITE_UIPATH_REDIRECT_URI, fileDefaults.redirectUri),
    scope: firstNonEmpty(env.VITE_UIPATH_SCOPE, env.VITE_UIPATH_SCOPES, env.UIPATH_SCOPE, fileDefaults.scope),
  };

  const proxy = defaults.orgName && defaults.baseUrl
    ? {
        [`/${defaults.orgName}`]: {
          target: defaults.baseUrl,
          changeOrigin: true,
          secure: true,
        },
      }
    : undefined;

  return {
    base: './',
    plugins: [react()],
    define: {
      global: 'globalThis',
      __UIPATH_DEFAULTS__: JSON.stringify(defaults),
    },
    resolve: {
      alias: {
        path: 'path-browserify',
      },
    },
    optimizeDeps: {
      include: ['@uipath/uipath-typescript'],
    },
    server: {
      host: 'localhost',
      port: 5173,
      strictPort: true,
      proxy,
    },
  };
});
