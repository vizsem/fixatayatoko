'use client';

import { useState, useMemo } from 'react';
import { auth, db } from '@/lib/firebase';
import { adjustStockTx } from '@/lib/inventory';
import { postJournal } from '@/lib/ledger';

import useProducts from '@/lib/hooks/useProducts';
import type { NormalizedProduct } from '@/lib/normalize';

import {
  collection,
  doc,
  updateDoc,
  serverTimestamp,
  getDoc,
  runTransaction
} from 'firebase/firestore';
import {
  ArrowLeft,
  RotateCcw,
  Search,
  AlertCircle,
  CheckCircle2,
  ClipboardCheck,
  Plus,
  Package,
  TrendingUp,
  TrendingDown,
  FileText,
  Download,
  Filter
} from 'lucide-react';
import Link from 'next/link';
import { Toaster } from 'react-hot-toast';
import notify from '@/lib/notify';

interface ReconciliationItem {
  product: NormalizedProduct;
  systemStock: number;
  physicalStock: number;
  difference: number;
  status: 'matched' | 'surplus' | 'deficit';
}

export default function StockReconciliationPage() {
  const { products, loading: productsLoading } = useProducts({ isActive: true, orderByField: 'name' });
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'matched' | 'mismatched'>('all');
  const [reconciliationItems, setReconciliationItems] = useState<ReconciliationItem[]>([]);
  const [isReconciling, setIsReconciling] = useState(false);
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>('gudang-utama');
  const [reconciliationNote, setReconciliationNote] = useState('');

  // Initialize reconciliation items when products load
  useState(() => {
    if (products.length > 0 && reconciliationItems.length === 0) {
      const items = products.map(p => ({
        product: p,
        systemStock: p.stock || 0,
        physicalStock: p.stock || 0,
        difference: 0,
        status: 'matched' as const
      }));
      setReconciliationItems(items);
    }
  });

  // Filter products based on search and status
  const filteredItems = useMemo(() => {
    return reconciliationItems.filter(item => {
      const nameMatch = item.product.name?.toLowerCase().includes(searchTerm.toLowerCase()) || false;
      const skuMatch = (item.product as any).sku?.toLowerCase().includes(searchTerm.toLowerCase()) || false;
      const matchesSearch = nameMatch || skuMatch;
      
      let matchesFilter = true;
      if (filterStatus === 'matched') {
        matchesFilter = item.status === 'matched';
      } else if (filterStatus === 'mismatched') {
        matchesFilter = item.status !== 'matched';
      }
      
      return matchesSearch && matchesFilter;
    });
  }, [reconciliationItems, searchTerm, filterStatus]);

  // Statistics
  const stats = useMemo(() => {
    const total = reconciliationItems.length;
    const matched = reconciliationItems.filter(i => i.status === 'matched').length;
    const surplus = reconciliationItems.filter(i => i.status === 'surplus').length;
    const deficit = reconciliationItems.filter(i => i.status === 'deficit').length;
    const mismatched = surplus + deficit;
    
    return { total, matched, surplus, deficit, mismatched };
  }, [reconciliationItems]);

  // Update physical stock for a product
  const updatePhysicalStock = (productId: string, physicalStock: number) => {
    setReconciliationItems(prev => prev.map(item => {
      if (item.product.id === productId) {
        const difference = physicalStock - item.systemStock;
        const status = difference === 0 ? 'matched' : difference > 0 ? 'surplus' : 'deficit';
        return { ...item, physicalStock, difference, status };
      }
      return item;
    }));
  };

  // Reset all items to match system stock
  const resetAllToSystem = () => {
    setReconciliationItems(prev => prev.map(item => ({
      ...item,
      physicalStock: item.systemStock,
      difference: 0,
      status: 'matched'
    })));
    notify.admin.info('Semua stok fisik disetel sama dengan stok sistem');
  };

  // Execute reconciliation
  const handleReconcile = async () => {
    const mismatchedItems = reconciliationItems.filter(item => item.status !== 'matched');
    
    if (mismatchedItems.length === 0) {
      notify.admin.warning('Tidak ada perbedaan stok untuk direkonsiliasi');
      return;
    }

    const confirmMsg = `Anda akan merekonsiliasi ${mismatchedItems.length} produk dengan perbedaan stok. Lanjutkan?`;
    if (!window.confirm(confirmMsg)) return;

    setLoading(true);
    try {
      const adminId = auth.currentUser?.uid || 'system';
      const timestamp = new Date().toISOString();

      await runTransaction(db, async (tx) => {
        for (const item of mismatchedItems) {
          const productRef = doc(db, 'products', item.product.id);
          const pSnap = await tx.get(productRef);
          
          if (!pSnap.exists()) {
            throw new Error(`Produk ${item.product.name} tidak ditemukan`);
          }

          const data = pSnap.data();
          const currentTotal = Number(data.stock || 0);
          const stockByWarehouse = data.stockByWarehouse || {};
          const currentMain = Number(stockByWarehouse[selectedWarehouse] || 0);

          // Calculate difference from physical vs system
          const totalDiff = item.physicalStock - currentTotal;
          
          // Apply difference to selected warehouse
          let newWarehouseStock = currentMain + totalDiff;
          if (newWarehouseStock < 0) newWarehouseStock = 0;

          // Adjust stock in the selected warehouse
          await adjustStockTx(tx, {
            productId: item.product.id,
            newStock: newWarehouseStock,
            warehouseId: selectedWarehouse,
            adminId,
            source: 'RECONCILIATION',
            note: reconciliationNote || `Rekonsiliasi stok: selisih ${totalDiff} ${item.product.unit || 'pcs'}`
          });

          // Post to ledger if there's a difference
          if (totalDiff !== 0) {
            const costPrice = Number(data.Modal || data.purchasePrice || 0);
            const diffValue = Math.abs(totalDiff) * costPrice;

            if (diffValue > 0) {
              if (totalDiff < 0) {
                // Loss
                await postJournal({
                  debitAccount: 'LossOnInventory',
                  creditAccount: 'Inventory',
                  amount: diffValue,
                  memo: `Rekonsiliasi (Kurang ${Math.abs(totalDiff)} ${data.unit || 'pcs'}): ${reconciliationNote}`,
                  referenceId: `RECON-${timestamp}-${item.product.id}`,
                  postedBy: adminId
                });
              } else {
                // Gain
                await postJournal({
                  debitAccount: 'Inventory',
                  creditAccount: 'GainOnInventory',
                  amount: diffValue,
                  memo: `Rekonsiliasi (Lebih ${totalDiff} ${data.unit || 'pcs'}): ${reconciliationNote}`,
                  referenceId: `RECON-${timestamp}-${item.product.id}`,
                  postedBy: adminId
                });
              }
            }
          }
        }
      });

      notify.admin.success(`Rekonsiliasi berhasil! ${mismatchedItems.length} produk disesuaikan`);
      
      // Reset after successful reconciliation
      setReconciliationItems(prev => prev.map(item => ({
        ...item,
        systemStock: item.physicalStock,
        difference: 0,
        status: 'matched'
      })));
      
      setReconciliationNote('');
    } catch (error: any) {
      console.error('Reconciliation error:', error);
      notify.admin.error(`Gagal melakukan rekonsiliasi: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Export reconciliation report
  const exportReport = () => {
    const mismatchedItems = reconciliationItems.filter(item => item.status !== 'matched');
    
    if (mismatchedItems.length === 0) {
      notify.admin.warning('Tidak ada data perbedaan untuk diekspor');
      return;
    }

    const csvContent = [
      ['SKU', 'Nama Produk', 'Stok Sistem', 'Stok Fisik', 'Selisih', 'Status'].join(','),
      ...mismatchedItems.map(item => [
        (item.product as any).sku || '',
        `"${item.product.name}"`,
        item.systemStock,
        item.physicalStock,
        item.difference,
        item.status.toUpperCase()
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reconciliation-report-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    
    notify.admin.success('Laporan rekonsiliasi berhasil diunduh');
  };

  if (productsLoading) {
    return (
      <div className="p-6 bg-[#FBFBFE] min-h-screen">
        <div className="max-w-7xl mx-auto">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-gray-200 rounded w-1/3"></div>
            <div className="h-64 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-3 md:p-6 bg-[#FBFBFE] min-h-screen pb-32">
      <Toaster position="top-right" />
      
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Link href="/admin/inventory" className="p-2 hover:bg-gray-100 rounded-xl transition-all">
                <ArrowLeft size={20} />
              </Link>
              <h1 className="text-2xl font-black text-gray-900 tracking-tight flex items-center gap-2">
                <ClipboardCheck className="text-blue-500" /> Rekonsiliasi Stok
              </h1>
            </div>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-10">
              Cocokkan stok sistem dengan stok fisik
            </p>
          </div>

          <div className="flex gap-2">
            <button
              onClick={resetAllToSystem}
              className="px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-50 transition-all flex items-center gap-2"
            >
              <RotateCcw size={14} /> Reset Semua
            </button>
            <button
              onClick={exportReport}
              className="px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-50 transition-all flex items-center gap-2"
            >
              <Download size={14} /> Export CSV
            </button>
          </div>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
            <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Total Produk</div>
            <div className="text-2xl font-black text-gray-900">{stats.total}</div>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
            <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Cocok</div>
            <div className="text-2xl font-black text-green-600">{stats.matched}</div>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
            <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Surplus</div>
            <div className="text-2xl font-black text-blue-600">{stats.surplus}</div>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
            <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Defisit</div>
            <div className="text-2xl font-black text-red-600">{stats.deficit}</div>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
            <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Perlu Aksi</div>
            <div className="text-2xl font-black text-orange-600">{stats.mismatched}</div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
              <input
                type="text"
                placeholder="Cari SKU atau Nama..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-gray-50 rounded-xl text-xs font-bold outline-none border border-transparent focus:border-blue-500 transition-all"
              />
            </div>
            
            <div>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as any)}
                className="w-full px-4 py-2.5 bg-gray-50 rounded-xl text-xs font-bold outline-none border border-transparent focus:border-blue-500 transition-all"
              >
                <option value="all">Semua Status</option>
                <option value="matched">Cocok Saja</option>
                <option value="mismatched">Tidak Cocok</option>
              </select>
            </div>

            <div>
              <select
                value={selectedWarehouse}
                onChange={(e) => setSelectedWarehouse(e.target.value)}
                className="w-full px-4 py-2.5 bg-gray-50 rounded-xl text-xs font-bold outline-none border border-transparent focus:border-blue-500 transition-all"
              >
                <option value="gudang-utama">Gudang Utama</option>
                <option value="gudang-cabang">Gudang Cabang</option>
              </select>
            </div>

            <div className="text-xs text-gray-500 flex items-center">
              Menampilkan {filteredItems.length} dari {reconciliationItems.length} produk
            </div>
          </div>
        </div>

        {/* Reconciliation Table */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden mb-6">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="px-6 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Produk</th>
                  <th className="px-6 py-4 text-right text-[10px] font-black text-gray-400 uppercase tracking-widest">Stok Sistem</th>
                  <th className="px-6 py-4 text-right text-[10px] font-black text-gray-400 uppercase tracking-widest">Stok Fisik</th>
                  <th className="px-6 py-4 text-right text-[10px] font-black text-gray-400 uppercase tracking-widest">Selisih</th>
                  <th className="px-6 py-4 text-center text-[10px] font-black text-gray-400 uppercase tracking-widest">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredItems.map((item) => (
                  <tr key={item.product.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                          <Package size={18} className="text-gray-400" />
                        </div>
                        <div>
                          <div className="text-xs font-black text-gray-900">{item.product.name}</div>
                          <div className="text-[10px] text-gray-400 font-bold">{(item.product as any).sku || '-'}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className="text-xs font-black text-gray-900">{item.systemStock}</span>
                      <span className="text-[10px] text-gray-400 ml-1">{item.product.unit || 'pcs'}</span>
                    </td>
                    <td className="px-6 py-4">
                      <input
                        type="number"
                        min="0"
                        value={item.physicalStock}
                        onChange={(e) => updatePhysicalStock(item.product.id, parseInt(e.target.value) || 0)}
                        className="w-24 px-3 py-2 text-right bg-gray-50 rounded-lg text-xs font-black outline-none border border-transparent focus:border-blue-500 transition-all"
                      />
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className={`inline-flex items-center gap-1 text-xs font-black ${
                        item.difference === 0 ? 'text-gray-400' :
                        item.difference > 0 ? 'text-blue-600' : 'text-red-600'
                      }`}>
                        {item.difference > 0 ? <TrendingUp size={14} /> : 
                         item.difference < 0 ? <TrendingDown size={14} /> : null}
                        {item.difference > 0 ? '+' : ''}{item.difference}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-[10px] font-black ${
                        item.status === 'matched' ? 'bg-green-100 text-green-700' :
                        item.status === 'surplus' ? 'bg-blue-100 text-blue-700' :
                        'bg-red-100 text-red-700'
                      }`}>
                        {item.status === 'matched' ? <CheckCircle2 size={12} /> : <AlertCircle size={12} />}
                        {item.status === 'matched' ? 'COCOK' :
                         item.status === 'surplus' ? 'SURPLUS' : 'DEFISIT'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filteredItems.length === 0 && (
            <div className="py-12 text-center">
              <FileText size={48} className="mx-auto text-gray-300 mb-3" />
              <p className="text-sm font-bold text-gray-400">Tidak ada produk yang ditemukan</p>
            </div>
          )}
        </div>

        {/* Reconciliation Actions */}
        {stats.mismatched > 0 && (
          <div className="bg-gradient-to-r from-orange-50 to-red-50 border border-orange-200 rounded-2xl p-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <h3 className="text-sm font-black text-gray-900 mb-1 flex items-center gap-2">
                  <AlertCircle size={16} className="text-orange-600" />
                  Ada {stats.mismatched} produk dengan perbedaan stok
                </h3>
                <p className="text-xs text-gray-600">Pastikan Anda sudah memverifikasi stok fisik sebelum merekonsiliasi</p>
              </div>
              
              <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                <input
                  type="text"
                  placeholder="Catatan rekonsiliasi (opsional)"
                  value={reconciliationNote}
                  onChange={(e) => setReconciliationNote(e.target.value)}
                  className="px-4 py-2.5 bg-white rounded-xl text-xs font-bold outline-none border border-gray-200 focus:border-orange-500 transition-all min-w-[250px]"
                />
                <button
                  onClick={handleReconcile}
                  disabled={loading}
                  className="px-6 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-xs font-black transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 whitespace-nowrap"
                >
                  {loading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Memproses...
                    </>
                  ) : (
                    <>
                      <ClipboardCheck size={14} />
                      Rekonsiliasi Sekarang
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {stats.mismatched === 0 && reconciliationItems.length > 0 && (
          <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-2xl p-6 text-center">
            <CheckCircle2 size={48} className="mx-auto text-green-600 mb-3" />
            <h3 className="text-sm font-black text-gray-900 mb-1">Semua Stok Sudah Cocok!</h3>
            <p className="text-xs text-gray-600">Tidak ada perbedaan antara stok sistem dan stok fisik</p>
          </div>
        )}
      </div>
    </div>
  );
}
