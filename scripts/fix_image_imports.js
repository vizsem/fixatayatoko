const fs = require('fs');
const glob = require('glob');

const files = glob.sync('src/**/*.tsx');

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  let originalContent = content;

  // 1. Remove next/image imports
  content = content.replace(/import Image from 'next\/image';\n?/g, '');
  
  // 2. Replace simple <Image ... /> with <img ... /> (Best effort)
  // We'll rely on the manual replacements we did for complex cases, 
  // but for simple ones, just change the tag.
  content = content.replace(/<Image/g, '<img');

  if (content !== originalContent) {
    fs.writeFileSync(file, content, 'utf8');
    console.log("Fixed next/image in:", file);
  }
});
