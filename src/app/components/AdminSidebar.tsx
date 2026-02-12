// src/app/(admin)/components/AdminSidebar.tsx
'use client';

import Link from 'next/link';
import { Package } from 'lucide-react';

export default function AdminSidebar() {
  return (
    <aside className="w-64 bg-white border-r p-4">
      <nav className="space-y-2">
        <Link href="/admin" className="flex items-center gap-2 p-2 text-black"> 
          <Package size={18} /> Dashboard
        </Link>
        {/* dst */}
      </nav>
    </aside>
  );
}