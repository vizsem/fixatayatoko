const fs = require('fs');
const glob = require('glob');

const files = glob.sync('src/**/*.tsx');

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  let originalContent = content;

  // Regex to match <img> tags
  content = content.replace(/<img([^>]*)>/g, (match, attrs) => {
    // Inside the attributes, remove `fill`, `sizes="..."`, `unoptimized`
    let newAttrs = attrs
      .replace(/\s+fill(?=[\s>])/g, '')
      .replace(/\s+unoptimized(?=[\s>])/g, '')
      .replace(/\s+sizes="[^"]*"/g, '');
    return `<img${newAttrs}>`;
  });

  if (content !== originalContent) {
    fs.writeFileSync(file, content, 'utf8');
    console.log("Fixed img props in:", file);
  }
});
