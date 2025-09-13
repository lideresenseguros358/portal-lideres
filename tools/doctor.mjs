// tools/doctor.mjs
import fs from 'fs';
import path from 'path';

const ROOT = process.cwd();
const SRC_DIRS = ['lib', 'pages', 'components']; // ajusta si hace falta
const TS_EXT = new Set(['.ts', '.tsx', '.mts', '.cts']);

const problems = [];

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p);
    else if (TS_EXT.has(path.extname(entry.name))) files.push(p);
  }
}

function parseImports(code) {
  const out = [];
  const re =
    /import\s+(?:([\w*\s{},]+)\s+from\s+)?["']([^"']+)["'];?|export\s+{([^}]+)}\s+from\s+["']([^"']+)["'];?/g;
  let m;
  while ((m = re.exec(code))) {
    if (m[1]) out.push({ kind: 'import', spec: m[1].trim(), from: m[2] });
    else if (m[3]) out.push({ kind: 'reexport', spec: m[3].trim(), from: m[4] });
  }
  return out;
}

function readExports(file) {
  const code = fs.readFileSync(file, 'utf8');
  const names = new Set();
  const re =
    /export\s+(?:const|let|var|function|class|interface|type|enum)\s+([A-Za-z0-9_]+)/g;
  let m;
  while ((m = re.exec(code))) names.add(m[1]);
  // export { a, b as c }
  const re2 = /export\s*{\s*([^}]+)\s*}/g;
  while ((m = re2.exec(code))) {
    m[1]
      .split(',')
      .map((s) => s.trim())
      .forEach((s) => {
        const as = s.split(/\s+as\s+/i).map((x) => x.trim());
        names.add(as[1] || as[0]);
      });
  }
  return names;
}

function resolveImport(baseFile, from) {
  if (from.startsWith('.') || from.startsWith('/')) {
    const basedir = path.dirname(baseFile);
    const raw = path.resolve(basedir, from);
    const cand = [
      raw,
      raw + '.ts',
      raw + '.tsx',
      path.join(raw, 'index.ts'),
      path.join(raw, 'index.tsx'),
    ];
    for (const c of cand) if (fs.existsSync(c)) return c;
  }
  // alias @/lib -> ./lib
  if (from.startsWith('@/')) {
    const rel = from.replace(/^@\//, './');
    return resolveImport(baseFile, rel);
  }
  return null;
}

const files = [];
for (const d of SRC_DIRS) {
  const full = path.join(ROOT, d);
  if (fs.existsSync(full)) walk(full);
}

const exportCache = new Map();
function getExports(file) {
  if (!exportCache.has(file)) exportCache.set(file, readExports(file));
  return exportCache.get(file);
}

for (const f of files) {
  const code = fs.readFileSync(f, 'utf8');
  const imps = parseImports(code);
  for (const im of imps) {
    const target = resolveImport(f, im.from);
    if (!target) continue; // npm package o no resolvible
    const exps = getExports(target);
    // extrae cada specifier
    const specs = im.spec
      .split(',')
      .map((s) => s.trim())
      .flatMap((s) =>
        s
          .replace(/^{|}$/g, '')
          .split(',')
          .map((x) => x.trim())
      )
      .filter(Boolean);

    // normaliza as
    const named = specs
      .map((s) => s.replace(/\s+as\s+.*$/i, '').replace(/\* as\s+/i, '').trim())
      .filter((s) => s && s !== 'default' && s !== '*');

    for (const n of named) {
      if (!exps.has(n)) {
        problems.push({
          file: f,
          importFrom: im.from,
          target,
          missing: n,
        });
      }
    }
  }
}

if (problems.length) {
  console.log('== ❌ Problemas de imports/exports detectados ==');
  for (const p of problems) {
    console.log(
      `• ${p.file}\n   importa { ${p.missing} } desde ${p.importFrom}\n   pero ${p.target} no lo exporta.`
    );
  }
  process.exitCode = 1;
} else {
  console.log('✅ Imports/exports coherentes.');
}
