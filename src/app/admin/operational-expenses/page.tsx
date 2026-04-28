'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { collection, query, orderBy, getDocs, deleteDoc, doc, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { OperationalExpense } from '@/lib/types';
import { Plus, Search, Filter, Download, FileText } from 'lucide-react';
import Link from 'next/link';
import notify from '@/lib/notify';
import * as XLSX from 'xlsx';
import { TableSkeleton } from '@/components/admin/InventorySkeleton';
import * as Sentry from '@sentry/nextjs';

// Components
import { ExpensesSummary } from '@/components/admin/expenses/ExpensesSummary';
import { ExpensesTable } from '@/components/admin/expenses/ExpensesTable';

export default function OperationalExpensesPage() {
  const [expenses, setExpenses] = useState<OperationalExpense[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('Semua');
  const [dateFilter, setDateFilter] = useState('bulan-ini');

  const categories = ['Listrik', 'Air', 'Gaji', 'Packing', 'Bensin', 'Pajak', 'Lainnya'];

  useEffect(() => {
    const fetchExpenses = async () => {
      setLoading(true);
      try {
        const q = query(collection(db, 'operational_expenses'), orderBy('date', 'desc'));
        const snapshot = await getDocs(q);
        setExpenses(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as OperationalExpense[]);
      } catch (error) {
        Sentry.captureException(error);
        notify.error('Failed to load expenses');
      } finally {
        setLoading(false);
      }
    };
    fetchExpenses();
  }, []);

  const filteredExpenses = useMemo(() => {
    return expenses.filter(expense => {
      const q = searchTerm.toLowerCase();
      const matchesSearch = expense.description.toLowerCase().includes(q) || expense.category.toLowerCase().includes(q);
      const matchesCategory = categoryFilter === 'Semua' || expense.category === categoryFilter;
      
      let matchesDate = true;
      if (dateFilter === 'bulan-ini' && expense.date) {
        const d = expense.date instanceof Timestamp ? expense.date.toDate() : new Date(expense.date);
        const now = new Date();
        matchesDate = d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      }
      return matchesSearch && matchesCategory && matchesDate;
    });
  }, [expenses, searchTerm, categoryFilter, dateFilter]);

  const totalAmount = useMemo(() => filteredExpenses.reduce((s, i) => s + Number(i.amount), 0), [filteredExpenses]);

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this record?')) return;
    try {
      await deleteDoc(doc(db, 'operational_expenses', id));
      setExpenses(prev => prev.filter(item => item.id !== id));
      notify.success('Expense deleted');
    } catch (error) {
      Sentry.captureException(error);
      notify.error('Delete failed');
    }
  };

  const handleExport = () => {
    const ws = XLSX.utils.json_to_sheet(filteredExpenses.map(i => ({ Date: i.date instanceof Timestamp ? i.date.toDate() : i.date, Category: i.category, Description: i.description, Amount: i.amount })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Expenses');
    XLSX.writeFile(wb, `Expenses_${dateFilter}.xlsx`);
  };

  if (loading) return <div className="p-6"><TableSkeleton rows={10} /></div>;

  return (
    <div className="p-3 md:p-6 bg-[#F8FAFC] min-h-screen pb-32">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end mb-10 gap-6">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <FileText className="text-blue-600" size={32} /> Operational Outflow
          </h1>
          <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.3em] mt-1">Management of organizational expenditures</p>
        </div>
        <div className="flex gap-3">
          <button onClick={handleExport} className="px-6 py-4 bg-white text-slate-900 border border-slate-200 rounded-2xl text-[10px] font-black tracking-widest flex items-center gap-2 hover:bg-slate-50 transition-all shadow-sm">
             <Download size={18} /> EXPORT DATA
          </button>
          <Link href="/admin/operational-expenses/add" className="px-8 py-4 bg-slate-900 text-white rounded-2xl text-[10px] font-black tracking-widest flex items-center gap-2 hover:bg-black shadow-xl transition-all">
             <Plus size={18} /> RECORD EXPENSE
          </Link>
        </div>
      </div>

      <ExpensesSummary 
        totalAmount={totalAmount} 
        totalCount={filteredExpenses.length} 
        period={dateFilter === 'bulan-ini' ? 'THIS MONTH' : 'ALL TIME'} 
      />

      <div className="bg-white p-3 rounded-[2.5rem] shadow-sm border border-slate-100 mb-8 flex flex-col lg:flex-row items-center gap-4">
        <div className="relative flex-1 w-full">
           <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
           <input type="text" placeholder="Filter by statement or category..." className="w-full pl-16 pr-6 py-4 bg-slate-50 border-none rounded-2xl text-xs font-bold outline-none focus:ring-4 focus:ring-blue-50 transition-all" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        </div>
        <div className="flex gap-2 w-full lg:w-auto">
           <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} className="bg-slate-50 border-none rounded-2xl px-6 py-4 text-[10px] font-black uppercase outline-none">
              <option value="Semua">ALL CATEGORIES</option>
              {categories.map(c => <option key={c} value={c}>{c.toUpperCase()}</option>)}
           </select>
           <select value={dateFilter} onChange={e => setDateFilter(e.target.value)} className="bg-slate-50 border-none rounded-2xl px-6 py-4 text-[10px] font-black uppercase outline-none">
              <option value="bulan-ini">THIS MONTH</option>
              <option value="semua">ALL TIME</option>
           </select>
        </div>
      </div>

      <ExpensesTable expenses={filteredExpenses} onDelete={handleDelete} />
    </div>
  );
}
