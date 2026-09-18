'use server'

import { supabase } from '@/lib/supabase';

export async function getDashboardStats() {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(today.getDate() - 6);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    const COMPLETED_STATUSES = ['CONFIRMED', 'DIPROSES', 'DIKIRIM', 'SELESAI', 'COMPLETED'];

    const [
      allOrdersRes,
      totalProductsRes,
      totalUsersRes,
      lowStockRes,
    ] = await Promise.all([
      supabase.from('orders').select('*').order('created_at', { ascending: false }),
      supabase.from('products').select('*', { count: 'exact', head: true }),
      supabase.from('users').select('*', { count: 'exact', head: true }),
      supabase.from('products').select('id, stock, raw_data'),
    ]);

    const allOrders = allOrdersRes.data || [];
    const totalProducts = totalProductsRes.count || 0;
    const totalUsers = totalUsersRes.count || 0;

    // Hitung low stock
    const allProducts = lowStockRes.data || [];
    const lowStockCount = allProducts.filter((p: any) => {
      const stock = Number(p.stock ?? p.raw_data?.stock ?? p.raw_data?.Stok ?? 0);
      return stock <= 10;
    }).length;

    // Filter berdasarkan tanggal & status
    const getAmount = (o: any) => {
      const raw = o.raw_data || {};
      return Number(o.total ?? raw.total ?? raw.totalAmount ?? 0);
    };
    const getDate = (o: any) => new Date(o.created_at || 0);

    const isCompleted = (o: any) => COMPLETED_STATUSES.includes(String(o.status || '').toUpperCase());

    let dailySales = 0;
    let weeklySales = 0;
    let monthlySales = 0;

    const dailyMap = new Map<string, number>();
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      dailyMap.set(d.toISOString().split('T')[0], 0);
    }

    // Top products map: productId -> { name, qty }
    const topMap = new Map<string, { name: string; qty: number; price: number }>();

    for (const o of allOrders) {
      if (!isCompleted(o)) continue;
      const amount = getAmount(o);
      const date = getDate(o);

      if (date >= today) dailySales += amount;
      if (date >= sevenDaysAgo) weeklySales += amount;
      if (date >= startOfMonth) monthlySales += amount;

      const dateKey = date.toISOString().split('T')[0];
      if (dailyMap.has(dateKey)) {
        dailyMap.set(dateKey, (dailyMap.get(dateKey) || 0) + amount);
      }

      // Tally top products from items
      if (date >= sevenDaysAgo) {
        const raw = o.raw_data || {};
        const items = Array.isArray(raw.items) ? raw.items : [];
        for (const it of items) {
          const pid = it.id || it.productId || '';
          if (!pid) continue;
          const prev = topMap.get(pid) || { name: it.name || 'Produk', qty: 0, price: Number(it.price || 0) };
          topMap.set(pid, { ...prev, qty: prev.qty + Number(it.quantity || it.qty || 1) });
        }
      }
    }

    const days = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
    const salesChartData = Array.from(dailyMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, amount]) => ({
        date,
        amount,
        dayName: days[new Date(date + 'T00:00:00').getDay()],
      }));

    // Recent orders (last 10)
    const recentOrders = allOrders.slice(0, 10).map((o: any) => {
      const raw = o.raw_data || {};
      return {
        id: o.id,
        orderId: o.order_id || raw.orderId || o.id,
        customerName: o.customer_name || raw.name || raw.customerName || 'Pelanggan',
        total: getAmount(o),
        status: o.status || raw.status || 'PENDING',
        createdAt: o.created_at || new Date().toISOString(),
        items: (Array.isArray(raw.items) ? raw.items : []).map((it: any) => ({
          name: it.name || it.productName || 'Produk',
          quantity: Number(it.quantity || 1),
        })),
      };
    });

    // Top products (sorted by qty, top 5)
    const topProducts = Array.from(topMap.entries())
      .sort(([, a], [, b]) => b.qty - a.qty)
      .slice(0, 5)
      .map(([id, v]) => ({
        id,
        name: v.name,
        price: v.price,
        sales: v.qty,
        stock: allProducts.find((p: any) => p.id === id)
          ? Number((allProducts.find((p: any) => p.id === id) as any)?.stock ?? 0)
          : 0,
      }));

    return {
      stats: {
        dailySales,
        weeklySales,
        monthlySales,
        totalProducts,
        lowStock: lowStockCount,
        warehouses: 1, // Minimal 1 gudang
        users: totalUsers,
      },
      recentOrders,
      topProducts,
      salesChartData,
    };
  } catch (error) {
    console.error('Failed to fetch dashboard stats:', error);
    return {
      stats: { dailySales: 0, weeklySales: 0, monthlySales: 0, totalProducts: 0, lowStock: 0, warehouses: 0, users: 0 },
      recentOrders: [],
      topProducts: [],
      salesChartData: [],
    };
  }
}
