'use server'

import { supabase } from '@/lib/supabase';

export async function getReportSummary(startDate: Date, endDate: Date) {
  try {
    const startIso = new Date(startDate);
    startIso.setHours(0, 0, 0, 0);
    const endIso = new Date(endDate);
    endIso.setHours(23, 59, 59, 999);

    const [ordersRes, productsRes, customersRes, lowStockRes] = await Promise.all([
      supabase
        .from('orders')
        .select('*')
        .gte('created_at', startIso.toISOString())
        .lte('created_at', endIso.toISOString()),
      supabase.from('products').select('*', { count: 'exact', head: true }),
      supabase.from('customers').select('*', { count: 'exact', head: true }),
      supabase.from('products').select('id, stock, raw_data'),
    ]);

    const orders = ordersRes.data || [];
    const totalProducts = productsRes.count || 0;
    const totalCustomers = customersRes.count || 0;

    // Hitung lowStockCount
    const allProducts = lowStockRes.data || [];
    const lowStockCount = allProducts.filter((p: any) => {
      const stock = Number(p.stock ?? p.raw_data?.stock ?? p.raw_data?.Stok ?? 0);
      return stock <= 10;
    }).length;

    let totalSales = 0;
    let totalDebt = 0;
    const customerIds = new Set<string>();
    const salesMap: Record<string, number> = {};

    // Build daily sales map
    const cursor = new Date(startIso);
    while (cursor <= endIso) {
      salesMap[cursor.toISOString().split('T')[0]] = 0;
      cursor.setDate(cursor.getDate() + 1);
    }

    for (const order of orders) {
      const status = String(order.status || '').toUpperCase();
      const raw = order.raw_data || {};
      const totalAmount = Number(order.total ?? raw.total ?? raw.totalAmount ?? 0);
      const createdAt = order.created_at ? new Date(order.created_at) : new Date();

      if (['COMPLETED', 'SELESAI', 'SUCCESS'].includes(status)) {
        totalSales += totalAmount;
        const dateKey = createdAt.toISOString().split('T')[0];
        if (salesMap[dateKey] !== undefined) {
          salesMap[dateKey] += totalAmount;
        }
      }
      if (!['COMPLETED', 'SELESAI', 'SUCCESS', 'CANCELLED', 'BATAL'].includes(status)) {
        totalDebt += totalAmount;
      }
      if (order.user_id || raw.userId || raw.customer_id) {
        customerIds.add(order.user_id || raw.userId || raw.customer_id);
      }
    }

    const dailySales = Object.entries(salesMap)
      .map(([date, total]) => ({
        date,
        total,
        label: new Date(date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }),
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return {
      totalSales,
      totalOrders: orders.length,
      totalProducts,
      lowStockCount,
      totalCustomers,
      outstandingDebt: totalDebt,
      activeCustomers: customerIds.size,
      averageOrderValue: orders.length > 0 ? totalSales / orders.length : 0,
      dailySales,
    };
  } catch (error) {
    console.error('Failed to fetch report summary:', error);
    return {
      totalSales: 0,
      totalOrders: 0,
      totalProducts: 0,
      lowStockCount: 0,
      totalCustomers: 0,
      outstandingDebt: 0,
      activeCustomers: 0,
      averageOrderValue: 0,
      dailySales: [],
    };
  }
}
