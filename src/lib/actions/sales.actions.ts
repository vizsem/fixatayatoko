'use server'

import { deductStockFEFO } from '../inventory'
import { revalidatePath } from 'next/cache'

import { limit, orderBy, where } from '@/lib/firebase';
type SalesItemInput = {
  productId: string
  quantity: number
  unitPrice: number
}

import { supabase } from '@/lib/supabase';

export async function getSalesOrders(filters?: { status?: string; customerId?: string; limit?: number }) {
  try {
    let query = supabase.from('orders').select('*');
    if (filters?.status && filters.status !== 'SEMUA') {
      query = query.eq('status', filters.status);
    }
    if (filters?.customerId) {
      query = query.eq('user_id', filters.customerId);
    }
    query = query.order('created_at', { ascending: false }).limit(filters?.limit || 200);

    const { data: rows, error } = await query;
    if (error || !rows) {
      console.error('Failed to fetch sales orders from Supabase:', error);
      return [];
    }

    return rows.map((o: any) => {
      const raw = o.raw_data || {};
      const items = Array.isArray(o.items) ? o.items : (raw.items || []);
      const totalAmount = Number(o.total ?? raw.total ?? raw.totalAmount ?? 0);

      return {
        id: o.id,
        soNumber: o.order_id || raw.orderId || o.id,
        status: o.status || raw.status || 'PENDING',
        totalAmount,
        createdAt: o.created_at ? new Date(o.created_at) : new Date(),
        customer: {
          name: o.customer_name || raw.customerName || raw.name || 'Pelanggan',
          phone: o.customer_phone || raw.phone || raw.customerPhone || null,
        },
        items: items.map((it: any) => ({
          quantity: Number(it.quantity || it.qty || 1),
          unitPrice: Number(it.price || it.unitPrice || 0),
          product: { name: it.name || it.productName || 'Produk' },
        })),
        invoice: {
          status: o.status === 'SELESAI' ? 'PAID' : 'UNPAID',
          amountPaid: o.status === 'SELESAI' ? totalAmount : 0,
        },
      };
    });
  } catch (error) {
    console.error('Failed to fetch sales orders:', error);
    return [];
  }
}

export async function getSalesOrderById(id: string) {
  try {
    const { data: o, error } = await supabase.from('orders').select('*').eq('id', id).single();
    if (error || !o) return null;
    const raw = o.raw_data || {};
    const items = Array.isArray(o.items) ? o.items : (raw.items || []);
    const totalAmount = Number(o.total ?? raw.total ?? raw.totalAmount ?? 0);

    return {
      id: o.id,
      soNumber: o.order_id || raw.orderId || o.id,
      status: o.status || raw.status || 'PENDING',
      totalAmount,
      notes: raw.notes || null,
      createdAt: o.created_at ? new Date(o.created_at) : new Date(),
      customer: {
        id: o.user_id || raw.userId || 'guest',
        name: o.customer_name || raw.customerName || raw.name || 'Pelanggan',
        phone: o.customer_phone || raw.phone || raw.customerPhone || null,
      },
      items: items.map((it: any) => ({
        id: it.id || it.productId || '',
        productId: it.productId || it.id || '',
        quantity: Number(it.quantity || it.qty || 1),
        unitPrice: Number(it.price || it.unitPrice || 0),
        totalPrice: Number(it.total || ((it.price || it.unitPrice || 0) * (it.quantity || it.qty || 1))),
        product: { name: it.name || it.productName || 'Produk' },
      })),
      invoice: {
        id: `inv_${o.id}`,
        status: o.status === 'SELESAI' ? 'PAID' : 'UNPAID',
        totalAmount,
        amountPaid: o.status === 'SELESAI' ? totalAmount : 0,
        payments: [],
      },
    };
  } catch (e) {
    console.error('getSalesOrderById error:', e);
    return null;
  }
}

export async function createSalesOrder(data: {
  customerId: string
  createdById: string
  notes?: string
  items: SalesItemInput[]
  warehouseId: string
}) {
  try {
    const totalAmount = data.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
    const id = `so_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const soNumber = `SO-${Date.now()}`;
    const now = new Date().toISOString();

    // Deduct stock using FEFO
    for (const item of data.items) {
      const result = await deductStockFEFO({
        productId: item.productId,
        warehouseId: data.warehouseId,
        amount: item.quantity,
        reference: soNumber,
      });
      if (!result.success) {
        return { success: false, error: result.error || `Stok tidak cukup untuk produk ID: ${item.productId}` };
      }
    }

    // Fetch customer info if available
    const { data: cust } = await supabase.from('customers').select('*').eq('id', data.customerId).single();
    const custName = cust?.name || cust?.raw_data?.name || 'Pelanggan';
    const custPhone = cust?.phone || cust?.raw_data?.phone || null;

    const orderData = {
      orderId: soNumber,
      customerId: data.customerId,
      customerName: custName,
      customerPhone: custPhone,
      createdById: data.createdById,
      notes: data.notes || '',
      items: data.items,
      total: totalAmount,
      status: 'CONFIRMED',
      createdAt: now,
    };

    const { error } = await supabase.from('orders').insert({
      id,
      order_id: soNumber,
      user_id: data.customerId,
      customer_name: custName,
      customer_phone: custPhone,
      status: 'CONFIRMED',
      total: totalAmount,
      items: data.items,
      raw_data: orderData,
      created_at: now,
      updated_at: now,
    });

    if (error) throw error;

    revalidatePath('/admin/orders');
    return { success: true, data: { id, ...orderData } };
  } catch (error: any) {
    console.error('Failed to create sales order:', error);
    return { success: false, error: error.message || 'Gagal membuat sales order' };
  }
}

export async function updateSalesOrderStatus(id: string, status: string) {
  try {
    const now = new Date().toISOString();
    const { data: existing } = await supabase.from('orders').select('*').eq('id', id).single();
    const raw = existing?.raw_data || {};
    raw.status = status;
    raw.updatedAt = now;

    const { error } = await supabase.from('orders').update({
      status,
      raw_data: raw,
      updated_at: now,
    }).eq('id', id);

    if (error) throw error;
    revalidatePath('/admin/orders');
    return { success: true };
  } catch (error) {
    return { success: false, error: 'Gagal update status SO' };
  }
}

export async function recordPayment(data: {
  invoiceId: string
  receivedById: string
  amount: number
  paymentMethod: string
  reference?: string
}) {
  try {
    const orderId = data.invoiceId.replace(/^inv_/, '');
    const { data: order } = await supabase.from('orders').select('*').eq('id', orderId).single();
    if (!order) return { success: false, error: 'Order tidak ditemukan' };

    const raw = order.raw_data || {};
    const currentPaid = Number(raw.amountPaid || 0) + data.amount;
    const total = Number(order.total ?? raw.total ?? 0);
    const isPaid = currentPaid >= total;
    const status = isPaid ? 'SELESAI' : order.status;

    raw.amountPaid = currentPaid;
    raw.paymentStatus = isPaid ? 'PAID' : 'PARTIAL';
    raw.status = status;

    await supabase.from('orders').update({
      status,
      raw_data: raw,
      updated_at: new Date().toISOString(),
    }).eq('id', orderId);

    revalidatePath('/admin/orders');
    return { success: true };
  } catch (error) {
    console.error('Failed to record payment:', error);
    return { success: false, error: 'Gagal mencatat pembayaran' };
  }
}

export async function getUnpaidInvoices() {
  try {
    const { data: rows, error } = await supabase
      .from('orders')
      .select('*')
      .neq('status', 'SELESAI')
      .neq('status', 'COMPLETED')
      .neq('status', 'CANCELLED')
      .order('created_at', { ascending: false });

    if (error || !rows) return [];

    return rows.map((o: any) => {
      const raw = o.raw_data || {};
      const total = Number(o.total ?? raw.total ?? 0);
      return {
        id: `inv_${o.id}`,
        invoiceNo: `INV-${o.order_id || o.id.slice(0, 8).toUpperCase()}`,
        totalAmount: total,
        amountPaid: Number(raw.amountPaid || 0),
        status: 'UNPAID',
        createdAt: o.created_at ? new Date(o.created_at) : new Date(),
        customer: {
          name: o.customer_name || raw.customerName || raw.name || 'Pelanggan',
          phone: o.customer_phone || raw.phone || null,
        },
        so: {
          soNumber: o.order_id || raw.orderId || o.id,
        },
      };
    });
  } catch (error) {
    console.error('Failed to fetch unpaid invoices:', error);
    return [];
  }
}
