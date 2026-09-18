// lib/orders.ts - Rewritten for Supabase
import { supabase } from '@/lib/supabase';

import { auth } from '@/lib/firebase';
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
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) throw new Error('User tidak login');

  // Validasi minimal
  if (!orderData.customerName || !orderData.customerPhone || orderData.items.length === 0) {
    throw new Error('Data pesanan tidak lengkap');
  }

  const newOrder = {
    user_id: user.id,
    customer_name: orderData.customerName.trim(),
    customer_phone: orderData.customerPhone.trim(),
    customer_address: orderData.customerAddress?.trim(),
    items: orderData.items,
    total: orderData.total,
    payment_method: orderData.paymentMethod,
    delivery_method: orderData.deliveryMethod,
    note: orderData.note?.trim(),
    status: 'MENUNGGU',
  };

  const { data, error } = await supabase
    .from('orders')
    .insert(newOrder)
    .select('id')
    .single();

  if (error) throw error;
  return data.id;
};
