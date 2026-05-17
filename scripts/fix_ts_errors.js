const fs = require('fs');

// 1. Fix inventory/page.tsx loading redeclaration
let file = 'src/app/admin/inventory/page.tsx';
let content = fs.readFileSync(file, 'utf8');
content = content.replace(/const { authLoading: loading } = useAdminAuth\(\);/, 'const { authLoading } = useAdminAuth();');
content = content.replace(/if \(loading\)/g, 'if (loading || authLoading)');
fs.writeFileSync(file, content, 'utf8');

// 2. Fix reports/inventory/page.tsx loading redeclaration
file = 'src/app/admin/reports/inventory/page.tsx';
content = fs.readFileSync(file, 'utf8');
content = content.replace(/const { authLoading: loading } = useAdminAuth\(\);/, 'const { authLoading } = useAdminAuth();');
content = content.replace(/if \(loading\)/g, 'if (loading || authLoading)');
fs.writeFileSync(file, content, 'utf8');

// 3. Fix reports/operations/page.tsx loading redeclaration
file = 'src/app/admin/reports/operations/page.tsx';
content = fs.readFileSync(file, 'utf8');
content = content.replace(/const { authLoading: loading } = useAdminAuth\(\);/, 'const { authLoading } = useAdminAuth();');
content = content.replace(/if \(loading\)/g, 'if (loading || authLoading)');
fs.writeFileSync(file, content, 'utf8');

// 4. Fix orders/page.tsx UserDoc
file = 'src/app/admin/orders/page.tsx';
content = fs.readFileSync(file, 'utf8');
content = content.replace(/handleUpdateRole\(user.id, e.target.value as UserDoc\['role'\]\)/g, 'handleUpdateRole(user.id, e.target.value)');
fs.writeFileSync(file, content, 'utf8');

// 5. Fix img placeholder blurDataURL
const imgFiles = [
  'src/app/admin/products/add/page.tsx',
  'src/app/admin/products/edit/[id]/page.tsx',
  'src/app/kategori/[slug]/page.tsx'
];
imgFiles.forEach(f => {
  let c = fs.readFileSync(f, 'utf8');
  c = c.replace(/placeholder="blur"/g, '');
  c = c.replace(/blurDataURL="[^"]*"/g, '');
  fs.writeFileSync(f, c, 'utf8');
});

// 6. Fix imgIcon typo
file = 'src/app/products/edit/[id]/page.tsx';
content = fs.readFileSync(file, 'utf8');
content = content.replace(/<imgIcon/g, '<ImageIcon');
fs.writeFileSync(file, content, 'utf8');

file = 'src/app/success/page.tsx';
content = fs.readFileSync(file, 'utf8');
content = content.replace(/<imgIcon/g, '<Download'); // success page is for downloading receipt
fs.writeFileSync(file, content, 'utf8');

console.log('Fixed all TS errors!');
