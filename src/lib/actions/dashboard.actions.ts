'use server'

import { requireStaff } from '@/lib/actions/session';
import { supabaseAdmin } from '@/lib/supabase';

export async function getDashboardStats() {
  // Action ini memakai klien service role (melewati RLS), jadi identitas WAJIB
  // diverifikasi lebih dulu. Server Action berjalan tanpa sesi pengguna, sehingga
  // klien anon tidak bisa membaca orders/users/operational_expenses sama sekali.
  await requireStaff();
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
      expensesRes,
    ] = await Promise.all([
      supabaseAdmin.from('orders').select('*').order('created_at', { ascending: false }),
      supabaseAdmin.from('products').select('*', { count: 'exact', head: true }),
      supabaseAdmin.from('users').select('*', { count: 'exact', head: true }),
      supabaseAdmin.from('products').select('id, stock, price, cost_price, raw_data'),
      supabaseAdmin.from('operational_expenses').select('*'),
    ]);

    const allOrders = allOrdersRes.data || [];
    const totalProducts = totalProductsRes.count || 0;
    const totalUsers = totalUsersRes.count || 0;
    const expenses = expensesRes.data || [];

    // Hitung pengeluaran bulan ini
    let monthlyExpenses = 0;
    if (expenses && expenses.length > 0) {
      expenses.forEach((ex: any) => {
        const d = new Date(ex.created_at);
        if (d >= startOfMonth) {
          monthlyExpenses += Number(ex.raw_data?.amount || ex.amount || 0);
        }
      });
    }

    // Hitung low stock
    let totalInventoryValue = 0;
    const allProducts = lowStockRes.data || [];
    const lowStockCount = allProducts.filter((p: any) => {
      const stock = Number(p.stock ?? p.raw_data?.stock ?? p.raw_data?.Stok ?? 0);
      const costPrice = Number(p.cost_price ?? p.raw_data?.costPrice ?? p.raw_data?.Modal ?? 0);
      totalInventoryValue += stock * costPrice;
      return stock <= 10;
    }).length;

    // Create a map of product id to cost_price for profit calculation
    const productCostMap = new Map<string, number>();
    for (const p of allProducts) {
      const costPrice = Number(p.cost_price ?? p.raw_data?.costPrice ?? p.raw_data?.Modal ?? 0);
      productCostMap.set(p.id, costPrice);
    }

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
    let monthlyProfit = 0;

    const dailyMap = new Map<string, number>();
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      dailyMap.set(d.toISOString().split('T')[0], 0);
    }

    // Top products map: productId -> { name, qty }
    const topMap = new Map<string, { name: string; qty: number; price: number }>();
    
    // Customer map: customerName -> { totalSpent, ordersCount }
    const customerMap = new Map<string, { totalSpent: number; ordersCount: number }>();
    
    let cancelledOrdersCount = 0;

    for (const o of allOrders) {
      if (String(o.status || '').toUpperCase() === 'CANCELLED') {
        cancelledOrdersCount++;
      }
      
      if (!isCompleted(o)) continue;
      const amount = getAmount(o);
      const date = getDate(o);

      if (date >= today) dailySales += amount;
      if (date >= sevenDaysAgo) weeklySales += amount;
      if (date >= startOfMonth) {
        monthlySales += amount;
        
        // Calculate profit for this order
        const raw = o.raw_data || {};
        const items = Array.isArray(raw.items) ? raw.items : [];
        for (const it of items) {
          const pid = it.id || it.productId || '';
          const qty = Number(it.quantity || it.qty || 1);
          const conversion = Number(it.containsPerUnit || it.contains || it.conversion || 1);
          const baseQty = Number(it.baseQuantity || (qty * conversion));
          const price = Number(it.price || 0);
          const costPrice = pid ? (productCostMap.get(pid) || 0) : 0;
          if (costPrice > 0) {
             monthlyProfit += (price * qty) - (costPrice * baseQty);
          } else {
             // Fallback estimate if cost price is unknown (e.g., 20% margin)
             monthlyProfit += (price * 0.2) * qty;
          }
        }
      }

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
          
          const qty = Number(it.quantity || it.qty || 1);
          const conversion = Number(it.containsPerUnit || it.contains || it.conversion || 1);
          const baseQty = Number(it.baseQuantity || (qty * conversion));
          
          const prev = topMap.get(pid) || { name: it.name || 'Produk', qty: 0, price: Number(it.price || 0) };
          topMap.set(pid, { ...prev, qty: prev.qty + baseQty });
        }
      }
      
      // Tally top customers (all time or just month, let's do all time for now)
      const cName = o.customer_name || o.raw_data?.name || o.raw_data?.customerName || 'Pelanggan Tamu';
      if (cName !== 'Pelanggan Tamu') {
        const prevC = customerMap.get(cName) || { totalSpent: 0, ordersCount: 0 };
        customerMap.set(cName, { totalSpent: prevC.totalSpent + amount, ordersCount: prevC.ordersCount + 1 });
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
      
    // Dead stock: Products with > 0 stock but 0 sales in the period
    const deadStockCount = allProducts.filter((p: any) => {
      const stock = Number(p.stock ?? p.raw_data?.stock ?? p.raw_data?.Stok ?? 0);
      return stock > 0 && !topMap.has(p.id);
    }).length;
    
    // Top customers
    const topCustomers = Array.from(customerMap.entries())
      .sort(([, a], [, b]) => b.totalSpent - a.totalSpent)
      .slice(0, 5)
      .map(([name, v]) => ({
        name,
        spent: v.totalSpent,
        orders: v.ordersCount,
      }));

    return {
      stats: {
        dailySales,
        weeklySales,
        monthlySales,
        monthlyProfit,
        monthlyNetProfit: monthlyProfit - monthlyExpenses,
        totalInventoryValue,
        totalProducts,
        lowStock: lowStockCount,
        deadStock: deadStockCount,
        warehouses: 1, // Minimal 1 gudang
        users: totalUsers,
        cancelledOrders: cancelledOrdersCount,
      },
      recentOrders,
      topProducts,
      topCustomers,
      salesChartData,
    };
  } catch (error) {
    console.error('Failed to fetch dashboard stats:', error);
    return {
      stats: { dailySales: 0, weeklySales: 0, monthlySales: 0, monthlyProfit: 0, monthlyNetProfit: 0, totalInventoryValue: 0, totalProducts: 0, lowStock: 0, deadStock: 0, warehouses: 0, users: 0, cancelledOrders: 0 },
      recentOrders: [],
      topProducts: [],
      topCustomers: [],
      salesChartData: [],
    };
  }
}
