// Script untuk migrasi Firebase imports ke lazy loading
const fs = require('fs');
const path = require('path');

// Direktori yang akan di-scan
const directories = [
  './src/app',
  './src/components',
  './src/lib',
  './src/hooks'
];

// Pattern untuk mendeteksi Firebase imports
const firebaseImportPatterns = [
  /import\s*\{[^}]*\}\s*from\s*['"]firebase\/app['"]/,
  /import\s*\{[^}]*\}\s*from\s*['"]firebase\/auth['"]/,
  /import\s*\{[^}]*\}\s*from\s*['"]firebase\/firestore['"]/,
  /import\s*\{[^}]*\}\s*from\s*['"]firebase\/storage['"]/,
  /import\s*\{[^}]*\}\s*from\s*['"]@\/lib\/firebase['"]/,
];

// Fungsi untuk memproses file
function processFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  let modified = false;
  let newContent = content;

  // Cek apakah file menggunakan Firebase imports
  const hasFirebaseImports = firebaseImportPatterns.some(pattern => 
    pattern.test(content)
  );

  if (!hasFirebaseImports) {
    return false;
  }

  console.log(`Processing: ${filePath}`);

  // Replace Firebase imports dengan lazy loading approach
  // Contoh: import { db } from '@/lib/firebase' -> import { getFirestoreDB } from '@/lib/firebase-lazy'
  newContent = newContent.replace(
    /import\s*\{[^}]*\}\s*from\s*['"]@\/lib\/firebase['"]/,
    'import { getFirestoreDB, getFirebaseAuth, getFirebaseStorage } from \'@/lib/firebase-lazy\''
  );

  // Replace penggunaan db, auth, storage langsung dengan function calls
  newContent = newContent.replace(/\bdb\b/g, 'await getFirestoreDB()');
  newContent = newContent.replace(/\bauth\b/g, 'await getFirebaseAuth()');
  newContent = newContent.replace(/\bstorage\b/g, 'await getFirebaseStorage()');

  // Tambahkan async jika diperlukan
  if (newContent.includes('await getFirestoreDB()') || 
      newContent.includes('await getFirebaseAuth()') || 
      newContent.includes('await getFirebaseStorage()')) {
    
    // Cari function declarations yang perlu ditambahkan async
    const functionRegex = /(export\s+)?(default\s+)?(async\s+)?function\s+(\w+)\s*\(/g;
    let match;
    
    while ((match = functionRegex.exec(newContent)) !== null) {
      const [fullMatch, exportKeyword, defaultKeyword, asyncKeyword, functionName] = match;
      if (!asyncKeyword && functionName) {
        // Tambahkan async keyword
        const newFunctionDecl = fullMatch.replace(
          `function ${functionName}`,
          `async function ${functionName}`
        );
        newContent = newContent.replace(fullMatch, newFunctionDecl);
        modified = true;
      }
    }
  }

  if (newContent !== content) {
    fs.writeFileSync(filePath, newContent, 'utf8');
    console.log(`✓ Updated: ${filePath}`);
    return true;
  }

  return false;
}

// Fungsi untuk scan semua file
function scanDirectory(dirPath) {
  let migratedCount = 0;
  
  try {
    const files = fs.readdirSync(dirPath);
    
    for (const file of files) {
      const fullPath = path.join(dirPath, file);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        migratedCount += scanDirectory(fullPath);
      } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
        if (processFile(fullPath)) {
          migratedCount++;
        }
      }
    }
  } catch (error) {
    console.error(`Error scanning directory ${dirPath}:`, error);
  }
  
  return migratedCount;
}

// Jalankan migrasi
console.log('Starting Firebase imports migration to lazy loading...\n');

let totalMigrated = 0;
directories.forEach(dir => {
  if (fs.existsSync(dir)) {
    totalMigrated += scanDirectory(dir);
  }
});

console.log(`\n✅ Migration completed! ${totalMigrated} files migrated to use Firebase lazy loading.`);
console.log('\n⚠️  IMPORTANT: Please review the migrated files manually to ensure:');
console.log('   - Async/await usage is correct');
console.log('   - Error handling is properly implemented');
console.log('   - No breaking changes in component logic');