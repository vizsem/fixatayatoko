import {
  collection,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  query,
  where,
  serverTimestamp // Gunakan ini agar sinkron dengan fungsi import Excel
} from 'firebase/firestore';
import { getFirestoreDB, getFirebaseAuth, getFirebaseStorage } from '@/lib/firebase-lazy';

import { Product } from './types';


// ✅ Membuat Produk Baru
export async function createProduct(product: Omit<Product, 'id'>): Promise<string> {
  // Gunakan ID dari Excel sebagai ID dokumen jika tersedia, jika tidak generate otomatis
  const customId = product.ID || undefined;
  const docRef = customId ? doc(await getFirestoreDB(), 'products', customId) : doc(collection(await getFirestoreDB(), 'products'));

  await setDoc(docRef, {
    ...product,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
  return docRef.id;
}

// ✅ Mengambil Satu Produk
export async function getProduct(id: string): Promise<Product | null> {
  const docSnap = await getDoc(doc(await getFirestoreDB(), 'products', id));
  if (docSnap.exists()) {
    return { id: docSnap.id, ...docSnap.data() } as Product;
  }
  return null;
}

// ✅ Update Produk (Mendukung Partial Update)
export async function updateProduct(id: string, product: Partial<Product>): Promise<void> {
  await updateDoc(doc(await getFirestoreDB(), 'products', id), {
    ...product,
    updatedAt: serverTimestamp()
  });
}

// ✅ Hapus Produk
export async function deleteProduct(id: string): Promise<void> {
  await deleteDoc(doc(await getFirestoreDB(), 'products', id));
}

// ✅ Ambil Semua Produk (Bisa difilter yang aktif saja)
export async function getProducts(onlyActive = false): Promise<Product[]> {
  let q = query(collection(await getFirestoreDB(), 'products'));

  if (onlyActive) {
    q = query(collection(await getFirestoreDB(), 'products'), where("Status", "==", 1));
  }

  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  })) as Product[];
}

// ✅ Ambil Produk Berdasarkan Parent_ID (Untuk Variasi)
export async function getProductVariations(parentId: string): Promise<Product[]> {
  const q = query(collection(await getFirestoreDB(), 'products'), where("Parent_ID", "==", parentId));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  })) as Product[];
}