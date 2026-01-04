import { db } from '@/lib/firebase';
import { 
  collection, 
  doc, 
  serverTimestamp 
} from 'firebase/firestore';

// ✅ Tipe Product disesuaikan dengan kolom Excel terbaru
export type Product = {
  id: string;         // ID dokumen Firestore
  ID: string;         // ID Unik (contoh: AT001)
  Barcode: string;
  Parent_ID: string;
  Nama: string;
  Kategori: string;
  Satuan: string;
  Stok: number;
  Min_Stok: number;
  Modal: number;
  Ecer: number;       // Harga jual satuan
  Harga_Coret: number;
  Grosir: number;     // Harga jual grosir
  Min_Grosir: number; // Minimal beli untuk harga grosir
  Link_Foto: string;
  Deskripsi: string;
  Status: number;
  Supplier: string;
  No_WA_Supplier: string;
  updatedAt?: any;
};

// ✅ Tipe CartItem = Product + quantity
export type CartItem = Product & { quantity: number };

// Fungsi untuk mengambil keranjang dari localStorage
export const getCart = (): CartItem[] => {
  if (typeof window !== 'undefined') {
    const data = localStorage.getItem('atayatoko-cart');
    return data ? JSON.parse(data) : [];
  }
  return [];
};

// Fungsi untuk menyimpan keranjang ke localStorage
export const saveCart = (cart: CartItem[]): void => {
  if (typeof window !== 'undefined') {
    localStorage.setItem('atayatoko-cart', JSON.stringify(cart));
  }
};

// Fungsi untuk menambahkan item ke keranjang
export const addToCart = (product: Product): void => {
  const cart = getCart();
  const existingItem = cart.find(item => item.id === product.id);
  
  if (existingItem) {
    existingItem.quantity += 1;
  } else {
    cart.push({ ...product, quantity: 1 });
  }
  
  saveCart(cart);
};

// Fungsi untuk memperbarui kuantitas
export const updateQuantity = (id: string, quantity: number): void => {
  const cart = getCart();
  const updatedCart = cart
    .map(item => item.id === id ? { ...item, quantity } : item)
    .filter(item => item.quantity > 0);
  
  saveCart(updatedCart);
};

// Fungsi untuk menghapus item
export const removeItem = (id: string): void => {
  const cart = getCart().filter(item => item.id !== id);
  saveCart(cart);
};

// ✅ Fungsi Cerdas: Menghitung total harga dengan logika Grosir
// Jika jumlah barang >= Min_Grosir, gunakan harga Grosir, jika tidak gunakan harga Ecer
export const getItemPrice = (item: CartItem): number => {
  if (item.Grosir > 0 && item.Min_Grosir > 0 && item.quantity >= item.Min_Grosir) {
    return item.Grosir;
  }
  return item.Ecer;
};

export const getTotalPrice = (cart: CartItem[]): number => {
  return cart.reduce((total, item) => total + getItemPrice(item) * item.quantity, 0);
};

export const getTotalItems = (cart: CartItem[]): number => {
  return cart.reduce((total, item) => total + item.quantity, 0);
};

// Fungsi tambahan untuk membersihkan keranjang setelah checkout
export const clearCart = (): void => {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('atayatoko-cart');
  }
};