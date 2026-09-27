#!/usr/bin/env node
/**
 * Pass 4: writeBatch unwrap + remaining onAuthStateChanged public pages + getDocs(collection(db remaining).
 * Targets:
 *   - const batch = writeBatch(db); ... batch.set/update/delete(ref, data); ... await batch.commit();
 *       → const ops: BatchOp[] = []; ... ops.push({type, table, id, data}); ... await sbRunBatch(ops);
 */

const fs = require('fs');
const path = require('path');

const DRY_RUN = process.argv.includes('--dry-run');
const TARGET_ARG_IDX = process.argv.findIndex(a => a === '--target');
const TARGET = TARGET_ARG_IDX >= 0 ? process.argv[TARGET_ARG_IDX + 1] : 'src';

const PROJECT_ROOT = process.cwd();
const ROOT = path.join(PROJECT_ROOT, TARGET);

const EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx']);
const EXCLUDE_DIRS = new Set(['node_modules', '.next', '.git', '.agents', '.husky', 'dist', 'build', 'out', 'coverage', 'public']);
const STATS = { filesScanned: 0, modified: 0, replacements: 0, perFile: new Map() };

function walk(dir, out = []) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of entries) {
    if (EXCLUDE_DIRS.has(e.name)) continue;
    if (e.name.startsWith('.')) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.isFile() && EXTENSIONS.has(path.extname(e.name))) out.push(p);
  }
  return out;
}

function bumpRel(filePath, delta = 1) {
  const rel = path.relative(PROJECT_ROOT, filePath);
  STATS.perFile.set(rel, (STATS.perFile.get(rel) || 0) + delta);
  STATS.replacements += delta;
}

/**
 * Transform batches (non-nested, best-effort).
 * Pattern captured per batch block:
 *   const batch = writeBatch(db);
 *   [... lines with batch.set / batch.update / batch.delete ...]
 *   await batch.commit();
 *
 * We transform each batch.xxx call that uses a ref created by
 *   doc(db, 'TABLE', idExpr) or doc(collection(db, 'TABLE'))
 * into ops.push(...) form.
 */
function replaceWriteBatch(content, filePath) {
  // Find all batch blocks start + end indices (simple heuristic regex based)
  let result = content;
  // Match: (const|let) <batchVar> = writeBatch(db);  ...   await <batchVar>.commit();
  const blockRe = /(?:const|let)\s+(\w+)\s*=\s*writeBatch\s*\(\s*db\s*\)\s*;([\s\S]*?)await\s+\1\.commit\s*\(\s*\)\s*;?/g;
  let match;
  // We replace from end backwards so we don't mess up indices
  const matches = [];
  while ((match = blockRe.exec(content)) !== null) {
    matches.push({ start: match.index, end: match.index + match[0].length, whole: match[0], name: match[1], body: match[2] });
  }
  if (matches.length === 0) return { content, count: 0 };

  // Replace each match in reverse order
  let newContent = content;
  let count = matches.length;
  for (let i = matches.length - 1; i >= 0; i--) {
    const m = matches[i];
    const transformed = transformBatchBlock(m.whole, m.name, m.body);
    newContent = newContent.slice(0, m.start) + transformed + newContent.slice(m.end);
    bumpRel(filePath, countOps(transformed));
  }
  return { content: newContent, count: matches.length };
}

function countOps(s) {
  const c = (s.match(/ops\.push\(/g) || []).length;
  return c || 1;
}

/**
 * For each batch.set/update/delete(refArg, dataArg?, opts?) line inside body:
 *   - inspect refArg: it must be either doc(db, 'TABLE', idExpr) or doc(collection(db, 'TABLE')) or a variable.
 *     We try to resolve:
 *       refArg === doc(db, 'T', X) → { table: T, idExpr: X }
 *       refArg === doc(collection(db, 'T')) → { table: T, generateId: true }
 * If we can't resolve, we give up and return original block.
 */
function parseRef(refArgStr) {
  refArgStr = refArgStr.trim();
  let m = refArgStr.match(/^doc\s*\(\s*db\s*,\s*['"`]([^'"`]+)['"`]\s*,\s*([\s\S]+)\s*\)$/);
  if (m) return { table: m[1], idExpr: m[2].trim(), generateId: false };
  m = refArgStr.match(/^doc\s*\(\s*collection\s*\(\s*db\s*,\s*['"`]([^'"`]+)['"`]\s*\)\s*\)$/);
  if (m) return { table: m[1], idExpr: null, generateId: true };
  return null;
}

function transformBatchBlock(whole, batchVar, bodyStr) {
  const ops: Array<{ op: string; line: string }> = [];
  const bodyLines = [];
  const usedHelpers = new Set(['sbRunBatch']);
  const lines = bodyStr.split('\n');

  // Process each line inside the batch body
  let leftoverBody = '';
  const lineRe = new RegExp(`^([ \\t]*)${batchVar}\\.(set|update|delete)\\s*\\(`, '');
  for (const origLine of lines) {
    const lineMatch = origLine.match(lineRe);
    if (!lineMatch) { leftoverBody += origLine + '\n'; continue; }
    const indent = lineMatch[1];
    const method = lineMatch[2];
    // Parse call arguments up to the closing ')' at end (possibly with trailing semicolon/comments)
    // Extract just arguments substring
    const callOpenIdx = origLine.indexOf('(') + 1;
    // Find matching close paren (allow 1 nesting for doc(db, collection(db,)))
    let depth = 1;
    let i = callOpenIdx;
    while (i < origLine.length && depth > 0) {
      if (origLine[i] === '(') depth++;
      else if (origLine[i] === ')') depth--;
      if (depth === 0) break;
      i++;
    }
    const argsStr = origLine.slice(callOpenIdx, i);
    // Split args at top-level commas
    const args = splitTopLevelArgs(argsStr);
    if (args.length === 0) { leftoverBody += origLine + '\n'; continue; }

    const parsedRef = parseRef(args[0]);
    if (!parsedRef) {
      // Unknown ref — bail out by returning original whole
      return whole;
    }
    let op, table = parsedRef.table;
    let dataArg = args[1] ? args[1].trim() : '{}';

    if (method === 'update') {
      op = '{ type: \'update\'' +
           `, table: '${table}'` +
           `, id: ${parsedRef.idExpr}` +
           `, data: ${dataArg} }`;
    } else if (method === 'delete') {
      op = '{ type: \'delete\'' +
           `, table: '${table}'` +
           `, id: ${parsedRef.idExpr} }`;
    } else if (method === 'set') {
      if (parsedRef.generateId) {
        // We'll generate the ID inline via generateId helper
        const idExpr = `generateId('${table}')`;
        usedHelpers.add('generateId');
        op = '{ type: \'upsert\'' +
             `, table: '${table}'` +
             `, id: ${idExpr}` +
             `, data: ${dataArg} }`;
      } else {
        op = '{ type: \'upsert\'' +
             `, table: '${table}'` +
             `, id: ${parsedRef.idExpr}` +
             `, data: ${dataArg} }`;
      }
    }
    const newLine = `${indent}ops.push(${op});`;
    leftoverBody += newLine + '\n';
  }

  // Assemble output
  // First line (batch var declaration) → ops array declaration
  const firstLineRe = new RegExp(`^(?:const|let)\\s+${batchVar}\\s*=\\s*writeBatch\\s*\\(\\s*db\\s*\\)\\s*;`);
  const newFirstLine = 'const ops: import(\'@/lib/supabase-helpers\').BatchOp[] = [];';
  let output = '';
  // Header
  output += newFirstLine + leftoverBody.slice(0, -1); // strip last added newline from leftover
  output += `\n  await sbRunBatch(ops);`;
  usedHelpers.clear(); // don't track here; import rewrite pass handles later
  return output;
}

function splitTopLevelArgs(s) {
  const out = [];
  let cur = '';
  let depth = 0;
  let inStr = null;
  let prev = '';
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inStr) {
      cur += c;
      if (c === inStr && prev !== '\\') inStr = null;
    } else {
      if (c === '\'' || c === '"' || c === '`') { inStr = c; cur += c; }
      else if (c === '(' || c === '{' || c === '[') { depth++; cur += c; }
      else if (c === ')' || c === '}' || c === ']') { depth--; cur += c; }
      else if (c === ',' && depth === 0) { out.push(cur); cur = ''; }
      else cur += c;
    }
    prev = c;
  }
  if (cur.trim()) out.push(cur);
  return out;
}

/**
 * Remaining onAuthStateChanged for customer pages.
 * Pattern: onAuthStateChanged(auth, async (firebaseUser: any) => { ... });
 *   paired with const unsub = / const unsubscribe = / useEffect return cleanup.
 *
 * We rewrite with getUserAndRole + supabase.auth.onAuthStateChange as before,
 * but adapted to customer pages (no admin role checks).
 */
function replaceRemainingAuth(content) {
  let totalCount = 0;
  let c = content;

  // Pattern 1: const unsubX = onAuthStateChanged(auth, async (firebaseUser) => { body }, 1 error?);
  const re1 = /const\s+(\w+)\s*=\s*onAuthStateChanged\s*\(\s*auth\s*,\s*async\s*\(\s*(\w+)\s*(?::\s*any)?\s*\)\s*=>\s*\{([\s\S]*?)\}\s*\)\s*;?/g;
  c = c.replace(re1, (match, unsubVar, userVar, body) => {
    totalCount++;
    return rewriteAuthBlock(unsubVar, userVar, body);
  });

  return { content: c, count: totalCount };
}

function rewriteAuthBlock(unsubVar, userVar, originalBody) {
  return `const checkAuth_${unsubVar} = async () => {
  const { user: _user, userDocData } = await getUserAndRole();
  if (!_user) { /* consumer page guard optional */ }
  const ${userVar} = _user ? { ..._user, uid: _user.id, photoURL: _user.photoURL, displayName: _user.displayName } : null;
  const userDoc = { exists: () => !!userDocData, data: () => userDocData, id: _user?.id || '' };
${indentBody(originalBody, '  ')}
  };
  checkAuth_${unsubVar}();
  const ${unsubVar}_tmp = await supabase.auth.onAuthStateChange(() => { checkAuth_${unsubVar}(); });
  const ${unsubVar} = () => ${unsubVar}_tmp.data.subscription.unsubscribe();
  void ${unsubVar};`;
}

function indentBody(body, indent) {
  return body.split('\n').map(l => indent + l).join('\n');
}

/**
 * Add sbRunBatch + BatchOp imports if newly used; also ensure getUserAndRole/supabase import where we applied remaining auth rewrite.
 */
function rewriteImports(content) {
  const needHelpers = new Set<string>();
  if (/sbRunBatch\s*\(/.test(content)) { needHelpers.add('sbRunBatch'); needHelpers.add('generateId'); }
  if (/checkAuth_.*getUserAndRole\s*\(/.test(content) || /getUserAndRole\s*\(/.test(content)) needHelpers.add('getUserAndRole');
  if (/\bgenerateId\s*\(/.test(content) && /from ['"]@\/lib\/supabase-helpers['"]/.test(content) === false) needHelpers.add('generateId');

  const needsSupabaseAuth = /supabase\.auth\.onAuthStateChange/.test(content);

  let result = content;
  let modified = false;

  if (needHelpers.size > 0) {
    const existing = result.match(/import\s*\{([^}]*)\}\s*from\s*['"]@\/lib\/supabase-helpers['"]\s*;?/s);
    const arr = [...needHelpers].sort();
    if (existing) {
      const current = existing[1].split(',').map(s => s.trim()).filter(Boolean);
      const combined = [...new Set([...current, ...arr])].sort();
      if (combined.length > current.length) {
        result = result.replace(existing[0], `import { ${combined.join(', ')} } from '@/lib/supabase-helpers';`);
        modified = true;
      }
    } else {
      const insertBefore = result.match(/(import\s*\{[^}]*\}\s*from\s*['"]@\/lib\/firebase['"]\s*;?)/s)
        || result.match(/(import\s*\{[^}]*\}\s*from\s*['"]@\/lib\/supabase['"]\s*;?)/s);
      if (insertBefore) {
        result = result.replace(insertBefore[0], `import { ${arr.join(', ')} } from '@/lib/supabase-helpers';\n${insertBefore[0]}`);
      } else {
        result = `import { ${arr.join(', ')} } from '@/lib/supabase-helpers';\n` + result;
      }
      modified = true;
    }
  }

  if (needsSupabaseAuth && !/from ['"]@\/lib\/supabase['"]/.test(result)) {
    result = `import { supabase } from '@/lib/supabase';\n` + result;
    modified = true;
  }

  // Remove unused writeBatch/db/doc/collection from firebase import if possible
  const fbMatch = result.match(/import\s*\{([^}]*)\}\s*from\s*['"]@\/lib\/firebase['"]\s*;?/s);
  if (fbMatch) {
    const rest = result.replace(fbMatch[0], '');
    const imports = fbMatch[1].split(',').map(s => s.trim()).filter(Boolean);
    const keepers = imports.filter(imp => {
      if (imp === 'writeBatch' || imp === 'db' || imp === 'doc' || imp === 'collection' || imp === 'auth' || imp === 'onAuthStateChanged') {
        const re = new RegExp(`(?:^|[^A-Za-z0-9_])${imp}(?:[^A-Za-z0-9_]|$)`, 'm');
        return re.test(rest);
      }
      return true;
    });
    if (keepers.length === 0) {
      result = result.replace(fbMatch[0] + '\n?', '');
      modified = true;
    } else if (keepers.length < imports.length) {
      result = result.replace(fbMatch[0], `import { ${keepers.join(', ')} } from '@/lib/firebase';`);
      modified = true;
    }
  }

  return { content: result, modified };
}

function processFile(filePath) {
  STATS.filesScanned++;
  let original;
  try { original = fs.readFileSync(filePath, 'utf8'); } catch { return; }
  if (!/from\s+['"]@\/lib\/firebase['"]/.test(original)) return;

  let c = original;
  let total = 0;

  const wb = replaceWriteBatch(c, filePath);
  c = wb.content; total += wb.count;

  const ra = replaceRemainingAuth(c);
  c = ra.content; total += ra.count;

  const imp = rewriteImports(c);
  c = imp.content;

  if (c !== original) {
    STATS.modified++;
    const rel = path.relative(PROJECT_ROOT, filePath);
    console.log(`  ${DRY_RUN ? '[DRY]' : '[OK]  '} ${rel}`);
    if (!DRY_RUN) fs.writeFileSync(filePath, c, 'utf8');
  }
}

function main() {
  console.log(`\n🌀 Pass 4: writeBatch + remaining auth + import cleanup\n`);
  console.log(`   Target: ${TARGET}`);
  console.log(`   Mode:   ${DRY_RUN ? 'DRY RUN' : 'WRITE MODE'}\n`);
  const files = walk(ROOT);
  console.log(`🔍 Scanning ${files.length} files...\n`);
  for (const f of files) processFile(f);
  console.log(`\n📊 Pass 4 Summary: scanned=${STATS.filesScanned} modified=${STATS.modified} blocks_transformed=${STATS.replacements}`);
}
main();
