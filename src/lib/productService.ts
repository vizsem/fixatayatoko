// src/lib/productService.ts
import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  updateDoc, 
  deleteDoc,
  getDocs,
  query,
  where
} from 'firebase/firestore';
import { db } from '@/lib/firebase'; // ✅ Gunakan db client
import { Product } from '@/lib/cart'; // ✅ Gunakan tipe dari cart.ts

// ✅ Untuk semua operasi (client + server)
export async function createProduct(product: Omit<Product, 'id'>): Promise<string> {
  const docRef = doc(collection(db, 'products')); // ✅ Gunakan db client
  await setDoc(docRef, {
    ...product,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });
  return docRef.id;
}

export async function getProduct(id: string): Promise<Product | null> {
  const docSnap = await getDoc(doc(db, 'products', id));
  if (docSnap.exists()) {
    return { id: docSnap.id, ...docSnap.data() } as Product;
  }
  return null;
}

export async function updateProduct(id: string, product: Partial<Product>): Promise<void> {
  await updateDoc(doc(db, 'products', id), {
    ...product,
    updatedAt: new Date().toISOString()
  });
}

export async function deleteProduct(id: string): Promise<void> {
  await deleteDoc(doc(db, 'products', id));
}

export async function getProducts(): Promise<Product[]> {
  const querySnapshot = await getDocs(collection(db, 'products'));
  return querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  })) as Product[];
}

// Fungsi untuk admin (masih pakai client SDK)
export async function getProductsForAdmin(): Promise<Product[]> {
  return getProducts();
}