'use server';

import { supabaseAdmin } from '@/lib/supabase';

export type CashierPerformanceItem = {
  cashierId: string;
  cashierName: string;
  totalOrders: number;
  completedOrdersCount: number;
  cancelledOrdersCount: number;
  totalRevenue: number;
  totalItemsSold: number;
  averageBasketValue: number;
  totalShifts: number;
  activeShiftsCount: number;
  closedShiftsCount: number;
  totalCashSales: number;
  totalNonCashSales: number;
  totalCashDiscrepancy: number; // Selisih kas register (actualCash - expectedCash)
  paymentMethods: Record<string, number>;
  dailyPerformance: Array<{ date: string; label: string; revenue: number; orders: number }>;
  lastActivityDate?: string;
  topProductSold?: string;
};

export type CashierShiftLog = {
  id: string;
  cashierId: string;
  cashierName: string;
  openedAt: string;
  closedAt: string | null;
  status: 'OPEN' | 'CLOSED';
  initialCash: number;
  expectedCash: number;
  actualCash: number | null;
  difference: number;
  totalCashSales: number;
  totalNonCashSales: number;
  notes?: string;
};

export async function getCashierPerformanceReport(startDateStr: string, endDateStr: string, filterCashierId?: string) {
  try {
    const startIso = new Date(startDateStr);
    startIso.setHours(0, 0, 0, 0);

    const endIso = new Date(endDateStr);
    endIso.setHours(23, 59, 59, 999);

    // Fetch orders & cashier_shifts concurrently
    const [ordersRes, shiftsRes] = await Promise.all([
      supabaseAdmin
        .from('orders')
        .select('*')
        .gte('created_at', startIso.toISOString())
        .lte('created_at', endIso.toISOString())
        .order('created_at', { ascending: false }),

      supabaseAdmin
        .from('cashier_shifts')
        .select('*')
        .gte('created_at', startIso.toISOString())
        .lte('created_at', endIso.toISOString())
        .order('created_at', { ascending: false }),
    ]);

    const orders = ordersRes.data || [];
    const shifts = shiftsRes.data || [];

    // Helper map for cashier stats
    const cashierMap = new Map<string, CashierPerformanceItem>();

    const getOrCreateCashier = (id: string, name: string): CashierPerformanceItem => {
      const key = (id || name || 'KASIR_DEFAULT').trim().toLowerCase();
      const cleanName = (name || id || 'Kasir Default').trim();
      
      if (!cashierMap.has(key)) {
        cashierMap.set(key, {
          cashierId: id || key,
          cashierName: cleanName,
          totalOrders: 0,
          completedOrdersCount: 0,
          cancelledOrdersCount: 0,
          totalRevenue: 0,
          totalItemsSold: 0,
          averageBasketValue: 0,
          totalShifts: 0,
          activeShiftsCount: 0,
          closedShiftsCount: 0,
          totalCashSales: 0,
          totalNonCashSales: 0,
          totalCashDiscrepancy: 0,
          paymentMethods: {},
          dailyPerformance: [],
        });
      }
      return cashierMap.get(key)!;
    };

    // 1. Process Orders
    const globalPaymentMethods: Record<string, number> = {};
    const globalDailySalesMap: Record<string, { date: string; label: string; revenue: number; orders: number }> = {};
    const productSoldMap: Record<string, Record<string, number>> = {}; // cashierKey -> { productName: qty }

    // Init dates in range
    const cursor = new Date(startIso);
    while (cursor <= endIso) {
      const dateKey = cursor.toISOString().split('T')[0];
      const label = cursor.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
      globalDailySalesMap[dateKey] = { date: dateKey, label, revenue: 0, orders: 0 };
      cursor.setDate(cursor.getDate() + 1);
    }

    for (const order of orders) {
      const raw = order.raw_data || {};
      const status = String(order.status || raw.status || '').toUpperCase();
      
      // Determine cashier name/ID
      const cashierName = raw.cashierName || raw.createdByName || order.customer_name || 'Kasir Utama';
      const cashierId = raw.cashierId || raw.createdById || order.user_id || cashierName;

      // Skip filter if specified
      if (filterCashierId && filterCashierId !== 'SEMUA' && cashierId !== filterCashierId && cashierName !== filterCashierId) {
        continue;
      }

      const item = getOrCreateCashier(cashierId, cashierName);
      const totalAmount = Math.round(Number(order.total ?? raw.total ?? raw.totalAmount ?? 0));
      const isCompleted = ['COMPLETED', 'SELESAI', 'SUCCESS', 'CONFIRMED'].includes(status);
      const isCancelled = ['CANCELLED', 'BATAL'].includes(status);
      const paymentMethod = String(raw.paymentMethod || order.payment_method || 'CASH').toUpperCase();
      const orderDateKey = (order.created_at ? new Date(order.created_at) : new Date()).toISOString().split('T')[0];

      item.totalOrders += 1;

      if (isCompleted) {
        item.completedOrdersCount += 1;
        item.totalRevenue += totalAmount;

        // Payment method breakdown per cashier
        item.paymentMethods[paymentMethod] = (item.paymentMethods[paymentMethod] || 0) + totalAmount;
        globalPaymentMethods[paymentMethod] = (globalPaymentMethods[paymentMethod] || 0) + totalAmount;

        // Items sold count & product popularity
        const items = Array.isArray(order.items) ? order.items : (raw.items || []);
        let orderItemQty = 0;
        
        for (const it of items) {
          const qty = Number(it.quantity || it.qty || 1);
          orderItemQty += qty;

          const pName = String(it.name || it.productName || 'Produk').trim();
          const cKey = item.cashierId.toLowerCase();
          if (!productSoldMap[cKey]) productSoldMap[cKey] = {};
          productSoldMap[cKey][pName] = (productSoldMap[cKey][pName] || 0) + qty;
        }
        item.totalItemsSold += orderItemQty;

        // Global daily chart
        if (globalDailySalesMap[orderDateKey]) {
          globalDailySalesMap[orderDateKey].revenue += totalAmount;
          globalDailySalesMap[orderDateKey].orders += 1;
        }
      } else if (isCancelled) {
        item.cancelledOrdersCount += 1;
      }

      if (!item.lastActivityDate || new Date(order.created_at) > new Date(item.lastActivityDate)) {
        item.lastActivityDate = order.created_at;
      }
    }

    // 2. Process Shifts
    const shiftLogs: CashierShiftLog[] = [];

    for (const shift of shifts) {
      const raw = shift.raw_data || {};
      const cName = raw.cashierName || shift.cashier_name || 'Kasir POS';
      const cId = raw.cashierId || shift.cashier_id || cName;

      if (filterCashierId && filterCashierId !== 'SEMUA' && cId !== filterCashierId && cName !== filterCashierId) {
        continue;
      }

      const item = getOrCreateCashier(cId, cName);
      const shiftStatus = (shift.status || raw.status || 'CLOSED').toUpperCase();
      const initialCash = Math.round(Number(shift.initial_cash ?? raw.initialCash ?? 0));
      const expectedCash = Math.round(Number(shift.expected_cash ?? raw.expectedCash ?? 0));
      const actualCash = shift.actual_cash !== null && shift.actual_cash !== undefined 
        ? Math.round(Number(shift.actual_cash)) 
        : (raw.actualCash !== null && raw.actualCash !== undefined ? Math.round(Number(raw.actualCash)) : null);

      const diff = Number(shift.difference ?? raw.difference ?? (actualCash !== null ? actualCash - expectedCash : 0));
      const totalCash = Math.round(Number(shift.total_cash_sales ?? raw.totalCashSales ?? 0));
      const totalNonCash = Math.round(Number(shift.total_non_cash_sales ?? raw.totalNonCashSales ?? 0));

      item.totalShifts += 1;
      if (shiftStatus === 'OPEN') {
        item.activeShiftsCount += 1;
      } else {
        item.closedShiftsCount += 1;
      }

      item.totalCashSales += totalCash;
      item.totalNonCashSales += totalNonCash;
      item.totalCashDiscrepancy += Math.round(diff);

      shiftLogs.push({
        id: shift.id,
        cashierId: cId,
        cashierName: cName,
        openedAt: shift.opened_at || raw.openedAt || shift.created_at,
        closedAt: shift.closed_at || raw.closedAt || null,
        status: shiftStatus as 'OPEN' | 'CLOSED',
        initialCash,
        expectedCash,
        actualCash,
        difference: Math.round(diff),
        totalCashSales: totalCash,
        totalNonCashSales: totalNonCash,
        notes: shift.notes || raw.notes || '',
      });
    }

    // 3. Finalize Cashier Aggregates
    const cashierList = Array.from(cashierMap.values()).map(c => {
      const avgAov = c.completedOrdersCount > 0 ? Math.round(c.totalRevenue / c.completedOrdersCount) : 0;
      
      // Determine top product sold
      const cKey = c.cashierId.toLowerCase();
      let topProduct = '-';
      if (productSoldMap[cKey]) {
        const sortedProducts = Object.entries(productSoldMap[cKey]).sort((a, b) => b[1] - a[1]);
        if (sortedProducts.length > 0) {
          topProduct = `${sortedProducts[0][0]} (${sortedProducts[0][1]} unit)`;
        }
      }

      return {
        ...c,
        averageBasketValue: avgAov,
        topProductSold: topProduct,
      };
    }).sort((a, b) => b.totalRevenue - a.totalRevenue);

    // Summary KPIs
    const grandTotalRevenue = cashierList.reduce((sum, c) => sum + c.totalRevenue, 0);
    const grandTotalOrders = cashierList.reduce((sum, c) => sum + c.completedOrdersCount, 0);
    const grandTotalItemsSold = cashierList.reduce((sum, c) => sum + c.totalItemsSold, 0);
    const grandTotalShifts = cashierList.reduce((sum, c) => sum + c.totalShifts, 0);
    const grandTotalDiscrepancy = cashierList.reduce((sum, c) => sum + c.totalCashDiscrepancy, 0);
    const grandAverageAOV = grandTotalOrders > 0 ? Math.round(grandTotalRevenue / grandTotalOrders) : 0;

    const topPerformer = cashierList.length > 0 && cashierList[0].totalRevenue > 0 ? cashierList[0] : null;

    // Daily Chart Data
    const dailyTrend = Object.values(globalDailySalesMap).sort((a, b) => a.date.localeCompare(b.date));

    // Payment Method Pie Chart Data
    const paymentDistribution = Object.entries(globalPaymentMethods).map(([method, amount]) => ({
      name: method,
      value: amount,
    })).sort((a, b) => b.value - a.value);

    return {
      success: true,
      data: {
        summary: {
          grandTotalRevenue,
          grandTotalOrders,
          grandTotalItemsSold,
          grandAverageAOV,
          grandTotalShifts,
          grandTotalDiscrepancy,
          topPerformerName: topPerformer?.cashierName || '-',
          topPerformerRevenue: topPerformer?.totalRevenue || 0,
        },
        cashierList,
        dailyTrend,
        paymentDistribution,
        shiftLogs,
      },
    };
  } catch (error: any) {
    console.error('getCashierPerformanceReport Error:', error);
    return {
      success: false,
      error: error.message || 'Gagal memuat laporan kinerja kasir',
      data: null,
    };
  }
}
