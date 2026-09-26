'use server'

import { revalidatePath } from 'next/cache'
import { supabaseAdmin } from '@/lib/supabase'

function parseDate(val: any): Date {
  if (!val) return new Date();
  if (val.toDate && typeof val.toDate === 'function') {
    return val.toDate();
  }
  if (val._seconds) {
    return new Date(val._seconds * 1000);
  }
  const d = new Date(val);
  return isNaN(d.getTime()) ? new Date() : d;
}

export async function getCapitalData() {
  try {
    const [txRes, loanRes, mpAccRes, mpTxRes, prodRes] = await Promise.all([
      supabaseAdmin.from('capital_transactions').select('*').order('created_at', { ascending: false }).limit(100),
      supabaseAdmin.from('loans').select('*').order('created_at', { ascending: false }),
      supabaseAdmin.from('marketplace_accounts').select('*').order('created_at', { ascending: true }),
      supabaseAdmin.from('marketplace_transactions').select('*').order('created_at', { ascending: false }).limit(50),
      supabaseAdmin.from('products').select('stock, cost_price, is_active, raw_data'),
    ]);

    const transactions = (txRes.data || []).map((t: any) => {
      const raw = t.raw_data || {};
      return {
        id: t.id,
        type: raw.type || 'INJECTION',
        amount: Number(raw.amount || 0),
        description: raw.description || '',
        recordedBy: raw.recordedBy || 'Admin',
        date: parseDate(raw.date || t.created_at),
      };
    });

    const loans = (loanRes.data || []).map((l: any) => {
      const raw = l.raw_data || {};
      return {
        id: l.id,
        lenderName: raw.lenderName || 'Pemberi Pinjaman',
        amount: Number(raw.amount || 0),
        remainingAmount: Number(raw.remainingAmount ?? raw.amount ?? 0),
        description: raw.description || '',
        loanType: raw.loanType || 'STANDARD',
        interestRate: Number(raw.interestRate || 0),
        status: raw.status || 'ACTIVE',
        startDate: parseDate(raw.startDate || l.created_at),
      };
    });

    const marketplaceAccounts = (mpAccRes.data || []).map((m: any) => {
      const raw = m.raw_data || {};
      return {
        id: m.id,
        name: raw.name || 'Marketplace',
        storeName: raw.storeName || '',
        activeBalance: Number(raw.activeBalance || 0),
        pendingBalance: Number(raw.pendingBalance || 0),
        lastUpdated: parseDate(raw.lastUpdated || m.updated_at),
      };
    });

    const marketplaceLogs = (mpTxRes.data || []).map((tx: any) => {
      const raw = tx.raw_data || {};
      return {
        id: tx.id,
        accountId: raw.accountId || '',
        name: raw.name || '',
        storeName: raw.storeName || '',
        type: raw.type || 'ADJUST',
        activeChange: Number(raw.activeChange || 0),
        pendingChange: Number(raw.pendingChange || 0),
        note: raw.note || '',
        recordedBy: raw.recordedBy || 'Admin',
        date: parseDate(raw.date || tx.created_at),
      };
    });

    // Calculate Stock Value directly from ACTIVE products only
    let stockValue = 0;
    let activeProductCount = 0;
    let totalStockUnits = 0;

    for (const p of (prodRes.data || [])) {
      const raw = p.raw_data || {};
      
      // Filter produk aktif: abaikan yang is_active = false atau raw_data.isActive = false
      const isInactive = p.is_active === false || raw.isActive === false || raw.is_active === false || raw.status === 'inactive';
      if (isInactive) {
        continue;
      }

      const stock = Number(p.stock ?? raw.stock ?? raw.Stok ?? 0);
      const cost = Number(p.cost_price ?? raw.purchasePrice ?? raw.Modal ?? raw.costPrice ?? 0);
      
      if (stock > 0) {
        activeProductCount++;
        totalStockUnits += stock;
        if (cost > 0) {
          stockValue += stock * cost;
        }
      }
    }

    // Calculate Liabilities from active loans
    const totalLiabilities = loans
      .filter((l: any) => l.status === 'ACTIVE')
      .reduce((sum: number, l: any) => sum + (l.remainingAmount || 0), 0);

    return {
      success: true,
      data: {
        transactions,
        loans,
        marketplaceAccounts,
        marketplaceLogs,
        assetSummary: {
          stockValue,
          activeProductCount,
          totalStockUnits,
          receivables: 0,
          totalLiabilities,
        },
      },
    };
  } catch (error: any) {
    console.error('Failed to get capital data:', error)
    return { success: false, error: error.message || 'Gagal memuat data modal' }
  }
}

export async function addCapitalTransaction(data: {
  type: 'INJECTION' | 'WITHDRAWAL'
  amount: number
  description?: string
  recordedBy?: string
}) {
  try {
    const id = `cap_${Date.now()}`;
    const raw_data = {
      type: data.type,
      amount: Number(data.amount),
      description: data.description || '',
      recordedBy: data.recordedBy || 'Admin',
      date: new Date().toISOString(),
    };

    await supabaseAdmin.from('capital_transactions').insert({
      id,
      raw_data,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    revalidatePath('/admin/capital');
    return { success: true, data: { id, ...raw_data, date: new Date() } };
  } catch (error: any) {
    console.error('Failed to add capital transaction:', error);
    return { success: false, error: error.message || 'Gagal mencatat transaksi modal' };
  }
}

export async function recordLoan(data: {
  lenderName: string
  amount: number
  description?: string
  loanType?: string
  interestRate?: number
}) {
  try {
    const id = `loan_${Date.now()}`;
    const raw_data = {
      lenderName: data.lenderName,
      amount: Number(data.amount),
      remainingAmount: Number(data.amount),
      description: data.description || '',
      loanType: data.loanType || 'STANDARD',
      interestRate: Number(data.interestRate || 0),
      status: 'ACTIVE',
      startDate: new Date().toISOString(),
    };

    await supabaseAdmin.from('loans').insert({
      id,
      raw_data,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    revalidatePath('/admin/capital');
    return { success: true, data: { id, ...raw_data, startDate: new Date() } };
  } catch (error: any) {
    console.error('Failed to record loan:', error);
    return { success: false, error: error.message || 'Gagal mencatat pinjaman' };
  }
}

export async function repayLoan(loanId: string, repayAmount: number, interestExpense?: number) {
  try {
    const { data: existing } = await supabaseAdmin.from('loans').select('*').eq('id', loanId).single();
    if (!existing) throw new Error('Pinjaman tidak ditemukan');

    const raw = existing.raw_data || {};
    const currentRemaining = Number(raw.remainingAmount ?? raw.amount ?? 0);
    const newRemaining = Math.max(0, currentRemaining - Number(repayAmount));
    const status = newRemaining <= 0 ? 'PAID' : 'ACTIVE';

    raw.remainingAmount = newRemaining;
    raw.status = status;
    raw.updatedAt = new Date().toISOString();

    await supabaseAdmin.from('loans').update({
      raw_data: raw,
      updated_at: new Date().toISOString(),
    }).eq('id', loanId);

    if (interestExpense && interestExpense > 0) {
      await supabaseAdmin.from('operational_expenses').insert({
        id: `exp_${Date.now()}`,
        raw_data: {
          category: 'Bunga Pinjaman',
          amount: Number(interestExpense),
          description: `Bunga Pinjaman: ${raw.lenderName || ''}`,
          date: new Date().toISOString(),
        },
        created_at: new Date().toISOString(),
      });
    }

    revalidatePath('/admin/capital');
    return { success: true, data: { id: loanId, ...raw } };
  } catch (error: any) {
    console.error('Failed to repay loan:', error);
    return { success: false, error: error.message || 'Gagal memproses pembayaran pinjaman' };
  }
}

export async function addMarketplaceAccount(name: string, storeName?: string) {
  try {
    const id = `mp_${Date.now()}`;
    const raw_data = {
      name,
      storeName: storeName || '',
      activeBalance: 0,
      pendingBalance: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await supabaseAdmin.from('marketplace_accounts').insert({
      id,
      raw_data,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    revalidatePath('/admin/capital');
    return { success: true, data: { id, ...raw_data } };
  } catch (error: any) {
    console.error('Failed to add marketplace account:', error);
    return { success: false, error: error.message || 'Gagal menambahkan akun marketplace' };
  }
}

export async function updateMarketplaceBalance(data: {
  accountId: string
  activeBalance: number
  pendingBalance: number
  note?: string
  recordedBy?: string
}) {
  try {
    const { data: existing } = await supabaseAdmin.from('marketplace_accounts').select('*').eq('id', data.accountId).single();
    if (!existing) throw new Error('Akun marketplace tidak ditemukan');

    const raw = existing.raw_data || {};
    const oldActive = Number(raw.activeBalance || 0);
    const oldPending = Number(raw.pendingBalance || 0);
    const activeChange = Number(data.activeBalance) - oldActive;
    const pendingChange = Number(data.pendingBalance) - oldPending;

    raw.activeBalance = Number(data.activeBalance);
    raw.pendingBalance = Number(data.pendingBalance);
    raw.lastUpdated = new Date().toISOString();

    await supabaseAdmin.from('marketplace_accounts').update({
      raw_data: raw,
      updated_at: new Date().toISOString(),
    }).eq('id', data.accountId);

    // Catat log transaksi marketplace
    await supabaseAdmin.from('marketplace_transactions').insert({
      id: `mptx_${Date.now()}`,
      raw_data: {
        accountId: data.accountId,
        name: raw.name || '',
        storeName: raw.storeName || '',
        type: 'ADJUST',
        activeChange,
        pendingChange,
        note: data.note || 'Penyesuaian Saldo',
        recordedBy: data.recordedBy || 'Admin',
        date: new Date().toISOString(),
      },
      created_at: new Date().toISOString(),
    });

    revalidatePath('/admin/capital');
    return { success: true, data: { id: data.accountId, ...raw } };
  } catch (error: any) {
    console.error('Failed to update marketplace balance:', error);
    return { success: false, error: error.message || 'Gagal memperbarui saldo marketplace' };
  }
}

export async function adjustTotalCapital(data: {
  targetCapital: number;
  reason?: string;
  recordedBy?: string;
}) {
  try {
    // 1. Fetch existing transactions to compute current capital
    const { data: rows } = await supabaseAdmin
      .from('capital_transactions')
      .select('*');

    const transactions = (rows || []).map((t: any) => {
      const raw = t.raw_data || {};
      return {
        type: raw.type || 'INJECTION',
        amount: Number(raw.amount || 0),
      };
    });

    const injected = transactions.filter(t => t.type === 'INJECTION').reduce((s, t) => s + t.amount, 0);
    const withdrawn = transactions.filter(t => t.type === 'WITHDRAWAL').reduce((s, t) => s + t.amount, 0);
    const currentCapital = injected - withdrawn;

    const target = Number(data.targetCapital || 0);
    const diff = target - currentCapital;

    if (diff === 0) {
      return { success: true, message: 'Modal sudah sesuai, tidak ada penyesuaian yang dilakukan' };
    }

    const type = diff > 0 ? 'INJECTION' : 'WITHDRAWAL';
    const amount = Math.abs(diff);

    const id = `cap_adj_${Date.now()}`;
    const raw_data = {
      type,
      amount,
      description: data.reason ? `Penyesuaian Modal Total: ${data.reason}` : `Penyesuaian Modal Total (Revisi dari Rp ${currentCapital.toLocaleString('id-ID')} ke Rp ${target.toLocaleString('id-ID')})`,
      recordedBy: data.recordedBy || 'Admin',
      date: new Date().toISOString(),
      isAdjustment: true,
    };

    await supabaseAdmin.from('capital_transactions').insert({
      id,
      raw_data,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    revalidatePath('/admin/capital');
    return { success: true, data: { id, ...raw_data, date: new Date() } };
  } catch (error: any) {
    console.error('Failed to adjust total capital:', error);
    return { success: false, error: error.message || 'Gagal menyesuaikan total modal' };
  }
}

