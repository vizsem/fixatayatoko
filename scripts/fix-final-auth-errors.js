const fs = require('fs');
const path = require('path');

console.log('🚀 Fixing final auth import errors...\n');

// Files that still have auth errors
const filesWithAuthErrors = [
  'src/app/admin/reports/customers/page.tsx',
  'src/app/admin/reports/finance/page.tsx',
  'src/app/admin/reports/inventory/page.tsx',
  'src/app/admin/reports/operations/page.tsx',
  'src/app/admin/reports/promotions/page.tsx',
  'src/app/admin/reports/sales/page.tsx',
  'src/app/admin/suppliers/page.tsx',
  'src/app/admin/users/page.tsx',
  'src/app/admin/warehouses/add/page.tsx',
  'src/app/cashier/orders/[id]/page.tsx',
  'src/app/cashier/page.tsx',
  'src/app/products/edit/[id]/page.tsx',
  'src/app/profil/edit/page.tsx',
  'src/app/profil/register/page.tsx',
  'src/app/purchases/add/page.tsx',
  'src/app/reports/customers/page.tsx',
  'src/app/reports/finance/page.tsx',
  'src/app/reports/inventory/page.tsx',
  'src/app/reports/operations/page.tsx',
  'src/app/reports/page.tsx',
  'src/app/reports/promotions/page.tsx',
  'src/app/reports/sales/page.tsx'
];

function addAuthImport(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      console.log(`❌ File not found: ${filePath}`);
      return false;
    }
    
    const content = fs.readFileSync(filePath, 'utf8');
    
    // Check if file already has auth import
    if (content.includes("from '@/lib/firebase'") && content.includes('auth')) {
      console.log(`✅ Already has auth import: ${filePath}`);
      return false;
    }
    
    // Check if file uses auth
    const usesAuth = content.includes(' auth') || 
                     content.includes('(auth') || 
                     content.includes(',auth') ||
                     content.includes('onAuthStateChanged');
    
    if (!usesAuth) {
      console.log(`⚠️  No auth usage found: ${filePath}`);
      return false;
    }
    
    const importStatement = 'import { auth } from \'@/lib/firebase\';\n';
    
    const lines = content.split('\n');
    let insertIndex = -1;
    
    // Find the best place to insert the import
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes('import') && lines[i].includes('from')) {
        insertIndex = i + 1;
      } else if (insertIndex !== -1 && !lines[i].includes('import')) {
        break;
      }
    }
    
    if (insertIndex === -1) insertIndex = 0;
    
    lines.splice(insertIndex, 0, importStatement);
    const newContent = lines.join('\n');
    
    // Create backup
    const backupPath = filePath + '.final-auth-backup';
    if (!fs.existsSync(backupPath)) {
      fs.writeFileSync(backupPath, content, 'utf8');
    }
    
    fs.writeFileSync(filePath, newContent, 'utf8');
    console.log(`✅ Added auth import: ${filePath}`);
    return true;
    
  } catch (error) {
    console.error(`Error fixing ${filePath}:`, error.message);
    return false;
  }
}

let fixedCount = 0;

filesWithAuthErrors.forEach(filePath => {
  if (addAuthImport(filePath)) {
    fixedCount++;
  }
});

console.log(`\n🎉 Fixed ${fixedCount} files with missing auth imports!`);
console.log('⚠️  Run "npm run typecheck" to verify the fixes');