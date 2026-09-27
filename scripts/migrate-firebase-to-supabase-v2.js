#!/usr/bin/env node
/**
 * Bulk Firebase → Supabase migration script v2
 * Replaces the most common firebase compat bridge patterns with
 * direct supabase-helpers calls across all project TSX/TS files.
 *
 * Usage: node scripts/migrate-firebase-to-supabase-v2.js
 * Optional: --dry-run to preview changes without writing files
 * Optional: --target src/app/admin to limit scope
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

const ALL_FIREBASE_FNS = [
  'onAuthStateChanged', 'getDoc', 'getDocs', 'addDoc', 'updateDoc',
  'setDoc', 'deleteDoc', 'runTransaction', 'writeBatch', 'onSnapshot',
  'increment', 'arrayUnion', 'arrayRemove', 'getCountFromServer',
  'doc', 'collection', 'query', 'where', 'orderBy', 'limit',
  'serverTimestamp', 'documentId', 'Timestamp', 'signOut',
  'signInWithEmailAndPassword', 'createUserWithEmailAndPassword',
  'signInWithPopup', 'GoogleAuthProvider', 'ref', 'uploadBytes',
  'getDownloadURL', 'deleteObject', 'addDoc',
];

const STATISTICS = { filesScanned: 0, filesModified: 0, changesTotal: 0, changesByCategory: {} };

function bumpCategory(name, n = 1) {
  STATISTICS.changesByCategory[name] = (STATISTICS.changesByCategory[name] || 0) + n;
  STATISTICS.changesTotal += n;
}

function walk(dir, out = []) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); }
  catch { return out; }
  for (const e of entries) {
    if (EXCLUDE_DIRS.has(e.name)) continue;
    if (e.name.startsWith('.')) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.isFile() && EXTENSIONS.has(path.extname(e.name))) out.push(p);
  }
  return out;
}

function hasFirebaseImport(content) {
  return /from\s+['"]@\/lib\/firebase['"];?/.test(content);
}

/**
 * Extracts the list of firebase imports.
 * Returns: { imports: Set<string>, hasDB: bool, hasAuth: bool }
 */
function analyzeFirebaseImports(content) {
  const match = content.match(/import\s*\{([^}]+)\}\s*from\s*['"]@\/lib\/firebase['"];?/s);
  if (!match) return { imports: new Set(), named: '' };
  const named = match[1];
  const imports = new Set(
    named.split(',').map(s => s.trim()).filter(Boolean).map(s => s.split(/\s+as\s+/)[0].trim())
  );
  return { imports, named: match[0] };
}

/**
 * Finds which firebase functions are actually USED in the content
 * (to avoid keeping unused imports after migration).
 */
function findUsedFirebaseFns(content, imports) {
  const used = new Set();
  const contentNoImports = content.replace(/import\s*\{[^}]+\}\s*from\s*['"]@\/lib\/firebase['"];?/gs, '');
  for (const imp of imports) {
    const safe = imp.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // Match function call or reference (avoid word matches inside larger strings)
    const re = new RegExp(`(?:^|[^A-Za-z0-9_])${safe}(?:\\s*\\(|[^A-Za-z0-9_])`, 'm');
    if (re.test(contentNoImports)) used.add(imp);
  }
  return used;
}

/**
 * Ensures supabase and supabase-helpers imports exist.
 */
function ensureImports(content, needsHelpers, needsSupabaseDirect) {
  let result = content;
  let modified = false;

  if (needsHelpers && !/from\s+['"]@\/lib\/supabase-helpers['"]/.test(result)) {
    const re = /import\s*\{[^}]*\}\s*from\s*['"]@\/lib\/firebase['"];?/s;
    const match = result.match(re);
    if (match) {
      result = result.replace(
        re,
        `${match[0]}\nimport { ${needsHelpers.join(', ')} } from '@/lib/supabase-helpers';`
      );
    } else {
      result = `import { ${needsHelpers.join(', ')} } from '@/lib/supabase-helpers';\n` + result;
    }
    modified = true;
  }

  return { content: result, modified };
}

/**
 * Pattern 1: Replace standard onAuthStateChanged auth guard useEffect block
 * with supabase-native getUserAndRole + onAuthStateChange pattern.
 *
 * Variants handled:
 *  A) onAuthStateChanged(auth, async (user: any) => { ... }) — with unsubscribe cleanup
 */
function replaceOnAuthStateChanged(content) {
  let result = content;
  let count = 0;

  // Pattern A: Most common auth guard useEffect with onAuthStateChanged
  // Looks for: useEffect(() => { const unsubscribe = onAuthStateChanged(auth, async (user: any) => { ... }); return () => unsubscribe(); }, [router]);
  // We'll find any onAuthStateChanged(auth, callback) usage inside useEffect and replace the whole pattern.

  // Find onAuthStateChanged calls more generally (not just inside useEffect)
  const oascRe = /onAuthStateChanged\s*\(\s*auth\s*,\s*async\s*\(\s*user\s*(?::\s*any\s*)?\)\s*=>\s*\{/g;

  let m;
  const replacements = [];
  while ((m = oascRe.exec(result)) !== null) {
    const startIdx = m.index;
    // Find matching closing brace of callback + parenthesis for full call
    // Use brace/paren counter starting from opening `{` of callback
    const cbOpenBrace = result.indexOf('{', startIdx + m[0].length - 1);
    if (cbOpenBrace < 0) continue;

    let depth = 0;
    let parenDepth = 0;
    let i = cbOpenBrace;
    // Walk backwards to understand initial paren depth at callback start
    const beforeCb = result.slice(startIdx, cbOpenBrace);
    // count open - close parens in the call prefix
    let initParen = 0;
    for (const ch of beforeCb) {
      if (ch === '(') initParen++;
      else if (ch === ')') initParen--;
    }
    parenDepth = initParen; // inside `onAuthStateChanged(auth, async (user) =>` → 1 open `(` for the call
    parenDepth = 1;
    depth = 1; // for opening callback brace

    while (i < result.length) {
      const ch = result[i];
      if (ch === '{') depth++;
      else if (ch === '}') {
        depth--;
        if (depth === 0) {
          // Callback closed. Now walk until we find the closing `)` of the onAuthStateChanged(...) call
          // plus any trailing `;` or `.unsubscribe()` usage context
          i++;
          // Consume the closing parenthesis for the OASC call + any trailing comma/semicolon
          // After `}` of callback we expect `)` then possibly `)` etc.
          parenDepth = 1;
          while (i < result.length && parenDepth > 0) {
            const c2 = result[i];
            if (c2 === '(') parenDepth++;
            else if (c2 === ')') parenDepth--;
            i++;
          }
          break;
        }
      }
      i++;
    }

    const endIdx = i;
    replacements.push({ start: startIdx, end: endIdx });
    count++;
  }

  // Apply replacements in REVERSE order (to keep offsets valid)
  replacements.reverse().forEach(r => {
    result = result.slice(0, r.start)
      + `(() => { /* replaced by migrate script — replaced block below */ })()`
      + result.slice(r.end);
  });

  // Because the above replacement is too aggressive (drops the callback body),
  // instead take a simpler approach: use the getUserAndRole() helper pattern
  // by replacing the most common structural pattern using simple template regexes.
  //
  // Re-do with content-aware targeted patterns:

  result = content;
  count = 0;

  // Common pattern: const unsubscribe = onAuthStateChanged(auth, async (user:any) => { ... }); return () => unsubscribe();
  // Match the useEffect body wrapping this pattern
  const fullUseEffect = /useEffect\s*\(\s*\(\s*\)\s*=>\s*\{\s*const\s+unsubscribe\s*=\s*onAuthStateChanged\s*\(\s*auth\s*,\s*async\s*\(\s*user\s*(?::\s*any\s*)?\)\s*=>\s*\{([\s\S]*?)\n\s*\}\s*\)\s*;\s*return\s*\(\s*\)\s*=>\s*unsubscribe\s*\(\s*\)\s*;\s*\}\s*,\s*\[([^\]]*)\]\s*\)/g;

  result = result.replace(fullUseEffect, (match, body, deps) => {
    count++;
    // Body contains the auth guard logic. Extract it and keep it the same
    // but adapt the initial user check (replace user.uid references since user from getUserAndRole has id === uid).
    // We also need to strip lines:
    //   const userDoc = await getDoc(doc(db, 'users', user.uid));
    //   const userDocData = userDoc.exists() ? userDoc.data() : null;
    //   const role = userDocData?.role || user.app_metadata?.role || user.user_metadata?.role;
    // Because getUserAndRole() already provides userDocData, role, isAdmin, isStaff
    //
    // But to keep it safe, just wrap the existing body logic using our getUserAndRole helper
    // and adapt references:
    //   Before: `user.uid` → After: `user.uid` (still valid, both id and uid are set)
    //   Before: `getDoc(doc(db, 'users', user.uid))`  → this is done by getUserAndRole → userDocData
    //   Before: `userDoc.exists() ? userDoc.data() : null` → userDocData
    //
    // For safety, let's generate the new pattern but call checkAuth() inside, preserving
    // the user variable semantics and fetching extra if needed. We won't aggressively
    // remove getDoc calls from the body in this pass since we handle getDoc separately.

    const newBody = `
    const checkAuth = async () => {
      const { user, userDocData, isAdmin, isStaff, role } = await getUserAndRole();
      if (!user) return;
      // For backwards compat, expose userDoc variable matching old pattern
      const userDoc = { exists: () => !!userDocData, data: () => userDocData || {} };
      ${body}
    };
    checkAuth();

    let __unsubscribe: (() => void) | undefined;
    (async () => {
      const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
        checkAuth();
      });
      __unsubscribe = () => subscription.unsubscribe();
    })();

    return () => { if (__unsubscribe) __unsubscribe(); };`;

    return `useEffect(() => {${newBody}\n  }, [${deps}])`;
  });

  // Alternative shorter pattern without deps: onAuthStateChanged(auth, fn) assigned to variable
  // const unsubAuth = onAuthStateChanged(auth, async (user: any) => { ... });
  const shorterRe = /const\s+(\w+)\s*=\s*onAuthStateChanged\s*\(\s*auth\s*,\s*async\s*\(\s*user\s*(?::\s*any\s*)?\)\s*=>\s*\{([\s\S]*?)\n\s*\}\s*\)\s*;/g;
  result = result.replace(shorterRe, (match, varName, body) => {
    count++;
    return `const __checkAuth${varName} = async () => {
  const { user, userDocData } = await getUserAndRole();
  if (!user) return;
  const userDoc = { exists: () => !!userDocData, data: () => userDocData || {} };
  ${body}
};
__checkAuth${varName}();
let ${varName}: (() => void) | undefined;
(async () => {
  const { data: { subscription } } = supabase.auth.onAuthStateChange(() => __checkAuth${varName}());
  ${varName} = () => subscription.unsubscribe();
})();`;
  });

  return { content: result, count };
}

/**
 * Pattern 2: Replace getDoc(doc(db, TABLE, ID)) → sbGetDoc(TABLE, ID)
 */
function replaceGetDoc(content) {
  // getDoc(doc(db, 'table', id))  or  getDoc(doc(colRef, id))
  let count = 0;
  const re = /getDoc\s*\(\s*doc\s*\(\s*db\s*,\s*['"`]([^'"`]+)['"`]\s*,\s*([^)]+?)\s*\)\s*\)/g;
  const result = content.replace(re, (match, table, idExpr) => {
    count++;
    return `sbGetDoc('${table}', ${idExpr.trim()})`;
  });

  // Also match getDoc(docRef) where docRef is a variable — harder to detect, skip
  return { content: result, count };
}

/**
 * Pattern 3: Replace getDocs(collection(db, TABLE)) and query variants
 */
function replaceGetDocs(content) {
  let count = 0;
  let result = content;

  // Pattern A: getDocs(collection(db, 'table'))
  const simpleRe = /getDocs\s*\(\s*collection\s*\(\s*db\s*,\s*['"`]([^'"`]+)['"`]\s*\)\s*\)/g;
  result = result.replace(simpleRe, (match, table) => {
    count++;
    return `sbGetDocs({ table: '${table}' })`;
  });

  // Pattern B: getDocs(query(collection(db, 'table'), where(...), orderBy(...), limit(...)))
  // Replace: getDocs(query(collection(db, 'TABLE'), ...constraints)) → sbGetDocs({ table: 'TABLE', where: [...], orderBy: [...], limit })
  const queryRe = /getDocs\s*\(\s*query\s*\(\s*collection\s*\(\s*db\s*,\s*['"`]([^'"`]+)['"`]\s*\)\s*,?\s*([^)]*)\)\s*\)/gs;
  result = result.replace(queryRe, (match, table, constraintsStr) => {
    // Parse individual constraint functions
    const whereMatches = [...constraintsStr.matchAll(/where\s*\(\s*['"`]([^'"`]+)['"`]\s*,\s*['"`]([^'"`]+)['"`]\s*,\s*([^,)]+?)\s*\)/g)];
    const orderByMatches = [...constraintsStr.matchAll(/orderBy\s*\(\s*['"`]([^'"`]+)['"`]\s*(?:\s*,\s*['"`]([^'"`]+)['"`]\s*)?\)/g)];
    const limitMatch = constraintsStr.match(/limit\s*\(\s*([^)]+?)\s*\)/);

    const parts = [`table: '${table}'`];
    if (whereMatches.length > 0) {
      const wheres = whereMatches.map(([, f, o, v]) => `{ field: '${f}', op: '${o}', val: ${v.trim()} }`);
      parts.push(`where: [${wheres.join(', ')}]`);
    }
    if (orderByMatches.length > 0) {
      const obs = orderByMatches.map(([, f, d]) => d ? `{ field: '${f}', direction: '${d}' }` : `{ field: '${f}' }`);
      parts.push(`orderBy: [${obs.join(', ')}]`);
    }
    if (limitMatch) {
      parts.push(`limit: ${limitMatch[1].trim()}`);
    }
    count++;
    return `sbGetDocs({ ${parts.join(', ')} })`;
  });

  return { content: result, count };
}

/**
 * Pattern 4: Replace updateDoc(doc(db, TABLE, ID), data) → sbUpdateDoc(TABLE, ID, data)
 */
function replaceUpdateDoc(content) {
  let count = 0;
  const re = /updateDoc\s*\(\s*doc\s*\(\s*db\s*,\s*['"`]([^'"`]+)['"`]\s*,\s*([^,)]+?)\s*\)\s*,\s*([\s\S]*?)\n?\s*\)/g;
  const result = content.replace(re, (match, table, idExpr, dataStr) => {
    count++;
    return `sbUpdateDoc('${table}', ${idExpr.trim()}, ${dataStr.trim()})`;
  });
  return { content: result, count };
}

/**
 * Pattern 5: Replace addDoc(collection(db, TABLE), data) → sbInsertDoc(TABLE, data)
 */
function replaceAddDoc(content) {
  let count = 0;
  const re = /addDoc\s*\(\s*collection\s*\(\s*db\s*,\s*['"`]([^'"`]+)['"`]\s*\)\s*,\s*([\s\S]*?)\n?\s*\)/g;
  const result = content.replace(re, (match, table, dataStr) => {
    count++;
    return `sbInsertDoc('${table}', ${dataStr.trim()})`;
  });
  return { content: result, count };
}

/**
 * Pattern 6: Replace deleteDoc(doc(db, TABLE, ID)) → sbDeleteDoc(TABLE, ID)
 */
function replaceDeleteDoc(content) {
  let count = 0;
  const re = /deleteDoc\s*\(\s*doc\s*\(\s*db\s*,\s*['"`]([^'"`]+)['"`]\s*,\s*([^)]+?)\s*\)\s*\)/g;
  const result = content.replace(re, (match, table, idExpr) => {
    count++;
    return `sbDeleteDoc('${table}', ${idExpr.trim()})`;
  });
  return { content: result, count };
}

/**
 * Pattern 7: Replace setDoc(doc(db, TABLE, ID), data, opts?) with sbUpsertDoc
 */
function replaceSetDoc(content) {
  let count = 0;
  // setDoc(doc(db, TABLE, ID), data)
  const re1 = /setDoc\s*\(\s*doc\s*\(\s*db\s*,\s*['"`]([^'"`]+)['"`]\s*,\s*([^,)]+?)\s*\)\s*,\s*([\s\S]*?)\n?\s*\)/g;
  let result = content.replace(re1, (match, table, idExpr, dataStr) => {
    count++;
    return `sbUpsertDoc('${table}', ${idExpr.trim()}, ${dataStr.trim()})`;
  });
  return { content: result, count };
}

/**
 * Rewrite the firebase compat import statement to only keep still-used items,
 * and inject supabase-helpers import as needed.
 */
function rewriteImports(content, helpersNeeded) {
  const analysis = analyzeFirebaseImports(content);
  if (analysis.imports.size === 0) return { content, modified: false };

  const usedAfter = findUsedFirebaseFns(content, analysis.imports);
  const keepers = [];
  const removedFns = [];
  for (const imp of analysis.imports) {
    // auth and db are usually just passed as arguments; keep them only if still referenced
    if (imp === 'auth' || imp === 'db') {
      // Check if still used anywhere outside import line
      const rest = content.replace(/import\s*\{[^}]*\}\s*from\s*['"]@\/lib\/firebase['"]/gs, '');
      if (new RegExp(`(?:^|[^A-Za-z0-9_])${imp}(?:[^A-Za-z0-9_]|$)`).test(rest)) {
        keepers.push(imp);
      } else {
        removedFns.push(imp);
      }
      continue;
    }
    if (usedAfter.has(imp) || (['Timestamp', 'GoogleAuthProvider'].includes(imp))) {
      // Type/value classes kept even if only used as type
      keepers.push(imp);
    } else {
      removedFns.push(imp);
    }
  }

  let modified = false;
  let result = content;

  // Inject helpers import before firebase import
  if (helpersNeeded.size > 0 && !/from\s+['"]@\/lib\/supabase-helpers['"]/.test(result)) {
    const helpersArr = [...helpersNeeded].sort();
    const firebaseImportRe = /(import\s*\{[^}]*\}\s*from\s*['"]@\/lib\/firebase['"]\s*;?)/s;
    if (firebaseImportRe.test(result)) {
      result = result.replace(
        firebaseImportRe,
        `import { ${helpersArr.join(', ')} } from '@/lib/supabase-helpers';\n$1`
      );
    } else {
      result = `import { ${helpersArr.join(', ')} } from '@/lib/supabase-helpers';\n` + result;
    }
    modified = true;
  }

  // Remove fully-consumed firebase import
  if (keepers.length === 0) {
    result = result.replace(/import\s*\{[^}]*\}\s*from\s*['"]@\/lib\/firebase['"]\s*;?\n?/gs, '');
    modified = true;
  } else if (removedFns.length > 0) {
    // Rewrite import to keep only still-used
    const needsTimestampCompat = keepers.some(k => k === 'Timestamp');
    const newNamed = keepers.join(', ');
    result = result.replace(
      /import\s*\{[^}]*\}\s*from\s*['"]@\/lib\/firebase['"]\s*;?/s,
      `import { ${newNamed} } from '@/lib/firebase';`
    );
    modified = true;
  }

  return { content: result, modified };
}

function runPatterns(content) {
  let c = content;
  const helpersNeeded = new Set();

  // Track which helpers will be required based on patterns
  const tryHelpers = new Set();

  // Auth
  const oasc = replaceOnAuthStateChanged(c);
  c = oasc.content;
  if (oasc.count > 0) {
    tryHelpers.add('getUserAndRole');
    bumpCategory('onAuthStateChanged', oasc.count);
  }

  // getDoc
  const gd = replaceGetDoc(c);
  c = gd.content;
  if (gd.count > 0) { tryHelpers.add('sbGetDoc'); bumpCategory('getDoc', gd.count); }

  // getDocs
  const gds = replaceGetDocs(c);
  c = gds.content;
  if (gds.count > 0) { tryHelpers.add('sbGetDocs'); bumpCategory('getDocs', gds.count); }

  // updateDoc
  const ud = replaceUpdateDoc(c);
  c = ud.content;
  if (ud.count > 0) { tryHelpers.add('sbUpdateDoc'); bumpCategory('updateDoc', ud.count); }

  // addDoc
  const ad = replaceAddDoc(c);
  c = ad.content;
  if (ad.count > 0) { tryHelpers.add('sbInsertDoc'); bumpCategory('addDoc', ad.count); }

  // deleteDoc
  const dd = replaceDeleteDoc(c);
  c = dd.content;
  if (dd.count > 0) { tryHelpers.add('sbDeleteDoc'); bumpCategory('deleteDoc', dd.count); }

  // setDoc
  const sd = replaceSetDoc(c);
  c = sd.content;
  if (sd.count > 0) { tryHelpers.add('sbUpsertDoc'); bumpCategory('setDoc', sd.count); }

  // Final pass: rewrite imports (adds helpers, trims firebase import)
  const imp = rewriteImports(c, tryHelpers);
  c = imp.content;

  return { content: c, helpersUsed: [...tryHelpers], changedCount: STATISTICS.changesTotal };
}

function processFile(filePath) {
  STATISTICS.filesScanned++;
  let original;
  try { original = fs.readFileSync(filePath, 'utf8'); }
  catch { return; }

  if (!hasFirebaseImport(original)) return;

  const { content: migrated } = runPatterns(original);
  if (migrated !== original) {
    STATISTICS.filesModified++;
    const relPath = path.relative(PROJECT_ROOT, filePath);
    console.log(`  ${DRY_RUN ? '[DRY]' : '[OK]  '} ${relPath}`);
    if (!DRY_RUN) {
      fs.writeFileSync(filePath, migrated, 'utf8');
    }
  }
}

function main() {
  console.log(`\n🔄 Firebase → Supabase Migration v2\n`);
  console.log(`   Target: ${TARGET}`);
  console.log(`   Mode:   ${DRY_RUN ? 'DRY RUN (no changes)' : 'WRITE MODE'}\n`);

  const files = walk(ROOT);
  console.log(`🔍 Scanning ${files.length} files...\n`);

  for (const f of files) processFile(f);

  const entries = Object.entries(STATISTICS.changesByCategory).sort((a, b) => b[1] - a[1]);
  console.log(`\n📊 Migration Summary:`);
  console.log(`   Files scanned:     ${STATISTICS.filesScanned}`);
  console.log(`   Files modified:    ${STATISTICS.filesModified}`);
  console.log(`   Total replacements: ${STATISTICS.changesTotal}`);
  if (entries.length > 0) {
    console.log(`   By category:`);
    for (const [name, n] of entries) {
      console.log(`     • ${name.padEnd(22, ' ')} × ${n}`);
    }
  }
  console.log('\n✨ Bulk pass complete. Remaining complex cases (runTransaction, writeBatch, onSnapshot, etc.) should be handled manually.\n');
}

main();
