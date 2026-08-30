import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const roots = ['app', 'README.md'];
const files = [];
function walk(path) {
  const stat = statSync(path);
  if (stat.isDirectory()) for (const child of readdirSync(path)) walk(join(path, child));
  else if (/\.(js|jsx|ts|tsx|md|css)$/.test(path)) files.push(path);
}
for (const root of roots) walk(root);
const violations = [];
for (const file of files) {
  const source = readFileSync(file, 'utf8');
  if (/\bVAANI\b|vaani\.gov/i.test(source)) violations.push(`${file}: legacy product branding`);
  if (/\s—\s/.test(source)) violations.push(`${file}: em dash in visible copy`);
}
if (violations.length) { console.error(violations.join('\n')); process.exit(1); }
console.log(`Brand audit passed for ${files.length} UI files.`);
