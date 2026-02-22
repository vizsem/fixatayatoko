const fs = require('fs');
const path = require('path');

console.log('🚀 Fixing duplicate Firebase imports...\n');

// Files that need to be checked for duplicate imports
const filesToCheck = [
  'src/lib/excelHelper.ts',
  'src/app/vouchers/page.tsx',
  'src/app/profil/page.tsx',
  'src/app/profil/edit/page.tsx',
  'src/app/profil/login/page.tsx',
  'src/app/profil/logout/page.tsx',
  'src/app/profil/register/page.tsx',
  'src/app/cashier/page.tsx',
  'src/app/cashier/orders/[id]/page.tsx',
  'src/app/admin/promotions/page.tsx',
  'src/app/admin/inventory/stock-in/StockInFormInner.tsx'
];

function fixDuplicateImports(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      console.log(`❌ File not found: ${filePath}`);
      return false;
    }
    
    const content = fs.readFileSync(filePath, 'utf8');
    
    // Check if file has both firebase-lazy and firebase imports
    const hasLazyImport = content.includes('@/lib/firebase-lazy');
    const hasFirebaseImport = content.includes('@/lib/firebase');
    
    if (!hasLazyImport) {
      console.log(`✅ No lazy imports found: ${filePath}`);
      return false;
    }
    
    if (!hasFirebaseImport) {
      console.log(`⚠️  No firebase imports found: ${filePath}`);
      return false;
    }
    
    // Remove firebase-lazy imports
    const lines = content.split('\n');
    const newLines = [];
    let inImportBlock = false;
    let removedLazyImport = false;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      if (line.includes('import') && line.includes('from')) {
        inImportBlock = true;
        
        if (line.includes('@/lib/firebase-lazy')) {
          console.log(`🔧 Removing lazy import: ${line.trim()}`);
          removedLazyImport = true;
          continue; // Skip this line
        }
      } else if (inImportBlock && line.trim() === '') {
        inImportBlock = false;
      }
      
      newLines.push(line);
    }
    
    if (!removedLazyImport) {
      console.log(`⚠️  No lazy imports removed from: ${filePath}`);
      return false;
    }
    
    const newContent = newLines.join('\n');
    
    // Create backup
    const backupPath = filePath + '.duplicate-backup';
    if (!fs.existsSync(backupPath)) {
      fs.writeFileSync(backupPath, content, 'utf8');
    }
    
    fs.writeFileSync(filePath, newContent, 'utf8');
    console.log(`✅ Fixed duplicate imports: ${filePath}`);
    return true;
    
  } catch (error) {
    console.error(`Error fixing ${filePath}:`, error.message);
    return false;
  }
}

let fixedCount = 0;

filesToCheck.forEach(filePath => {
  if (fixDuplicateImports(filePath)) {
    fixedCount++;
  }
});

console.log(`\n🎉 Fixed ${fixedCount} files with duplicate imports!`);
console.log('⚠️  Run "npm run typecheck" to verify the fixes');