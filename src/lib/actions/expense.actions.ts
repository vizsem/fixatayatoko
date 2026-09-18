'use server'

import { revalidatePath } from 'next/cache'
import { supabase } from '@/lib/supabase'

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

export async function getExpenses(filters?: {
  category?: string
  startDate?: Date
  endDate?: Date
}) {
  try {
    const query = supabase
      .from('operational_expenses')
      .select('*')
      .order('created_at', { ascending: false });

    const { data: rows, error } = await query;

    if (error || !rows) return [];

    let mapped = rows.map((e: any) => {
      const raw = e.raw_data || {};
      return {
        id: e.id,
        category: raw.category || 'Operasional',
        amount: Number(raw.amount || 0),
        description: raw.description || raw.catatan || '',
        date: parseDate(raw.date || e.created_at),
      };
    });

    if (filters?.category && filters.category !== 'Semua') {
      mapped = mapped.filter(e => e.category.toLowerCase() === filters.category!.toLowerCase());
    }
    if (filters?.startDate) {
      mapped = mapped.filter(e => e.date >= filters.startDate!);
    }
    if (filters?.endDate) {
      mapped = mapped.filter(e => e.date <= filters.endDate!);
    }

    return mapped;
  } catch (error) {
    console.error('Failed to fetch expenses:', error);
    return [];
  }
}

export async function createExpense(data: {
  category: string
  amount: number
  description?: string
  date: Date
}) {
  try {
    const id = `exp_${Date.now()}`;
    const raw_data = {
      category: data.category,
      amount: Number(data.amount),
      description: data.description || '',
      date: data.date.toISOString(),
      createdAt: new Date().toISOString(),
    };

    await supabase.from('operational_expenses').insert({
      id,
      raw_data,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    revalidatePath('/admin/operational-expenses');
    return { success: true, data: { id, ...data } };
  } catch (error) {
    console.error('Failed to create expense:', error);
    return { success: false, error: 'Gagal menyimpan pengeluaran' };
  }
}

export async function deleteExpense(id: string) {
  try {
    await supabase.from('operational_expenses').delete().eq('id', id);
    revalidatePath('/admin/operational-expenses');
    return { success: true };
  } catch (error) {
    console.error('Failed to delete expense:', error);
    return { success: false, error: 'Gagal menghapus pengeluaran' };
  }
}

export async function getExpenseSummary() {
  try {
    const expenses = await getExpenses();
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    let monthlyTotal = 0;
    let monthlyCount = 0;
    let allTimeTotal = 0;
    const categoryTotals: Record<string, number> = {};

    for (const e of expenses) {
      const amt = Number(e.amount || 0);
      allTimeTotal += amt;

      const cat = e.category || 'Lainnya';
      categoryTotals[cat] = (categoryTotals[cat] || 0) + amt;

      if (e.date >= startOfMonth) {
        monthlyTotal += amt;
        monthlyCount++;
      }
    }

    const byCategory = Object.entries(categoryTotals).map(([category, total]) => ({
      category,
      total,
    })).sort((a, b) => b.total - a.total);

    return {
      monthlyTotal,
      monthlyCount,
      allTimeTotal,
      allTimeCount: expenses.length,
      byCategory,
    };
  } catch (error) {
    console.error('Failed to fetch expense summary:', error);
    return { monthlyTotal: 0, monthlyCount: 0, allTimeTotal: 0, allTimeCount: 0, byCategory: [] };
  }
}
