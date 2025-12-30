// src/lib/productService.ts
import { adminDb } from '@/lib/firebase-admin';
import { doc, setDoc, getDoc, updateDoc, deleteDoc, collection, getDocs, query, where } from 'firebase/firestore';
import { Product } from '@/lib/types';

// Untuk admin (server-side)
export async function createProduct(product: Omit<Product, 'id'>): Promise<string> {
  const docRef = doc(collection(adminDb, 'products'));
  await setDoc(docRef, {
    ...product,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });
  return docRef.id;
}

export async function updateProduct(id: string, product: Partial<Product>): Promise<void> {
  await updateDoc(doc(adminDb, 'products', id), {
    ...product,
    updatedAt: new Date().toISOString()
  });
}

export async function deleteProduct(id: string): Promise<void> {
  await deleteDoc(doc(adminDb, 'products', id));
}

export async function getProduct(id: string): Promise<Product | null> {
  const docSnap = await getDoc(doc(adminDb, 'products', id));
  if (docSnap.exists()) {
    return { id: docSnap.id, ...docSnap.data() } as Product;
  }
  return null;
}

export async function getAllProducts(): Promise<Product[]> {
  const querySnapshot = await getDocs(collection(adminDb, 'products'));
  return querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  })) as Product[];
}

// Untuk frontend (client-side dengan firebase biasa)
import { db } from '@/lib/firebase';
import { doc as clientDoc, getDoc as clientGetDoc } from 'firebase/firestore';

export async function getPublicProduct(id: string): Promise<Product | null> {
  const docSnap = await clientGetDoc(clientDoc(db, 'products', id));
  if (docSnap.exists()) {
    return { id: docSnap.id, ...docSnap.data() } as Product;
  }
  return null;
}