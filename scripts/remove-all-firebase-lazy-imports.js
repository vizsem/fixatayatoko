const fs = require('fs');
const path = require('path');

console.log('🚀 Removing all remaining firebase-lazy imports...\n');

// Find all TypeScript/JavaScript files in src directory
function getAllSourceFiles(dir) {
  const files = [];
  
  function traverse(currentDir) {
    const items = fs.readdirSync(currentDir);
    
    for (const item of items) {
      const fullPath = path.join(currentDir, item);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        // Skip node_modules and other non-source directories
        if (!item.includes('node_modules') && !item.startsWith('.') && item !== 'dist' && item !== 'build') {
          traverse(fullPath);
        }
      } else if (stat.isFile() && (item.endsWith('.ts') || item.endsWith('.tsx') || item.endsWith('.js') || item.endsWith('.jsx'))) {
        files.push(fullPath);
      }
    }
  }
  
  traverse(dir);
  return files;
}

const allSourceFiles = getAllSourceFiles(path.join(__dirname, '..', 'src'));

function removeFirebaseLazyImports(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    
    // Check if file has firebase-lazy imports
    if (!content.includes('@/lib/firebase-lazy')) {
      return false;
    }
    
    console.log(`🔧 Processing: ${filePath}`);
    
    const lines = content.split('\n');
    const newLines = [];
    let removedAny = false;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      if (line.includes('@/lib/firebase-lazy')) {
        console.log(`   Removing: ${line.trim()}`);
        removedAny = true;
        continue; // Skip this line
      }
      
      newLines.push(line);
    }
    
    if (!removedAny) {
      return false;
    }
    
    const newContent = newLines.join('\n');
    
    // Create backup
    const backupPath = filePath + '.firebase-lazy-backup';
    if (!fs.existsSync(backupPath)) {
      fs.writeFileSync(backupPath, content, 'utf8');
    }
    
    fs.writeFileSync(filePath, newContent, 'utf8');
    console.log(`✅ Removed firebase-lazy imports: ${filePath}`);
    return true;
    
  } catch (error) {
    console.error(`Error processing ${filePath}:`, error.message);
    return false;
  }
}

let fixedCount = 0;

allSourceFiles.forEach(filePath => {
  if (removeFirebaseLazyImports(filePath)) {
    fixedCount++;
  }
});

console.log(`\n🎉 Removed firebase-lazy imports from ${fixedCount} files!`);
console.log('⚠️  Run "npm run typecheck" to verify the fixes');