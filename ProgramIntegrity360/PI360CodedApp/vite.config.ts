import fs from 'node:fs';
import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

type Pi360RuntimeDefaults = {
  folderPath?: string;
  folderKey?: string;
  folderId?: number;
  caseProcessName?: string;
  recordAgentName?: string;
  entityIds?: Record<string, string>;
};

function readPi360RuntimeDefaults(rootDir: string): Pi360RuntimeDefaults {
  const configPath = path.join(rootDir, 'uipath.json');
  if (!fs.existsSync(configPath)) {
    return {};
  }

  try {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8')) as Pi360RuntimeDefaults;
    return {
      folderPath: config.folderPath,
      folderKey: config.folderKey,
      folderId: config.folderId,
      caseProcessName: config.caseProcessName,
      recordAgentName: config.recordAgentName,
      entityIds: config.entityIds,
    };
  } catch {
    return {};
  }
}

export default defineConfig({
  base: './',
  plugins: [react()],
  define: {
    global: 'globalThis',
    __PI360_RUNTIME_DEFAULTS__: JSON.stringify(readPi360RuntimeDefaults(process.cwd())),
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
  },
});
