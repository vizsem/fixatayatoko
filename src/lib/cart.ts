// src/lib/cart.ts
import { 
  collection, 
  getDocs,
  addDoc,
  doc,
  updateDoc,
  query,
  orderBy,
  onSnapshot,
  where,
  serverTimestamp,
  getDoc
} from 'firebase/firestore';
import { db } from '@/lib/firebase';

// ✅ Tipe Product lengkap — sesuai dengan struktur Firestore ATAYATOKO2
export type Product = {
  id: string;
  name: string;
  price: number;
  wholesalePrice?: number;
  purchasePrice?: number;
  stock: number;
  stockByWarehouse?: Record<string, number>;
  category: string;
  unit: string;
  barcode?: string;
  image: string;
  expiredDate?: string;
  rating?: number; // ✅ Ditambahkan untuk kompatibilitas dengan StarRating
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

// Fungsi untuk menghitung total
export const getTotalPrice = (cart: CartItem[]): number => {
  return cart.reduce((total, item) => total + item.price * item.quantity, 0);
};

export const getTotalItems = (cart: CartItem[]): number => {
  return cart.reduce((total, item) => total + item.quantity, 0);
};