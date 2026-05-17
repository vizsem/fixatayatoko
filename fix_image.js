const fs = require('fs');
const glob = require('glob');

// We will find files containing "next/image"
const files = glob.sync('src/**/*.tsx');

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  if (content.includes("next/image")) {
    console.log("Needs fix:", file);
  }
});
