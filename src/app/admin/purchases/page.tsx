'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { Toaster } from 'react-hot-toast';
import notify from '@/lib/notify';
import {
  ShoppingBag, Plus, Package, Search, X, CheckCircle2, XCircle,
  ChevronRight, Download, Filter, Truck, ClipboardList
} from 'lucide-react';
import {
  getPurchaseOrders, createPurchaseOrder, receivePurchaseOrder,
  updatePurchaseStatus, deletePurchaseOrder
} from '@/lib/actions/purchase.actions';
import { getSuppliers } from '@/lib/actions/supplier.actions';
import { getProducts } from '@/lib/actions/product.actions';
import { getWarehouses } from '@/lib/actions/inventory.actions';
import ProductSearchCombobox from '@/components/admin/ProductSearchCombobox';
import * as XLSX from 'xlsx';

type PO = {
  id: string;
  poNumber: string;
  status: string;
  totalAmount: number;
  notes?: string | null;
  createdAt: Date;
  supplier: { name: string };
  items: { id: string; quantity: number; unitPrice: number; totalPrice: number; product: { name: string; unit: string } }[];
};

const STATUS_COLOR: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-600',
  PENDING_APPROVAL: 'bg-yellow-100 text-yellow-700',
  APPROVED: 'bg-blue-100 text-blue-700',
  RECEIVED: 'bg-green-100 text-green-700',
  CANCELLED: 'bg-red-100 text-red-600',
};

const STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Draft',
  PENDING_APPROVAL: 'Menunggu Approval',
  APPROVED: 'Disetujui',
  RECEIVED: 'Diterima',
  CANCELLED: 'Dibatalkan',
};

type POItem = { productId: string; quantity: number; unitPrice: number };

export default function AdminPurchases() {
  const [loading, setLoading] = useState(true);
  const [pos, setPos] = useState<PO[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [receiveModal, setReceiveModal] = useState<PO | null>(null);
  const [detailModal, setDetailModal] = useState<PO | null>(null);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [form, setForm] = useState({ supplierId: '', notes: '' });
  const [items, setItems] = useState<POItem[]>([{ productId: '', quantity: 1, unitPrice: 0 }]);
  const [receiveForm, setReceiveForm] = useState({ warehouseId: '', batchNumber: '', expiryDate: '' });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const data = await getPurchaseOrders();
    setPos(data as PO[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    Promise.all([
      getSuppliers(),
      getProducts({ isActive: true, limit: 1000 }),
      getWarehouses(),
    ]).then(([s, p, w]) => {
      setSuppliers(s);
      // Strictly filter to ensure only active products are presented
      setProducts((p as any[]).filter((prod) => prod.isActive !== false));
      setWarehouses(w);
    });
  }, [load]);

  const filtered = useMemo(() => pos.filter(p => {
    const matchSearch = p.poNumber.toLowerCase().includes(search.toLowerCase()) ||
      (p.supplier?.name || '').toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || p.status === statusFilter;
    return matchSearch && matchStatus;
  }), [pos, search, statusFilter]);

  const addItem = () => setItems(prev => [...prev, { productId: '', quantity: 1, unitPrice: 0 }]);
  const removeItem = (idx: number) => setItems(prev => prev.filter((_, i) => i !== idx));
  const updateItem = (idx: number, key: keyof POItem, value: any) => {
    setItems(prev => prev.map((item, i) => i === idx ? { ...item, [key]: value } : item));
  };
  const handleProductSelect = (idx: number, productId: string, product?: any) => {
    setItems(prev => prev.map((item, i) => {
      if (i !== idx) return item;
      const defaultPrice = product?.purchasePrice || product?.costPrice || product?.cost_price || item.unitPrice || 0;
      return {
        ...item,
        productId,
        unitPrice: defaultPrice,
      };
    }));
  };

  const totalAmount = items.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0);

  const handleCreate = async () => {
    if (!form.supplierId) { notify.error('Pilih supplier terlebih dahulu'); return; }
    if (items.some(i => !i.productId)) { notify.error('Pilih produk untuk semua item'); return; }
    setSaving(true);
    // We need a createdById - use a placeholder for now
    const result = await createPurchaseOrder({
      supplierId: form.supplierId,
      createdById: 'system', // TODO: get from session
      notes: form.notes || undefined,
      items: items.map(i => ({ productId: i.productId, quantity: i.quantity, unitPrice: i.unitPrice })),
    });
    if (result.success) {
      notify.success('Purchase Order dibuat');
      setModalOpen(false);
      setForm({ supplierId: '', notes: '' });
      setItems([{ productId: '', quantity: 1, unitPrice: 0 }]);
      await load();
    } else {
      notify.error(result.error || 'Gagal membuat PO');
    }
    setSaving(false);
  };

  const handleReceive = async () => {
    if (!receiveModal || !receiveForm.warehouseId) { notify.error('Pilih gudang tujuan'); return; }
    setSaving(true);
    const result = await receivePurchaseOrder(
      receiveModal.id,
      receiveForm.warehouseId,
      receiveForm.batchNumber || undefined,
      receiveForm.expiryDate || undefined,
    );
    if (result.success) {
      notify.success('Barang berhasil diterima & stok diperbarui (FEFO)');
      setReceiveModal(null);
      setReceiveForm({ warehouseId: '', batchNumber: '', expiryDate: '' });
      await load();
    } else {
      notify.error(result.error || 'Gagal menerima PO');
    }
    setSaving(false);
  };

  const exportExcel = () => {
    const rows = filtered.map(p => ({
      'No. PO': p.poNumber,
      'Supplier': p.supplier.name,
      'Status': STATUS_LABEL[p.status] || p.status,
      'Total (Rp)': p.totalAmount,
      'Tanggal': new Date(p.createdAt).toLocaleDateString('id-ID'),
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Purchase Orders');
    XLSX.writeFile(wb, `PO_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  return (
    <>
      <Toaster />
      <div className="min-h-screen bg-gray-50 p-3 md:p-5">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
          <div>
            <h1 className="text-xl font-black text-gray-900">Purchase Orders</h1>
            <p className="text-xs text-gray-500 mt-0.5">{pos.length} total PO</p>
          </div>
          <div className="flex gap-2">
            <button onClick={exportExcel} className="flex items-center gap-2 bg-white border border-gray-200 text-gray-700 px-3 py-2.5 rounded-xl text-sm font-bold hover:bg-gray-50 transition-colors shadow-sm">
              <Download size={15} /> Export
            </button>
            <button onClick={() => setModalOpen(true)} className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2.5 rounded-xl text-sm font-bold hover:bg-emerald-700 transition-colors shadow-sm">
              <Plus size={16} /> Buat PO
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-3 mb-4 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Cari nomor PO atau supplier..."
              className="w-full pl-9 pr-4 py-2 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
          </div>
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="px-3 py-2 text-sm border border-gray-200 rounded-xl bg-gray-50 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="all">Semua Status</option>
            {Object.entries(STATUS_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>

        {/* Stats bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
          {['DRAFT', 'APPROVED', 'RECEIVED', 'CANCELLED'].map(st => (
            <div key={st} className={`rounded-xl p-3 ${STATUS_COLOR[st]} border border-opacity-20`}>
              <p className="text-xs font-bold">{STATUS_LABEL[st]}</p>
              <p className="text-xl font-black">{pos.filter(p => p.status === st).length}</p>
            </div>
          ))}
        </div>

        {/* Table */}
        {loading ? (
          <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" /></div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center">
            <ClipboardList size={40} className="mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500 font-medium">Belum ada purchase order</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">No. PO</th>
                    <th className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Supplier</th>
                    <th className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="text-right px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Total</th>
                    <th className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Tanggal</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filtered.map(po => (
                    <tr key={po.id} className="hover:bg-gray-50 transition-colors group">
                      <td className="px-4 py-3">
                        <span className="font-mono text-xs font-bold text-gray-800">{po.poNumber}</span>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-800">{po.supplier.name}</p>
                        <p className="text-xs text-gray-400">{po.items.length} item</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${STATUS_COLOR[po.status]}`}>
                          {STATUS_LABEL[po.status] || po.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-gray-900">
                        Rp{po.totalAmount.toLocaleString('id-ID')}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">
                        {new Date(po.createdAt).toLocaleDateString('id-ID')}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => setDetailModal(po)} className="px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-xs font-bold hover:bg-gray-200 transition-colors">
                            Detail
                          </button>
                          {po.status === 'APPROVED' && (
                            <button onClick={() => { setReceiveModal(po); setReceiveForm({ warehouseId: '', batchNumber: '', expiryDate: '' }); }}
                              className="px-3 py-1.5 bg-green-100 text-green-700 rounded-lg text-xs font-bold hover:bg-green-200 transition-colors flex items-center gap-1">
                              <Truck size={12} /> Terima
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Create PO Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setModalOpen(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl p-6 my-4">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-black text-gray-900">Buat Purchase Order</h2>
              <button onClick={() => setModalOpen(false)} className="p-1.5 rounded-lg hover:bg-gray-100"><X size={18} /></button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Supplier *</label>
                <select
                  value={form.supplierId}
                  onChange={e => setForm(p => ({ ...p, supplierId: e.target.value }))}
                  className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl bg-gray-50 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="">Pilih Supplier</option>
                  {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold text-gray-700">Item Pembelian *</label>
                  <button onClick={addItem} className="text-xs font-bold text-emerald-600 hover:text-emerald-700">+ Tambah Item</button>
                </div>
                <div className="space-y-2">
                  {items.map((item, idx) => (
                    <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                      <div className="col-span-5">
                        <ProductSearchCombobox
                          value={item.productId}
                          products={products}
                          onChange={(productId, product) => handleProductSelect(idx, productId, product)}
                          placeholder="Pilih / Cari Produk..."
                        />
                      </div>
                      <div className="col-span-2">
                        <input
                          type="number" min="1" value={item.quantity}
                          onChange={e => updateItem(idx, 'quantity', Number(e.target.value))}
                          placeholder="Qty"
                          className="w-full px-2 py-2 text-xs border border-gray-200 rounded-lg bg-gray-50 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                      </div>
                      <div className="col-span-4">
                        <input
                          type="number" min="0" value={item.unitPrice}
                          onChange={e => updateItem(idx, 'unitPrice', Number(e.target.value))}
                          placeholder="Harga/unit"
                          className="w-full px-2 py-2 text-xs border border-gray-200 rounded-lg bg-gray-50 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                      </div>
                      <div className="col-span-1">
                        {items.length > 1 && (
                          <button onClick={() => removeItem(idx)} className="p-1 text-red-400 hover:text-red-600">
                            <X size={14} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-2 text-right">
                  <span className="text-sm font-bold text-gray-800">Total: Rp{totalAmount.toLocaleString('id-ID')}</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Catatan</label>
                <textarea
                  value={form.notes}
                  onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                  rows={2}
                  placeholder="Catatan tambahan..."
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl bg-gray-50 focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={() => setModalOpen(false)} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-bold text-gray-600 hover:bg-gray-50">Batal</button>
              <button onClick={handleCreate} disabled={saving} className="flex-1 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 disabled:opacity-50">
                {saving ? 'Menyimpan...' : 'Buat PO'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Receive PO Modal */}
      {receiveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setReceiveModal(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-black text-gray-900">Terima Barang</h2>
              <button onClick={() => setReceiveModal(null)} className="p-1.5 rounded-lg hover:bg-gray-100"><X size={18} /></button>
            </div>
            <p className="text-xs text-gray-500 mb-4">PO: <strong>{receiveModal.poNumber}</strong> — {receiveModal.supplier.name}</p>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Gudang Tujuan *</label>
                <select
                  value={receiveForm.warehouseId}
                  onChange={e => setReceiveForm(p => ({ ...p, warehouseId: e.target.value }))}
                  className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl bg-gray-50 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="">Pilih Gudang</option>
                  {warehouses.map((w: any) => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">No. Batch (opsional)</label>
                <input
                  value={receiveForm.batchNumber}
                  onChange={e => setReceiveForm(p => ({ ...p, batchNumber: e.target.value }))}
                  placeholder="Contoh: BATCH-001"
                  className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl bg-gray-50 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Tanggal Expired (opsional)</label>
                <input
                  type="date"
                  value={receiveForm.expiryDate}
                  onChange={e => setReceiveForm(p => ({ ...p, expiryDate: e.target.value }))}
                  className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl bg-gray-50 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 mt-4">
              <p className="text-xs text-emerald-700 font-medium">
                🔒 Sistem FEFO aktif — stok akan diurutkan berdasarkan tanggal expired terdekat saat pengurangan.
              </p>
            </div>

            <div className="flex gap-3 mt-5">
              <button onClick={() => setReceiveModal(null)} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-bold text-gray-600 hover:bg-gray-50">Batal</button>
              <button onClick={handleReceive} disabled={saving} className="flex-1 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 disabled:opacity-50">
                {saving ? 'Memproses...' : 'Konfirmasi Terima'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {detailModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setDetailModal(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-lg font-black text-gray-900">Detail PO</h2>
                <p className="text-xs text-gray-500 mt-0.5 font-mono">{detailModal.poNumber}</p>
              </div>
              <button onClick={() => setDetailModal(null)} className="p-1.5 rounded-lg hover:bg-gray-100"><X size={18} /></button>
            </div>
            <div className="flex gap-3 mb-4">
              <div className="flex-1 bg-gray-50 rounded-xl p-3">
                <p className="text-xs text-gray-400 font-medium">Supplier</p>
                <p className="font-bold text-gray-800 text-sm">{detailModal.supplier.name}</p>
              </div>
              <div className="flex-1 bg-gray-50 rounded-xl p-3">
                <p className="text-xs text-gray-400 font-medium">Status</p>
                <span className={`px-2 py-0.5 rounded-lg text-xs font-bold ${STATUS_COLOR[detailModal.status]}`}>
                  {STATUS_LABEL[detailModal.status]}
                </span>
              </div>
            </div>
            <table className="w-full text-sm mb-4">
              <thead><tr className="bg-gray-50 text-xs font-bold text-gray-500 uppercase">
                <th className="text-left p-2 rounded-tl-lg">Produk</th>
                <th className="text-center p-2">Qty</th>
                <th className="text-right p-2 rounded-tr-lg">Subtotal</th>
              </tr></thead>
              <tbody className="divide-y divide-gray-50">
                {detailModal.items.map((item, idx) => (
                  <tr key={idx}>
                    <td className="p-2 text-gray-800 font-medium">{item.product.name}</td>
                    <td className="p-2 text-center text-gray-600">{item.quantity} {item.product.unit}</td>
                    <td className="p-2 text-right font-bold text-gray-900">Rp{item.totalPrice.toLocaleString('id-ID')}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-gray-200">
                  <td colSpan={2} className="p-2 font-bold text-gray-800 text-right">Total:</td>
                  <td className="p-2 text-right font-black text-emerald-700 text-lg">Rp{detailModal.totalAmount.toLocaleString('id-ID')}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
