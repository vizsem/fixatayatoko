const fs = require('fs');
const path = require('path');

console.log('🚀 Fixing remaining Firebase function calls...\n');

// Files that need to be fixed
const filesToFix = [
  'src/app/cashier/page.tsx',
  'src/app/profil/login/page.tsx',
  'src/app/profil/logout/page.tsx',
  'src/app/profil/register/page.tsx'
];

function fixFirebaseFunctions(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      console.log(`❌ File not found: ${filePath}`);
      return false;
    }
    
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Check if file needs fixing
    const needsFixing = content.includes('getFirebaseAuth') || 
                       content.includes('getFirestoreDB') || 
                       content.includes('getFirebaseStorage');
    
    if (!needsFixing) {
      console.log(`✅ No old function calls found: ${filePath}`);
      return false;
    }
    
    console.log(`🔧 Fixing: ${filePath}`);
    
    // Replace function calls with direct instances
    content = content.replace(/await getFirebaseAuth\(\)/g, 'auth');
    content = content.replace(/await getFirestoreDB\(\)/g, 'db');
    content = content.replace(/await getFirebaseStorage\(\)/g, 'storage');
    
    // Create backup
    const backupPath = filePath + '.function-backup';
    if (!fs.existsSync(backupPath)) {
      fs.writeFileSync(backupPath, fs.readFileSync(filePath, 'utf8'), 'utf8');
    }
    
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`✅ Fixed function calls: ${filePath}`);
    return true;
    
  } catch (error) {
    console.error(`Error fixing ${filePath}:`, error.message);
    return false;
  }
}

let fixedCount = 0;

filesToFix.forEach(filePath => {
  if (fixFirebaseFunctions(filePath)) {
    fixedCount++;
  }
});

console.log(`\n🎉 Fixed ${fixedCount} files with old function calls!`);
console.log('⚠️  Run "npm run typecheck" to verify the fixes');