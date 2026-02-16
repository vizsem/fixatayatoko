// Script untuk memperbaiki errors Firebase secara otomatis
// Pattern errors: await getFirebaseAuth(), await getFirestoreDB(), await getFirebaseStorage()

const fs = require('fs');
const path = require('path');

// Direktori yang akan di-scan
const directories = [
  './src',
  './src/app',
  './src/components',
  './src/lib',
  './src/hooks'
];

// Pattern errors yang akan diperbaiki
const errorPatterns = [
  // Import paths yang salah
  { 
    pattern: /from\s+['"]firebase\/await getFirebaseAuth\(\)['"]/g, 
    replacement: "from 'firebase/auth'" 
  },
  { 
    pattern: /from\s+['"]firebase\/await getFirebaseStorage\(\)['"]/g, 
    replacement: "from 'firebase/storage'" 
  },
  
  // Variable declarations yang salah
  { 
    pattern: /const\s+await getFirebaseAuth\(\)\s*=/g, 
    replacement: "const auth =" 
  },
  { 
    pattern: /const\s+await getFirestoreDB\(\)\s*=/g, 
    replacement: "const db =" 
  },
  { 
    pattern: /const\s+await getFirebaseStorage\(\)\s*=/g, 
    replacement: "const storage =" 
  },
  
  // useState declarations yang salah
  { 
    pattern: /\[await getFirebaseAuth\(\)/g, 
    replacement: "[auth" 
  },
  { 
    pattern: /\[await getFirestoreDB\(\)/g, 
    replacement: "[db" 
  },
  { 
    pattern: /\[await getFirebaseStorage\(\)/g, 
    replacement: "[storage" 
  },
  
  // Return statements yang salah
  { 
    pattern: /return\s*\{\s*await getFirebaseAuth\(\)/g, 
    replacement: "return { auth" 
  },
  { 
    pattern: /return\s*\{\s*await getFirestoreDB\(\)/g, 
    replacement: "return { db" 
  },
  { 
    pattern: /return\s*\{\s*await getFirebaseStorage\(\)/g, 
    replacement: "return { storage" 
  },
  
  // Object properties yang salah
  { 
    pattern: /await getFirebaseAuth\(\):/g, 
    replacement: "auth:" 
  },
  { 
    pattern: /await getFirestoreDB\(\):/g, 
    replacement: "db:" 
  },
  { 
    pattern: /await getFirebaseStorage\(\):/g, 
    replacement: "storage:" 
  },
  
  // Function calls yang salah
  { 
    pattern: /await getFirebaseAuth\(\)\./g, 
    replacement: "auth." 
  },
  { 
    pattern: /await getFirestoreDB\(\)\./g, 
    replacement: "db." 
  },
  { 
    pattern: /await getFirebaseStorage\(\)\./g, 
    replacement: "storage." 
  }
];

// Fungsi untuk memproses file
function processFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    let newContent = content;
    let modified = false;

    // Terapkan semua pattern replacements
    errorPatterns.forEach(({ pattern, replacement }) => {
      if (pattern.test(newContent)) {
        newContent = newContent.replace(pattern, replacement);
        modified = true;
      }
    });

    if (modified && newContent !== content) {
      // Backup file original
      const backupPath = filePath + '.backup';
      if (!fs.existsSync(backupPath)) {
        fs.writeFileSync(backupPath, content, 'utf8');
      }
      
      // Write file yang sudah diperbaiki
      fs.writeFileSync(filePath, newContent, 'utf8');
      return true;
    }
  } catch (error) {
    console.error(`Error processing file ${filePath}:`, error.message);
  }
  
  return false;
}

// Fungsi untuk scan semua file
function scanDirectory(dirPath) {
  let fixedCount = 0;
  
  try {
    const files = fs.readdirSync(dirPath);
    
    for (const file of files) {
      const fullPath = path.join(dirPath, file);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        // Skip node_modules dan directories tertentu
        if (!file.includes('node_modules') && !file.startsWith('.')) {
          fixedCount += scanDirectory(fullPath);
        }
      } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
        if (processFile(fullPath)) {
          fixedCount++;
          console.log(`✅ Fixed: ${fullPath}`);
        }
      }
    }
  } catch (error) {
    console.error(`Error scanning directory ${dirPath}:`, error.message);
  }
  
  return fixedCount;
}

// Main function
function main() {
  console.log('🚀 Starting automatic Firebase errors fix...\n');
  
  let totalFixed = 0;
  
  // Scan semua directories
  directories.forEach(dir => {
    if (fs.existsSync(dir)) {
      console.log(`📁 Scanning directory: ${dir}`);
      totalFixed += scanDirectory(dir);
    }
  });
  
  console.log(`\n🎉 Fix completed! ${totalFixed} files have been fixed.`);
  console.log('\n⚠️  IMPORTANT NOTES:');
  console.log('1. Backup files have been created with .backup extension');
  console.log('2. Please run "npm run typecheck" to verify the fixes');
  console.log('3. Review the changes manually to ensure correctness');
  console.log('4. Some complex cases may require manual adjustment');
  
  return totalFixed;
}

// Jalankan script
if (require.main === module) {
  main();
}

module.exports = { main };