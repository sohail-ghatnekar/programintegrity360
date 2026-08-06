import fs from 'node:fs';
import path from 'node:path';

const distIndexPath = path.resolve('dist/index.html');

if (!fs.existsSync(distIndexPath)) {
  console.error(`dist index not found: ${distIndexPath}`);
  process.exit(1);
}

const html = fs.readFileSync(distIndexPath, 'utf8');
const scriptMatch = html.match(/<script type="module" crossorigin src="([^"]+)"><\/script>/);
const styleMatch = html.match(/<link rel="stylesheet" crossorigin href="([^"]+)">/);
const faviconMatch = html.match(/<link rel="icon" type="image\/png" href="([^"]+)" \/>/);

if (!scriptMatch || !styleMatch) {
  console.error('Failed to locate built asset references in dist/index.html');
  process.exit(1);
}

const entryScriptPath = normalizeAssetPath(scriptMatch[1]);
const entryStylePath = normalizeAssetPath(styleMatch[1]);
const faviconPath = faviconMatch ? normalizeAssetPath(faviconMatch[1]) : null;

const bootstrap = [
  '<script>',
  '  (function () {',
  "    const meta = document.querySelector('meta[name=\"uipath:cdn-base\"]');",
  "    const cdnBase = meta?.getAttribute('content')?.replace(/\\/$/, '') || '';",
  `    const scriptPath = ${JSON.stringify(entryScriptPath)};`,
  `    const stylePath = ${JSON.stringify(entryStylePath)};`,
  `    const faviconPath = ${JSON.stringify(faviconPath)};`,
  '',
  '    function resolveAssetUrl(assetPath) {',
  "      const normalizedPath = assetPath.replace(/^\\.\\//, '').replace(/^\\//, '');",
  "      return cdnBase ? `${cdnBase}/${normalizedPath}` : `./${normalizedPath}`;",
  '    }',
  '',
  '    if (faviconPath) {',
  "      const favicon = document.querySelector('link[rel=\"icon\"]');",
  '      if (favicon) {',
  '        favicon.href = resolveAssetUrl(faviconPath);',
  '      }',
  '    }',
  '',
  "    const link = document.createElement('link');",
  "    link.rel = 'stylesheet';",
  '    link.crossOrigin = "";',
  '    link.href = resolveAssetUrl(stylePath);',
  '    document.head.appendChild(link);',
  '',
  "    const script = document.createElement('script');",
  "    script.type = 'module';",
  '    script.crossOrigin = "";',
  '    script.src = resolveAssetUrl(scriptPath);',
  '    document.head.appendChild(script);',
  '  })();',
  '</script>',
].join('\n');

const updatedHtml = html
  .replace(/<link rel="icon" type="image\/png" href="[^"]+" \/>/, '<link rel="icon" type="image/png" href="" />')
  .replace(/<script type="module" crossorigin src="[^"]+"><\/script>\n?/, '')
  .replace(/<link rel="stylesheet" crossorigin href="[^"]+">\n?/, '')
  .replace('</head>', `${bootstrap}\n  </head>`);

fs.writeFileSync(distIndexPath, updatedHtml);

function normalizeAssetPath(assetPath) {
  return assetPath.replace(/^\.\//, '');
}
