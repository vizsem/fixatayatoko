const fs = require('fs');
const path = require('path');

console.log('🚀 Fixing missing db imports...\n');

const filesToFix = [
  'src/app/admin/employees/page.tsx',
  'src/app/admin/inventory/history/page.tsx',
  'src/app/admin/products/add/page.tsx',
  'src/app/admin/promotions/edit/[id]/page.tsx',
  'src/app/admin/purchases/[id]/page.tsx',
  'src/app/admin/purchases/add/page.tsx',
  'src/app/admin/settings/points/page.tsx',
  'src/app/kategori/[slug]/page.tsx',
  'src/app/orders/[id]/page.tsx',
  'src/app/orders/page.tsx',
  'src/app/semua-kategori/page.tsx',
  'src/app/transaksi/[id]/page.tsx',
  'src/app/wishlist/page.tsx'
];

function fixDbImport(filePath) {
  try {
    const fullPath = path.join(__dirname, '..', filePath);
    if (!fs.existsSync(fullPath)) {
      return false;
    }

    let content = fs.readFileSync(fullPath, 'utf8');
    let modified = false;

    // Check if db is used
    const usesDb = content.includes('collection(db') || content.includes('doc(db') || content.includes('query(') || content.includes('db,');
    
    // Check if db is imported
    const hasDbImport = content.includes('import { db') || content.includes(', db') || content.includes('db,') || content.includes('db }');
    
    if (usesDb && !hasDbImport) {
        if (content.includes("from '@/lib/firebase'")) {
             // Add db to existing import
             content = content.replace(/import { (.+) } from '@\/lib\/firebase'/, (match, imports) => {
                 if (!imports.includes('db')) {
                     return `import { db, ${imports} } from '@/lib/firebase'`;
                 }
                 return match;
             });
             modified = true;
             console.log(`✅ Added db to existing import in: ${filePath}`);
        } else {
             // Add new import
             const lines = content.split('\n');
             let insertIdx = 0;
             for(let i=0; i<lines.length; i++) {
                 if(lines[i].trim().startsWith('import')) insertIdx = i + 1;
             }
             lines.splice(insertIdx, 0, "import { db } from '@/lib/firebase';");
             content = lines.join('\n');
             modified = true;
             console.log(`✅ Added new db import in: ${filePath}`);
        }
    }

    if (modified) {
      fs.writeFileSync(fullPath, content, 'utf8');
      return true;
    }
    return false;

  } catch (error) {
    console.error(`Error processing ${filePath}:`, error.message);
    return false;
  }
}

let fixedCount = 0;
filesToFix.forEach(file => {
  if (fixDbImport(file)) {
    fixedCount++;
  }
});

console.log(`\n🎉 Processed ${filesToFix.length} files, fixed ${fixedCount} files!`);