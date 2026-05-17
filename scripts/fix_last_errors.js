const fs = require('fs');

const fixFile = (path, find, replace) => {
  let c = fs.readFileSync(path, 'utf8');
  c = c.replace(new RegExp(find, 'g'), replace);
  fs.writeFileSync(path, c, 'utf8');
};

fixFile('src/app/admin/inventory/page.tsx', '<imgIcon', '<ImageIcon');
fixFile('src/app/admin/products/add/page.tsx', '<imgIcon', '<ImageIcon');
fixFile('src/app/admin/products/edit/[id]/page.tsx', '<imgIcon', '<ImageIcon');

// Success page
let sp = fs.readFileSync('src/app/success/page.tsx', 'utf8');
if (!sp.includes('Download')) {
  sp = sp.replace(/import {([^}]+)} from 'lucide-react';/, (m, p1) => {
    return `import {${p1}, Download } from 'lucide-react';`;
  });
  fs.writeFileSync('src/app/success/page.tsx', sp, 'utf8');
}
