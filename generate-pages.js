// generate-pages.js
/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require('fs');
const path = require('path');

const folders = [
  'products',
  'orders',
  'customers',
  'inventory',
  'purchases',
  'reports',
  'settings'
];

folders.forEach(folder => {
  const filePath = path.join('src', 'app', '(admin)', folder, 'page.tsx');
  const content = `
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';

export default function Admin${folder.charAt(0).toUpperCase() + folder.slice(1)}() {
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) {
        router.push('/profil/login');
      }
    });
    return () => unsubscribe();
  }, [router]);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-gray-900">Manajemen ${folder}</h1>
      <div className="bg-white rounded-lg shadow p-6 mt-4">
        <p className="text-gray-600">Halaman ini akan dikembangkan untuk manajemen ${folder}.</p>
      </div>
    </div>
  );
}
`;

  // Buat folder jika belum ada
  fs.mkdirSync(path.dirname(filePath), { recursive: true });

  // Tulis file
  fs.writeFileSync(filePath, content);
  console.log(`✅ Created: ${filePath}`);
});

console.log('✅ Semua halaman telah dibuat!');