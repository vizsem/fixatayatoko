'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { Toaster } from 'react-hot-toast';
import notify from '@/lib/notify';
import { SATUAN_LIST } from '@/lib/constants/satuan';
import {
  ShoppingBag, Plus, Package, Search, X, CheckCircle2, XCircle,
  ChevronRight, Download, Filter, Truck, ClipboardList, Printer, RotateCcw,
  CheckSquare, Square, DollarSign, AlertCircle, Loader2
} from 'lucide-react';
import {
  getPurchaseOrders, createPurchaseOrder, receivePurchaseOrder,
  updatePurchaseStatus, deletePurchaseOrder, cancelPurchaseOrder,
  payPurchaseDebt, payBulkPurchaseDebt
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
  paymentStatus?: string;
  paymentMethod?: string;
  dueDate?: string | null;
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

const PAYMENT_METHOD_LABEL: Record<string, string> = {
  CASH: 'CASH / TUNAI',
  TRANSFER: 'TRANSFER BANK',
  TEMPO: 'TEMPO / NET',
  DP: 'DP + PELUNASAN',
  GIRO: 'GIRO / CEK',
  QRIS: 'QRIS',
  KREDIT: 'KREDIT',
  KONSINYASI: 'KONSINYASI',
};

type POItem = {
  productId: string;
  quantity: number;
  unitPrice: number;
  unit?: string;
  availableUnits?: { code: string; contains?: number; price?: number }[];
};

export default function AdminPurchases() {
  const [loading, setLoading] = useState(true);
  const [pos, setPos] = useState<PO[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [paymentMethodFilter, setPaymentMethodFilter] = useState('all');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [receiveModal, setReceiveModal] = useState<PO | null>(null);
  const [detailModal, setDetailModal] = useState<PO | null>(null);
  const [selectedPayable, setSelectedPayable] = useState<PO | null>(null);
  const [payMethod, setPayMethod] = useState('CASH');
  const [payNotes, setPayNotes] = useState('');
  const [paying, setPaying] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkPayModalOpen, setBulkPayModalOpen] = useState(false);
  const [bulkPayMethod, setBulkPayMethod] = useState('CASH');
  const [bulkPayNotes, setBulkPayNotes] = useState('');
  const [bulkPaying, setBulkPaying] = useState(false);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [form, setForm] = useState({
    supplierId: '',
    notes: '',
    autoReceive: false,
    warehouseId: '',
    batchNumber: '',
    expiryDate: '',
    paymentStatus: 'LUNAS',
    paymentMethod: 'CASH',
    dueDate: '',
  });
  const [items, setItems] = useState<POItem[]>([{ productId: '', quantity: 1, unitPrice: 0, unit: 'PCS', availableUnits: [] }]);
  const [receiveForm, setReceiveForm] = useState({ warehouseId: '', batchNumber: '', expiryDate: '' });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const data = await getPurchaseOrders();
    setPos(data as PO[]);
    setLoading(false);
  }, []);

  /**
   * Muat ulang produk/supplier/gudang.
   *
   * Dulu ini hanya dijalankan sekali saat halaman dibuka, sehingga kolom
   * "STOK SAAT INI" tetap angka lama setelah PO diterima. Halaman ini TIDAK
   * bisa mengandalkan Realtime untuk memperbaruinya: publication
   * `supabase_realtime` belum memuat tabel `products` (lihat migrasi
   * 20261006_realtime_publication.sql). Jadi pemuatan ulang eksplisit inilah
   * yang menjamin angkanya benar.
   */
  const loadMeta = useCallback(async () => {
    const [s, p, w] = await Promise.all([
      getSuppliers(),
      getProducts({ isActive: true, limit: 1000 }),
      getWarehouses(),
    ]);
    setSuppliers(s);
    // Strictly filter to ensure only active products are presented
    setProducts((p as any[]).filter((prod) => prod.isActive !== false));
    setWarehouses(w);
  }, []);

  useEffect(() => {
    load();
    loadMeta();
  }, [load, loadMeta]);

  const filtered = useMemo(() => pos.filter(p => {
    const q = search.trim().toLowerCase();
    const matchSearch = !q ||
      p.poNumber.toLowerCase().includes(q) ||
      (p.supplier?.name || '').toLowerCase().includes(q) ||
      (p.paymentMethod || '').toLowerCase().includes(q) ||
      (p.paymentStatus || '').toLowerCase().includes(q) ||
      (p.notes || '').toLowerCase().includes(q) ||
      (p.items || []).some(item => (item.product?.name || '').toLowerCase().includes(q));

    const matchStatus = statusFilter === 'all' || p.status === statusFilter;
    const matchPaymentMethod = paymentMethodFilter === 'all' || (p.paymentMethod || 'CASH').toUpperCase() === paymentMethodFilter.toUpperCase();
    const matchPaymentStatus = paymentStatusFilter === 'all' || (p.paymentStatus || 'LUNAS').toUpperCase() === paymentStatusFilter.toUpperCase();

    return matchSearch && matchStatus && matchPaymentMethod && matchPaymentStatus;
  }), [pos, search, statusFilter, paymentMethodFilter, paymentStatusFilter]);

  const addItem = () => setItems(prev => [...prev, { productId: '', quantity: 1, unitPrice: 0, unit: 'PCS', availableUnits: [] }]);
  const removeItem = (idx: number) => setItems(prev => prev.filter((_, i) => i !== idx));
  const updateItem = (idx: number, key: keyof POItem, value: any) => {
    setItems(prev => prev.map((item, i) => i === idx ? { ...item, [key]: value } : item));
  };
  const handleProductSelect = (idx: number, productId: string, product?: any) => {
    setItems(prev => prev.map((item, i) => {
      if (i !== idx) return item;
      const defaultPrice = product?.purchasePrice || product?.costPrice || product?.cost_price || product?.price || item.unitPrice || 0;
      const baseUnit = (product?.unit || product?.Satuan || 'PCS').toUpperCase();

      let availableUnits: { code: string; contains?: number; price?: number }[] = [];
      if (Array.isArray(product?.units) && product.units.length > 0) {
        // Use configured multi-unit array from product
        availableUnits = product.units.map((u: any) => ({ code: u.code, contains: u.contains, price: u.price }));
      } else {
        // Fallback: always show a full common unit list so buyer can choose freely
        const COMMON_UNITS = ['PCS', 'DUS', 'KARTON', 'SLOP', 'PAK', 'BAL', 'POUCH', 'BANTAL', 'KG', 'LITER', 'LUSIN'];
        // Put base unit first, then the rest
        const rest = COMMON_UNITS.filter(u => u !== baseUnit);
        availableUnits = [baseUnit, ...rest].map(code => ({
          code,
          contains: 1,
          price: code === baseUnit ? defaultPrice : undefined,
        }));
      }

      const selectedUnit = availableUnits[0]?.code || baseUnit;

      return {
        ...item,
        productId,
        unitPrice: defaultPrice,
        unit: selectedUnit,
        availableUnits,
      };
    }));
  };

  const totalAmount = items.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0);

  const handleCreate = async () => {
    if (!form.supplierId) { notify.error('Pilih supplier terlebih dahulu'); return; }
    if (items.some(i => !i.productId)) { notify.error('Pilih produk untuk semua item'); return; }
    if (form.autoReceive && !form.warehouseId) { notify.error('Pilih gudang tujuan penerimaan'); return; }

    setSaving(true);
    const result = await createPurchaseOrder({
      supplierId: form.supplierId,
      createdById: 'system',
      notes: form.notes || undefined,
      items: items.map(i => ({ productId: i.productId, quantity: i.quantity, unitPrice: i.unitPrice, unit: i.unit })),
      autoReceive: form.autoReceive,
      warehouseId: form.autoReceive ? form.warehouseId : undefined,
      batchNumber: form.autoReceive && form.batchNumber ? form.batchNumber : undefined,
      expiryDate: form.autoReceive && form.expiryDate ? form.expiryDate : undefined,
      paymentStatus: form.paymentStatus,
      paymentMethod: form.paymentMethod,
      dueDate: form.dueDate || undefined,
    });
    if (result.success) {
      // `warning` = PO tersimpan tetapi stok belum seluruhnya masuk. Jangan
      // tampilkan pesan sukses biasa, karena pengguna akan mengira stok sudah
      // bertambah dan tidak mengecek lagi.
      if ((result as { warning?: string }).warning) {
        notify.admin.warning((result as { warning?: string }).warning!);
      } else {
        notify.success(form.autoReceive ? 'PO berhasil dibuat & stok telah ditambahkan!' : 'Purchase Order berhasil dibuat');
      }
      setModalOpen(false);
      setForm({
        supplierId: '',
        notes: '',
        autoReceive: false,
        warehouseId: '',
        batchNumber: '',
        expiryDate: '',
        paymentStatus: 'LUNAS',
        paymentMethod: 'CASH',
        dueDate: '',
      });
      setItems([{ productId: '', quantity: 1, unitPrice: 0, unit: 'PCS', availableUnits: [] }]);
      await load();
      await loadMeta();
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
      // Muat ulang produk juga, supaya stok di form PO berikutnya tidak basi.
      await load();
      await loadMeta();
    } else {
      notify.error(result.error || 'Gagal menerima PO');
    }
    setSaving(false);
  };

  const handleCancelPO = async (poId: string, poNumber: string) => {
    if (!confirm(`Apakah Anda yakin ingin membatalkan Purchase Order ${poNumber}?`)) return;
    setSaving(true);
    const result = await cancelPurchaseOrder(poId);
    if (result.success) {
      // `warning` = PO sudah dibatalkan & stok dikembalikan, tetapi pencatatan
      // mutasi modalnya gagal. Jangan tampilkan sukses biasa supaya pengguna
      // memeriksa halaman Modal.
      const warning = (result as { warning?: string }).warning;
      if (warning) {
        notify.admin.warning(warning);
      } else {
        notify.success(`PO ${poNumber} berhasil dibatalkan`);
      }
      setDetailModal(null);
      await load();
    } else {
      notify.error(result.error || 'Gagal membatalkan PO');
    }
    setSaving(false);
  };

  const handlePayDebt = async () => {
    if (!selectedPayable) return;
    setPaying(true);
    try {
      const res = await payPurchaseDebt(selectedPayable.id, payMethod, payNotes);
      if (res.success) {
        if (res.warning) {
          notify.admin.warning(res.warning);
        } else {
          notify.success(`Hutang PO ${selectedPayable.poNumber} berhasil dilunasi!`);
        }
        setSelectedPayable(null);
        setPayNotes('');
        await load();
        await loadMeta();
      } else {
        notify.error(res.error || 'Gagal melunasi hutang');
      }
    } catch (err: any) {
      notify.error(err?.message || 'Terjadi kesalahan sistem');
    } finally {
      setPaying(false);
    }
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

  const toggleSelectPO = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === filtered.length && filtered.length > 0) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filtered.map(p => p.id));
    }
  };

  const isAllSelected = filtered.length > 0 && selectedIds.length === filtered.length;
  const selectedPOs = useMemo(() => pos.filter(p => selectedIds.includes(p.id)), [pos, selectedIds]);
  const selectedTotalAmount = useMemo(() => selectedPOs.reduce((sum, p) => sum + p.totalAmount, 0), [selectedPOs]);
  const selectedHutangPOs = useMemo(() => selectedPOs.filter(p => p.paymentStatus === 'HUTANG' && p.status !== 'CANCELLED'), [selectedPOs]);
  const selectedHutangTotal = useMemo(() => selectedHutangPOs.reduce((sum, p) => sum + p.totalAmount, 0), [selectedHutangPOs]);

  const handleBulkPay = async () => {
    if (selectedHutangPOs.length === 0) {
      notify.error('Tidak ada PO berstatus HUTANG di antara pilihan Anda');
      return;
    }
    setBulkPaying(true);
    try {
      const res = await payBulkPurchaseDebt(
        selectedHutangPOs.map(p => p.id),
        bulkPayMethod,
        bulkPayNotes || undefined
      );
      if (res.success) {
        notify.success(`Berhasil melunasi ${res.updatedCount} PO!`);
        if (res.warnings && res.warnings.length > 0) {
          res.warnings.forEach(w => notify.admin.warning(w));
        }
        setBulkPayModalOpen(false);
        setBulkPayNotes('');
        setSelectedIds([]);
        await load();
        await loadMeta();
      } else {
        notify.error(res.errors?.[0] || 'Gagal melunasi PO');
      }
    } catch (err: any) {
      notify.error(err?.message || 'Terjadi kesalahan sistem');
    } finally {
      setBulkPaying(false);
    }
  };

  const handleBulkPrint = () => {
    if (selectedIds.length === 0) {
      notify.error('Pilih minimal satu PO untuk dicetak');
      return;
    }
    window.open(`/admin/purchases/print?ids=${selectedIds.join(',')}`, '_blank');
  };

  return (
    <>
      <Toaster />
      {/* Tanpa `min-h-screen`: layout admin sudah menyediakannya, dan menambahkannya
          lagi membuat halaman selalu lebih tinggi dari layar (ruang kosong ekstra). */}
      <div className="bg-gray-50 p-3 md:p-5">
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
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-3 mb-4 space-y-3">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Cari no PO, supplier, metode bayar (cash, transfer, tempo), nama produk..."
                className="w-full pl-9 pr-4 py-2 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  title="Hapus pencarian"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            <div className="flex flex-wrap sm:flex-nowrap gap-2">
              {/* Filter Metode Pembayaran */}
              <div className="flex-1 sm:flex-initial">
                <select
                  value={paymentMethodFilter}
                  onChange={e => setPaymentMethodFilter(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-bold border border-gray-200 rounded-xl bg-gray-50 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-gray-700"
                >
                  <option value="all">💳 Semua Metode</option>
                  <option value="CASH">CASH / TUNAI</option>
                  <option value="TRANSFER">TRANSFER BANK</option>
                  <option value="TEMPO">TEMPO / NET</option>
                  <option value="DP">DP + PELUNASAN</option>
                  <option value="GIRO">GIRO / CEK</option>
                  <option value="QRIS">QRIS / INSTAN</option>
                  <option value="KREDIT">KREDIT SUPPLIER</option>
                  <option value="KONSINYASI">KONSINYASI</option>
                </select>
              </div>

              {/* Filter Status Bayar */}
              <div className="flex-1 sm:flex-initial">
                <select
                  value={paymentStatusFilter}
                  onChange={e => setPaymentStatusFilter(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-bold border border-gray-200 rounded-xl bg-gray-50 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-gray-700"
                >
                  <option value="all">⚖️ Status Bayar</option>
                  <option value="LUNAS">LUNAS</option>
                  <option value="HUTANG">HUTANG / TEMPO</option>
                </select>
              </div>

              {/* Filter Status PO */}
              <div className="flex-1 sm:flex-initial">
                <select
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-bold border border-gray-200 rounded-xl bg-gray-50 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-gray-700"
                >
                  <option value="all">📦 Status PO</option>
                  {Object.entries(STATUS_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>

              {/* Tombol Reset Filter jika aktif */}
              {(search || paymentMethodFilter !== 'all' || paymentStatusFilter !== 'all' || statusFilter !== 'all') && (
                <button
                  onClick={() => {
                    setSearch('');
                    setPaymentMethodFilter('all');
                    setPaymentStatusFilter('all');
                    setStatusFilter('all');
                  }}
                  className="px-2.5 py-2 text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 rounded-xl transition-colors flex items-center gap-1"
                  title="Reset Filter"
                >
                  <RotateCcw size={13} /> Reset
                </button>
              )}
            </div>
          </div>
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
            <p className="text-gray-500 font-medium">Belum ada purchase order yang sesuai</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            {/* Mobile Card List (< md) */}
            <div className="divide-y divide-gray-100 md:hidden">
              {filtered.map(po => (
                <div key={po.id} className={`p-4 space-y-3 transition-colors ${selectedIds.includes(po.id) ? 'bg-emerald-50/50' : ''}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(po.id)}
                        onChange={() => toggleSelectPO(po.id)}
                        className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer accent-emerald-600"
                      />
                      <span className="font-mono text-xs font-bold text-gray-800">{po.poNumber}</span>
                    </div>
                    <span className={`px-2 py-0.5 rounded-lg text-xs font-black uppercase ${STATUS_COLOR[po.status]}`}>
                      {STATUS_LABEL[po.status] || po.status}
                    </span>
                  </div>
                  <div>
                    <p className="font-bold text-gray-900 text-sm">{po.supplier.name}</p>
                    <p className="text-xs text-gray-500">{po.items.length} item • {new Date(po.createdAt).toLocaleDateString('id-ID')}</p>
                  </div>

                  {/* Info Pembayaran di Mobile */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-gray-100 text-gray-700 uppercase">
                      {po.paymentMethod || 'CASH'}
                    </span>
                    <span className={`text-[11px] font-black px-2 py-0.5 rounded-md ${
                      po.paymentStatus === 'HUTANG' ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    }`}>
                      {po.paymentStatus || 'LUNAS'}
                    </span>
                    {po.dueDate && po.paymentStatus === 'HUTANG' && (
                      <span className="text-[10px] text-red-600 font-semibold">
                        Tempo: {new Date(po.dueDate).toLocaleDateString('id-ID')}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-1 border-t border-gray-50">
                    <div>
                      <p className="text-xs uppercase font-bold text-gray-500">Total Nilai</p>
                      <p className="font-black text-sm text-gray-900">Rp{po.totalAmount.toLocaleString('id-ID')} </p>
                    </div>
                    <div className="flex gap-1.5 flex-wrap justify-end">
                      <button onClick={() => setDetailModal(po)} className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-xl text-xs font-bold hover:bg-gray-200 transition-colors">
                        Detail
                      </button>
                      <Link
                        href={`/admin/purchases/print/${po.id}`}
                        className="px-3 py-1.5 bg-gray-900 text-white rounded-xl text-xs font-bold hover:bg-black transition-colors flex items-center gap-1 shadow-sm"
                      >
                        <Printer size={12} /> Cetak
                      </Link>
                      {po.paymentStatus === 'HUTANG' && po.status !== 'CANCELLED' && (
                        <button
                          onClick={() => { setSelectedPayable(po); setPayMethod('CASH'); setPayNotes(''); }}
                          className="px-3 py-1.5 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 transition-colors flex items-center gap-1 shadow-sm"
                        >
                          <CheckCircle2 size={12} /> Lunasi
                        </button>
                      )}
                      {po.status !== 'RECEIVED' && po.status !== 'CANCELLED' && (
                        <button onClick={() => { setReceiveModal(po); setReceiveForm({ warehouseId: '', batchNumber: '', expiryDate: '' }); }}
                          className="px-3 py-1.5 bg-green-100 text-green-700 rounded-xl text-xs font-bold hover:bg-green-200 transition-colors flex items-center gap-1 shadow-sm">
                          <Truck size={12} /> Terima
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop Table (>= md) */}
            <div className="overflow-x-auto hidden md:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="w-10 px-4 py-3 text-center">
                      <input
                        type="checkbox"
                        checked={isAllSelected}
                        onChange={toggleSelectAll}
                        className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer accent-emerald-600"
                        title={isAllSelected ? "Batalkan semua pilihan" : "Pilih semua PO di halaman ini"}
                      />
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">No. PO</th>
                    <th className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Supplier</th>
                    <th className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Status PO</th>
                    <th className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Pembayaran</th>
                    <th className="text-right px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Total</th>
                    <th className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Tanggal</th>
                    <th className="px-4 py-3 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filtered.map(po => (
                    <tr
                      key={po.id}
                      className={`hover:bg-gray-50 transition-colors group ${
                        selectedIds.includes(po.id) ? 'bg-emerald-50/40' : ''
                      }`}
                    >
                      <td className="w-10 px-4 py-3 text-center">
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(po.id)}
                          onChange={() => toggleSelectPO(po.id)}
                          className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer accent-emerald-600"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-mono text-xs font-bold text-gray-800">{po.poNumber}</span>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-800">{po.supplier.name}</p>
                        <p className="text-xs text-gray-500">{po.items.length} item</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${STATUS_COLOR[po.status]}`}>
                          {STATUS_LABEL[po.status] || po.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-0.5">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-xs text-gray-800 uppercase">
                              {po.paymentMethod || 'CASH'}
                            </span>
                            <span className={`px-1.5 py-0.2 rounded text-[10px] font-black uppercase ${
                              po.paymentStatus === 'HUTANG' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                            }`}>
                              {po.paymentStatus || 'LUNAS'}
                            </span>
                          </div>
                          {po.dueDate && po.paymentStatus === 'HUTANG' && (
                            <span className="text-[10px] text-red-500 font-medium">
                              Tempo: {new Date(po.dueDate).toLocaleDateString('id-ID')}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-gray-900">
                        Rp{po.totalAmount.toLocaleString('id-ID')}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">
                        {new Date(po.createdAt).toLocaleDateString('id-ID')}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1.5 justify-end transition-opacity">
                          <button onClick={() => setDetailModal(po)} className="px-2.5 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-xs font-bold hover:bg-gray-200 transition-colors" title="Lihat Detail">
                            Detail
                          </button>
                          <Link
                            href={`/admin/purchases/print/${po.id}`}
                            className="px-2.5 py-1.5 bg-gray-900 text-white rounded-lg text-xs font-bold hover:bg-black transition-colors flex items-center gap-1 shadow-sm"
                            title="Cetak Faktur PO / Struk Thermal"
                          >
                            <Printer size={13} /> Cetak
                          </Link>
                          {po.paymentStatus === 'HUTANG' && po.status !== 'CANCELLED' && (
                            <button
                              onClick={() => { setSelectedPayable(po); setPayMethod('CASH'); setPayNotes(''); }}
                              className="px-2.5 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 transition-colors flex items-center gap-1 shadow-sm"
                              title="Lunasi Tagihan Hutang PO Ini"
                            >
                              <CheckCircle2 size={13} /> Lunasi
                            </button>
                          )}
                          {po.status !== 'RECEIVED' && po.status !== 'CANCELLED' && (
                            <button onClick={() => { setReceiveModal(po); setReceiveForm({ warehouseId: '', batchNumber: '', expiryDate: '' }); }}
                              className="px-2.5 py-1.5 bg-green-100 text-green-700 rounded-lg text-xs font-bold hover:bg-green-200 transition-colors flex items-center gap-1 shadow-sm"
                              title="Terima Barang ke Gudang">
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
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl p-6 my-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-black text-gray-900">Buat Purchase Order</h2>
              <button onClick={() => setModalOpen(false)} className="p-2.5 -m-1 rounded-lg hover:bg-gray-100" aria-label="Tutup"><X size={18} /></button>
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
                    <div key={idx} className="grid grid-cols-12 gap-2 items-center bg-gray-50/80 sm:bg-transparent p-3 sm:p-0 rounded-2xl sm:rounded-none border border-gray-100 sm:border-0 relative">
                      <div className="col-span-12 sm:col-span-4">
                        <ProductSearchCombobox
                          value={item.productId}
                          products={products}
                          onChange={(productId, product) => handleProductSelect(idx, productId, product)}
                          placeholder="Pilih / Cari Produk..."
                        />
                      </div>
                      <div className="col-span-6 sm:col-span-2">
                        <select
                          value={item.unit || 'PCS'}
                          onChange={e => {
                            const newUnit = e.target.value;
                            const found = item.availableUnits?.find(u => u.code === newUnit);
                            updateItem(idx, 'unit', newUnit);
                            if (found && found.price) {
                              updateItem(idx, 'unitPrice', found.price);
                            }
                          }}
                          className="w-full px-2 py-2 text-xs border border-gray-200 rounded-lg bg-white sm:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-bold uppercase"
                        >
                          {item.availableUnits && item.availableUnits.length > 0 ? (
                            item.availableUnits.map(u => (
                              <option key={u.code} value={u.code}>{u.code}</option>
                            ))
                          ) : (
                            <>
                              {SATUAN_LIST.map(s => (
                                <option key={s.value} value={s.value}>{s.label}</option>
                              ))}
                            </>
                          )}
                        </select>
                      </div>
                      <div className="col-span-6 sm:col-span-2">
                        <input
                          type="number" min="1" value={item.quantity}
                          onChange={e => updateItem(idx, 'quantity', Number(e.target.value))}
                          placeholder="Qty"
                          className="w-full px-2 py-2 text-xs border border-gray-200 rounded-lg bg-white sm:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                      </div>
                      <div className="col-span-10 sm:col-span-3">
                        <input
                          type="number" min="0" value={item.unitPrice}
                          onChange={e => updateItem(idx, 'unitPrice', Number(e.target.value))}
                          placeholder="Harga/unit"
                          className="w-full px-2 py-2 text-xs border border-gray-200 rounded-lg bg-white sm:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                      </div>
                      <div className="col-span-2 sm:col-span-1 flex justify-center">
                        {items.length > 1 && (
                          <button onClick={() => removeItem(idx)} className="p-2 sm:p-1 text-red-400 hover:text-red-600 bg-red-50 sm:bg-transparent rounded-lg">
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

              {/* Metode & Status Pembayaran Lengkap */}
              <div className="p-3.5 bg-gray-50 border border-gray-200 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-gray-700">Status Pembayaran *</label>
                  <div className="flex bg-white rounded-lg p-0.5 border border-gray-200 shadow-sm">
                    <button
                      type="button"
                      onClick={() => setForm(p => ({ ...p, paymentStatus: 'LUNAS' }))}
                      className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${
                        form.paymentStatus === 'LUNAS'
                          ? 'bg-emerald-600 text-white shadow-sm'
                          : 'text-gray-500 hover:text-gray-900'
                      }`}
                    >
                      Lunas (Paid)
                    </button>
                    <button
                      type="button"
                      onClick={() => setForm(p => ({ ...p, paymentStatus: 'HUTANG' }))}
                      className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${
                        form.paymentStatus === 'HUTANG'
                          ? 'bg-red-600 text-white shadow-sm'
                          : 'text-gray-500 hover:text-gray-900'
                      }`}
                    >
                      Hutang / Tempo
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Metode Pembayaran *</label>
                    <select
                      value={form.paymentMethod}
                      onChange={e => {
                        const val = e.target.value;
                        setForm(p => ({
                          ...p,
                          paymentMethod: val,
                          paymentStatus: (val === 'TEMPO' || val === 'KREDIT') ? 'HUTANG' : p.paymentStatus
                        }));
                      }}
                      className="w-full px-3 py-2 text-xs font-bold border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 uppercase"
                    >
                      <option value="CASH">CASH / TUNAI</option>
                      <option value="TRANSFER">TRANSFER BANK</option>
                      <option value="TEMPO">TEMPO / NET TERMS</option>
                      <option value="DP">DP + PELUNASAN</option>
                      <option value="GIRO">GIRO / CEK</option>
                      <option value="QRIS">QRIS / INSTAN</option>
                      <option value="KREDIT">KREDIT SUPPLIER</option>
                      <option value="KONSINYASI">KONSINYASI</option>
                    </select>
                  </div>

                  {(form.paymentStatus === 'HUTANG' || form.paymentMethod === 'TEMPO' || form.paymentMethod === 'KREDIT') && (
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Tgl Jatuh Tempo</label>
                      <input
                        type="date"
                        value={form.dueDate}
                        onChange={e => setForm(p => ({ ...p, dueDate: e.target.value }))}
                        className="w-full px-3 py-2 text-xs font-bold border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Opsi Langsung Terima Barang & Tambah Stok */}
              <div className="pt-2 border-t border-gray-100">
                <label className="flex items-center gap-2.5 cursor-pointer font-bold text-xs text-emerald-800 bg-emerald-50 p-3 rounded-xl border border-emerald-200 hover:bg-emerald-100/60 transition-colors">
                  <input
                    type="checkbox"
                    checked={form.autoReceive}
                    onChange={e => setForm(p => ({ ...p, autoReceive: e.target.checked }))}
                    className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500"
                  />
                  <span>📦 Langsung Terima Barang & Tambah Stok ke Gudang</span>
                </label>

                {form.autoReceive && (
                  <div className="mt-3 p-3.5 bg-emerald-50/60 border border-emerald-200 rounded-xl space-y-3">
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">Gudang Tujuan *</label>
                      <select
                        value={form.warehouseId}
                        onChange={e => setForm(p => ({ ...p, warehouseId: e.target.value }))}
                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      >
                        <option value="">Pilih Gudang Cabang</option>
                        {warehouses.map((w: any) => <option key={w.id} value={w.id}>{w.name}</option>)}
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">No. Batch (opsional)</label>
                        <input
                          value={form.batchNumber}
                          onChange={e => setForm(p => ({ ...p, batchNumber: e.target.value }))}
                          placeholder="Contoh: BATCH-001"
                          className="w-full px-3 py-2 text-xs border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">Tgl Expired (opsional)</label>
                        <input
                          type="date"
                          value={form.expiryDate}
                          onChange={e => setForm(p => ({ ...p, expiryDate: e.target.value }))}
                          className="w-full px-3 py-2 text-xs border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                      </div>
                    </div>
                  </div>
                )}
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
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-black text-gray-900">Terima Barang</h2>
              <button onClick={() => setReceiveModal(null)} className="p-2.5 -m-1 rounded-lg hover:bg-gray-100" aria-label="Tutup"><X size={18} /></button>
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
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-lg font-black text-gray-900">Detail PO</h2>
                <p className="text-xs text-gray-500 mt-0.5 font-mono">{detailModal.poNumber}</p>
              </div>
              <button onClick={() => setDetailModal(null)} className="p-2.5 -m-1 rounded-lg hover:bg-gray-100" aria-label="Tutup"><X size={18} /></button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-xs text-gray-500 font-bold uppercase">Supplier</p>
                <p className="font-bold text-gray-800 text-xs truncate">{detailModal.supplier.name}</p>
              </div>
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-xs text-gray-500 font-bold uppercase">Status PO</p>
                <span className={`px-2 py-0.5 rounded-lg text-xs font-bold ${STATUS_COLOR[detailModal.status]}`}>
                  {STATUS_LABEL[detailModal.status] || detailModal.status}
                </span>
              </div>
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-xs text-gray-500 font-bold uppercase">Pembayaran</p>
                <span className={`px-2 py-0.5 rounded-lg text-xs font-bold ${
                  detailModal.paymentStatus === 'HUTANG' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                }`}>
                  {detailModal.paymentStatus || 'LUNAS'}
                </span>
              </div>
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-xs text-gray-500 font-bold uppercase">Metode</p>
                <p className="font-bold text-gray-800 text-xs uppercase">{detailModal.paymentMethod || 'CASH'}</p>
              </div>
            </div>
            <div className="overflow-x-auto -mx-2 px-2 mb-4">
              <table className="w-full text-sm min-w-[320px]">
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

            <div className="flex flex-wrap gap-2 mt-6">
              {detailModal.paymentStatus === 'HUTANG' && detailModal.status !== 'CANCELLED' && (
                <button
                  onClick={() => {
                    const p = detailModal;
                    setDetailModal(null);
                    setSelectedPayable(p);
                    setPayMethod('CASH');
                    setPayNotes('');
                  }}
                  className="w-full py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 flex items-center justify-center gap-2 shadow-sm transition-all"
                >
                  <CheckCircle2 size={16} /> Lunasi Hutang PO Ini
                </button>
              )}
              <Link
                href={`/admin/purchases/print/${detailModal.id}`}
                className="flex-1 py-2.5 rounded-xl bg-gray-900 text-white text-sm font-bold hover:bg-black flex items-center justify-center gap-2 shadow-sm transition-all"
              >
                <Printer size={16} /> Cetak PO
              </Link>
              {detailModal.status !== 'CANCELLED' && (
                <button
                  onClick={() => handleCancelPO(detailModal.id, detailModal.poNumber)}
                  disabled={saving}
                  className="flex-1 py-2.5 rounded-xl bg-red-50 text-red-600 border border-red-200 text-sm font-bold hover:bg-red-100 disabled:opacity-50 flex items-center justify-center gap-1.5 transition-colors"
                >
                  <XCircle size={16} /> Batalkan PO
                </button>
              )}
              <Link
                href={`/admin/purchases/add?duplicateFrom=${detailModal.id}`}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-bold text-gray-700 hover:bg-gray-50 flex items-center justify-center gap-2"
              >
                Pesan Ulang
              </Link>
              <Link
                href={`/admin/purchases/edit/${detailModal.id}`}
                className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 flex items-center justify-center gap-2"
              >
                Edit PO
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* ===== MODAL PELUNASAN SINGLE PO ===== */}
      {selectedPayable && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-md p-6 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-black text-gray-900 text-lg">Pelunasan Hutang PO</h3>
                <p className="text-xs text-gray-500 font-mono mt-0.5">{selectedPayable.poNumber}</p>
              </div>
              <button
                onClick={() => setSelectedPayable(null)}
                className="p-2 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition"
                aria-label="Tutup"
              >
                <X size={18} />
              </button>
            </div>

            <div className="bg-red-50 border border-red-100 rounded-2xl p-4 mb-4">
              <div className="flex justify-between items-start mb-1">
                <span className="text-xs font-bold text-red-600 uppercase tracking-wider">Total Tagihan Hutang</span>
                <span className="text-xs font-bold text-gray-700 truncate max-w-[160px] text-right">{selectedPayable.supplier.name}</span>
              </div>
              <p className="text-2xl font-black text-red-700">Rp{selectedPayable.totalAmount.toLocaleString('id-ID')}</p>
              {selectedPayable.dueDate && (
                <p className="text-xs text-red-600 font-medium mt-1">
                  Jatuh Tempo: {new Date(selectedPayable.dueDate).toLocaleDateString('id-ID')}
                </p>
              )}
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5 block">
                  Metode Pembayaran
                </label>
                <select
                  value={payMethod}
                  onChange={(e) => setPayMethod(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm font-bold text-gray-800 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  {['CASH', 'TRANSFER', 'QRIS', 'GIRO', 'KREDIT'].map((m) => (
                    <option key={m} value={m}>{PAYMENT_METHOD_LABEL[m] || m}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5 block">
                  Catatan Pelunasan (Opsional)
                </label>
                <textarea
                  value={payNotes}
                  onChange={(e) => setPayNotes(e.target.value)}
                  rows={2}
                  placeholder="Contoh: Transfer via BCA, No. ref 123456..."
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-800 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setSelectedPayable(null)}
                className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-bold text-gray-600 hover:bg-gray-50 transition"
              >
                Batal
              </button>
              <button
                onClick={handlePayDebt}
                disabled={paying}
                className="flex-1 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-700 transition shadow-lg shadow-emerald-200 disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {paying ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                {paying ? 'Memproses...' : 'Konfirmasi Pelunasan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== MODAL PELUNASAN MASAL ===== */}
      {bulkPayModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-lg p-6 animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-black text-gray-900 text-lg">Pelunasan Masal PO</h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  {selectedHutangPOs.length} dari {selectedIds.length} PO terpilih berstatus HUTANG
                </p>
              </div>
              <button
                onClick={() => setBulkPayModalOpen(false)}
                className="p-2 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition"
                aria-label="Tutup"
              >
                <X size={18} />
              </button>
            </div>

            <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 mb-4">
              <p className="text-xs font-bold text-emerald-700 uppercase tracking-wider mb-1">Total Pembayaran Masal</p>
              <p className="text-2xl font-black text-emerald-800">Rp{selectedHutangTotal.toLocaleString('id-ID')}</p>
              <p className="text-xs text-emerald-600 mt-1">
                Akan memperbarui {selectedHutangPOs.length} PO menjadi status LUNAS dan mencatat mutasi pengeluaran kas otomatis.
              </p>
            </div>

            {/* Rincian PO yang akan dilunasi */}
            <div className="mb-4 max-h-40 overflow-y-auto divide-y divide-gray-100 border border-gray-100 rounded-xl p-2 bg-gray-50/50">
              {selectedHutangPOs.map(p => (
                <div key={p.id} className="py-1.5 px-2 flex justify-between items-center text-xs">
                  <div>
                    <span className="font-mono font-bold text-gray-800">{p.poNumber}</span>
                    <span className="text-gray-500 ml-1.5">({p.supplier.name})</span>
                  </div>
                  <span className="font-bold text-gray-900">Rp{p.totalAmount.toLocaleString('id-ID')}</span>
                </div>
              ))}
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5 block">
                  Metode Pembayaran
                </label>
                <select
                  value={bulkPayMethod}
                  onChange={(e) => setBulkPayMethod(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm font-bold text-gray-800 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  {['CASH', 'TRANSFER', 'QRIS', 'GIRO', 'KREDIT'].map((m) => (
                    <option key={m} value={m}>{PAYMENT_METHOD_LABEL[m] || m}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5 block">
                  Catatan Pelunasan Masal (Opsional)
                </label>
                <textarea
                  value={bulkPayNotes}
                  onChange={(e) => setBulkPayNotes(e.target.value)}
                  rows={2}
                  placeholder="Contoh: Pelunasan tagihan gabungan akhir bulan..."
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-800 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setBulkPayModalOpen(false)}
                className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-bold text-gray-600 hover:bg-gray-50 transition"
              >
                Batal
              </button>
              <button
                onClick={handleBulkPay}
                disabled={bulkPaying || selectedHutangPOs.length === 0}
                className="flex-1 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-700 transition shadow-lg shadow-emerald-200 disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {bulkPaying ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                {bulkPaying ? 'Memproses...' : `Lunasi ${selectedHutangPOs.length} PO`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== FLOATING BULK ACTIONS TOOLBAR ===== */}
      {selectedIds.length > 0 && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-40 w-11/12 max-w-2xl bg-gray-900 text-white rounded-2xl shadow-2xl p-3 sm:p-4 flex flex-wrap items-center justify-between gap-3 border border-gray-700 animate-in fade-in slide-in-from-bottom-4 duration-200">
          <div className="flex items-center gap-2.5">
            <span className="bg-emerald-500 text-black text-xs font-black px-2.5 py-1 rounded-lg">
              {selectedIds.length} PO
            </span>
            <div>
              <p className="text-xs font-bold text-white leading-tight">PO Dipilih</p>
              <p className="text-[11px] text-gray-400">Total: Rp{selectedTotalAmount.toLocaleString('id-ID')}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {selectedHutangPOs.length > 0 && (
              <button
                onClick={() => {
                  setBulkPayMethod('CASH');
                  setBulkPayNotes('');
                  setBulkPayModalOpen(true);
                }}
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors shadow-sm"
              >
                <CheckCircle2 size={14} />
                <span>Ubah Status Lunas ({selectedHutangPOs.length})</span>
              </button>
            )}
            <button
              onClick={handleBulkPrint}
              className="bg-white text-gray-900 hover:bg-gray-100 px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors shadow-sm"
              title="Cetak seluruh PO terpilih"
            >
              <Printer size={14} />
              <span>Cetak Masal</span>
            </button>
            <button
              onClick={() => setSelectedIds([])}
              className="p-2 text-gray-400 hover:text-white rounded-xl hover:bg-gray-800 transition-colors"
              title="Batalkan Pilihan"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}
    </>
  );
}

