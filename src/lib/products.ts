// src/lib/products.ts
import type { Product, Category } from '@/lib/types';

// === DATA PRODUK ===
export const PRODUCTS: Product[] = [
  {
    id: '1',
    name: 'Beras Premium 5kg',
    price: 65000,          // harga ecer
    wholesalePrice: 60000, // harga grosir
    stock: 150,
    category: 'Beras & Tepung',
    unit: '5kg',
    image: 'https://placehold.co/300x300/6366f1/ffffff?text=Beras+5kg',
    barcode: 'BR001',
    minWholesaleQty: 2, // minimal beli 2 untuk harga grosir
    description: 'Beras premium berkualitas tinggi, cocok untuk konsumsi keluarga sehari-hari.'
  },
  {
    id: '2',
    name: 'Minyak Goreng 2L',
    price: 32000,
    wholesalePrice: 29000,
    stock: 85,
    category: 'Minyak & Gula',
    unit: '2L',
    image: 'https://placehold.co/300x300/8b5cf6/ffffff?text=Minyak+2L',
    barcode: 'MG002',
    minWholesaleQty: 3,
    description: 'Minyak goreng berkualitas dari kelapa sawit pilihan.'
  },
  {
    id: '3',
    name: 'Gula Pasir 1kg',
    price: 14000,
    wholesalePrice: 12500,
    stock: 200,
    category: 'Minyak & Gula',
    unit: '1kg',
    image: 'https://placehold.co/300x300/06b6d4/ffffff?text=Gula+1kg',
    barcode: 'GP003',
    minWholesaleQty: 5,
    description: 'Gula pasir halus dan murni, cocok untuk minuman dan kue.'
  },
  {
    id: '4',
    name: 'Mie Instan Pack 40pcs',
    price: 85000,
    wholesalePrice: 80000,
    stock: 60,
    category: 'Mie & Sereal',
    unit: '40pcs',
    image: 'https://placehold.co/300x300/10b981/ffffff?text=Mie+40pcs',
    barcode: 'MI004',
    minWholesaleQty: 1, // grosir berlaku untuk 1 pack
    description: 'Paket hemat mie instan isi 40 pcs. Ideal untuk stok rumah atau warung.'
  },
  {
    id: '5',
    name: 'Tepung Terigu 1kg',
    price: 12000,
    wholesalePrice: 11000,
    stock: 120,
    category: 'Beras & Tepung',
    unit: '1kg',
    image: 'https://placehold.co/300x300/f59e0b/ffffff?text=Tepung+1kg',
    barcode: 'TT005',
    minWholesaleQty: 5,
    description: 'Tepung terigu protein sedang, cocok untuk kue dan gorengan.'
  },
  {
    id: '6',
    name: 'Kecap Manis 500ml',
    price: 9000,
    wholesalePrice: 8200,
    stock: 95,
    category: 'Bumbu Dapur',
    unit: '500ml',
    image: 'https://placehold.co/300x300/ef4444/ffffff?text=Kecap+500ml',
    barcode: 'KM006',
    minWholesaleQty: 6,
    description: 'Kecap manis berkualitas dengan rasa gurih dan manis seimbang.'
  },
  {
    id: '7',
    name: 'Sambal Instan 200gr',
    price: 7500,
    wholesalePrice: 6800,
    stock: 110,
    category: 'Bumbu Dapur',
    unit: '200gr',
    image: 'https://placehold.co/300x300/10b981/ffffff?text=Sambal+200gr',
    barcode: 'SI007',
    minWholesaleQty: 10,
    description: 'Sambal instan pedas mantap, siap saji untuk segala masakan.'
  },
  {
    id: '8',
    name: 'Susu Bubuk 800gr',
    price: 45000,
    wholesalePrice: 42000,
    stock: 70,
    category: 'Susu & Susu Formula',
    unit: '800gr',
    image: 'https://placehold.co/300x300/8b5cf6/ffffff?text=Susu+800gr',
    barcode: 'SB008',
    minWholesaleQty: 2,
    description: 'Susu bubuk full cream untuk keluarga, kaya nutrisi.'
  }
];

// === DATA KATEGORI ===
export const CATEGORIES: Category[] = [
  { 
    id: '1', 
    name: 'Beras & Tepung', 
    icon: '🍚', 
    slug: 'beras-tepung' 
  },
  { 
    id: '2', 
    name: 'Minyak & Gula', 
    icon: '🍯', 
    slug: 'minyak-gula' 
  },
  { 
    id: '3', 
    name: 'Bumbu Dapur', 
    icon: '🌶️', 
    slug: 'bumbu-dapur' 
  },
  { 
    id: '4', 
    name: 'Mie & Sereal', 
    icon: '🍜', 
    slug: 'mie-sereal' 
  },
  { 
    id: '5', 
    name: 'Minuman', 
    icon: '🥤', 
    slug: 'minuman' 
  },
  { 
    id: '6', 
    name: 'Snack & Kue', 
    icon: '🍪', 
    slug: 'snack-kue' 
  },
  { 
    id: '7', 
    name: 'Susu & Susu Formula', 
    icon: '🥛', 
    slug: 'susu-formula' 
  },
  { 
    id: '8', 
    name: 'Kebutuhan Pokok', 
    icon: '🧼', 
    slug: 'kebutuhan-pokok' 
  }
];

// === Fungsi Helper ===
export const getProductById = (id: string): Product | undefined => {
  return PRODUCTS.find(p => p.id === id);
};

export const getProductsByCategory = (categoryName: string): Product[] => {
  return PRODUCTS.filter(p => p.category === categoryName);
};

export const getCategoryBySlug = (slug: string): Category | undefined => {
  return CATEGORIES.find(c => c.slug === slug);
};

// Tambahkan di bagian paling bawah src/lib/products.ts

// === Fungsi Wishlist (untuk user anonim) ===
export const getWishlist = (): number[] => {
  if (typeof window === 'undefined') return [];
  const saved = localStorage.getItem('atayatoko-wishlist');
  return saved ? JSON.parse(saved) : [];
};

export const addToWishlist = (productId: string) => {
  if (typeof window === 'undefined') return;
  const wishlist = getWishlist();
  if (!wishlist.includes(productId)) {
    wishlist.push(productId);
    localStorage.setItem('atayatoko-wishlist', JSON.stringify(wishlist));
  }
};

export const removeFromWishlist = (productId: string) => { // ← INI YANG KURANG
  if (typeof window === 'undefined') return;
  const wishlist = getWishlist().filter(id => id !== productId);
  localStorage.setItem('atayatoko-wishlist', JSON.stringify(wishlist));
};