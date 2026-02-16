// lib/createOrder.ts (atau di dalam komponen/Route Handler)
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';


export const createOrder = async (orderData: {
  customerName: string;
  customerPhone: string;
  items: Array<{
    productId: string;
    name: string;
    price: number;
    quantity: number;
  }>;
  total: number;
  paymentMethod: 'CASH' | 'TRANSFER' | 'QRIS';
  deliveryMethod: string;
  note?: string;
  customerAddress?: string;
}) => {
  const user = auth.currentUser;

  if (!user) throw new Error('User tidak login');

  // Validasi minimal
  if (!orderData.customerName || !orderData.customerPhone || orderData.items.length === 0) {
    throw new Error('Data pesanan tidak lengkap');
  }

  const newOrder = {
    customerId: user.uid,
    customerName: orderData.customerName.trim(),
    customerPhone: orderData.customerPhone.trim(),
    customerAddress: orderData.customerAddress?.trim(),
    items: orderData.items,
    total: orderData.total,
    paymentMethod: orderData.paymentMethod,
    deliveryMethod: orderData.deliveryMethod,
    note: orderData.note?.trim(),
    status: 'MENUNGGU', // Status awal
    createdAt: serverTimestamp(), // ✅ INI YANG PENTING
    // updatedAt tidak perlu di sini, bisa diupdate saat ubah status
  };

  const docRef = await addDoc(collection(db, 'orders'), newOrder);
  return docRef.id; // ID pesanan baru
};