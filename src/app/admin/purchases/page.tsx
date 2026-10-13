'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { Toaster } from 'react-hot-toast';
import notify from '@/lib/notify';
import { SATUAN_LIST } from '@/lib/constants/satuan';
import {
  ShoppingBag, Plus, Package, Search, X, CheckCircle2, XCircle,
  ChevronRight, Download, Filter, Truck, ClipboardList, Printer, RotateCcw,
  CheckSquare, Square, DollarSign, AlertCircle, Loader2, Camera, Lock, Clock
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
import CameraBarcodeScannerModal from '@/components/scanner/CameraBarcodeScannerModal';
import { getLargestPurchaseUnit, getPurchaseUnitPrice } from '@/lib/normalize';
import { sbGetDocs } from '@/lib/supabase-helpers';
import * as XLSX from 'xlsx';

type PaymentRecord = {
  id: string;
  date: string;
  amount: number;
  paymentMethod: string;
  notes?: string;
  recordedBy?: string;
  recordedAt?: string;
};

type PO = {
  id: string;
  poNumber: string;
  status: string;
  totalAmount: number;
  paidAmount?: number;
  remainingAmount?: number;
  paymentStatus?: string;
  paymentMethod?: string;
  dueDate?: string | null;
  notes?: string | null;
  createdAt: Date;
  supplier: { name: string };
  paymentHistory?: PaymentRecord[];
  items: {
    id: string;
    productId?: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    conversion?: number;
    receivedQuantityBase?: number;
    product: { name: string; unit: string };
  }[];
  pendingReceipt?: { warehouseId?: string; items: { itemId: string; quantityBase: number }[] } | null;
};

const STATUS_COLOR: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-600',
  PENDING_APPROVAL: 'bg-yellow-100 text-yellow-700',
  APPROVED: 'bg-blue-100 text-blue-700',
  PARTIALLY_RECEIVED: 'bg-amber-100 text-amber-700',
  RECEIVED: 'bg-green-100 text-green-700',
  CANCELLED: 'bg-red-100 text-red-600',
};

const STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Draft',
  PENDING_APPROVAL: 'Menunggu Approval',
  APPROVED: 'Disetujui',
  PARTIALLY_RECEIVED: 'Diterima Sebagian',
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
  availableUnits?: { code: string; contains?: number; price?: number; modal?: number; costPrice?: number }[];
};

function isPoEditable(po: PO): boolean {
  const s = (po.status || '').toUpperCase();
  if (s === 'RECEIVED' || s === 'DITERIMA' || s === 'PARTIALLY_RECEIVED' || s === 'CANCELLED' || s === 'DIBATALKAN') return false;
  if (po.pendingReceipt) return false;
  if (po.items?.some(it => (it.receivedQuantityBase || 0) > 0)) return false;
  return true;
}

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
  const [payAmountInput, setPayAmountInput] = useState('');
  const [payMode, setPayMode] = useState<'PARTIAL' | 'FULL'>('PARTIAL');
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
  const [receiveForm, setReceiveForm] = useState({
    warehouseId: '', batchNumber: '', expiryDate: '', receivedQuantities: {} as Record<string, number>,
  });
  const [receiveScannerOpen, setReceiveScannerOpen] = useState(false);
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

      let availableUnits: { code: string; contains?: number; price?: number; modal?: number; costPrice?: number }[] = [];
      if (Array.isArray(product?.units) && product.units.length > 0) {
        // Use configured multi-unit array from product
        availableUnits = product.units.map((u: any) => ({
          code: u.code, contains: u.contains, price: u.price, modal: u.modal, costPrice: u.costPrice,
        }));
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

      const selectedUnit = getLargestPurchaseUnit(availableUnits, baseUnit);
      const basePrice = Number(product?.purchasePrice || product?.costPrice || product?.cost_price || product?.price || item.unitPrice || 0);

      return {
        ...item,
        productId,
        unitPrice: getPurchaseUnitPrice(basePrice, selectedUnit),
        unit: selectedUnit.code,
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
    const receivedItems = Object.entries(receiveForm.receivedQuantities)
      .filter(([, quantity]) => Number(quantity) > 0)
      .map(([itemId, quantity]) => {
        const item = receiveModal.items.find((candidate) => candidate.id === itemId);
        return { itemId, quantityBase: Number(quantity) * Number(item?.conversion || 1) };
      });
    if (!receiveModal.pendingReceipt && receivedItems.length === 0) {
      notify.error('Scan atau masukkan jumlah barang yang diterima');
      return;
    }
    setSaving(true);
    const result = await receivePurchaseOrder(
      receiveModal.id,
      receiveForm.warehouseId,
      receiveForm.batchNumber || undefined,
      receiveForm.expiryDate || undefined,
      receivedItems,
    );
    if (result.success) {
      notify.success(result.partial
        ? 'Penerimaan sebagian tersimpan. Sisa barang dapat diterima nanti.'
        : 'Barang berhasil diterima & stok diperbarui (FEFO)');
      setReceiveModal(null);
      setReceiveScannerOpen(false);
      setReceiveForm({ warehouseId: '', batchNumber: '', expiryDate: '', receivedQuantities: {} });
      // Muat ulang produk juga, supaya stok di form PO berikutnya tidak basi.
      await load();
      await loadMeta();
    } else {
      notify.error(result.error || 'Gagal menerima PO');
      if ('pendingReceipt' in result && result.pendingReceipt && receiveModal) {
        const pendingReceipt = result.pendingReceipt as NonNullable<PO['pendingReceipt']>;
        setReceiveScannerOpen(false);
        setReceiveModal((current) => current ? { ...current, pendingReceipt } : current);
        setReceiveForm((current) => ({
          ...current,
          warehouseId: pendingReceipt.warehouseId || current.warehouseId,
          receivedQuantities: Object.fromEntries(
            pendingReceipt.items.map((pendingItem) => {
              const item = receiveModal.items.find((candidate) => candidate.id === pendingItem.itemId);
              return [pendingItem.itemId, pendingItem.quantityBase / Number(item?.conversion || 1)];
            })
          ),
        }));
      }
    }
    setSaving(false);
  };

  const handleReceiveScan = async (code: string) => {
    if (!receiveModal || receiveModal.pendingReceipt) return;
    try {
      const result = await sbGetDocs({
        table: 'products',
        where: [{ field: 'barcode', op: '==', val: code }],
        limit: 1,
      });
      const productId = result.docs[0]?.id;
      if (!productId) {
        notify.error('Barcode produk tidak ditemukan');
        return;
      }

      const item = receiveModal.items.find((candidate) => {
        if (candidate.productId !== productId) return false;
        const orderedBase = Number(candidate.quantity || 0) * Number(candidate.conversion || 1);
        const alreadyReceived = Number(candidate.receivedQuantityBase || 0);
        const currentReceiptBase = Number(receiveForm.receivedQuantities[candidate.id] || 0) * Number(candidate.conversion || 1);
        return alreadyReceived + currentReceiptBase < orderedBase;
      });
      if (!item) {
        notify.error('Produk tidak ada di PO atau jumlah pesanannya sudah terpenuhi');
        return;
      }

      setReceiveForm((current) => ({
        ...current,
        receivedQuantitiesBase: {
          ...current.receivedQuantities,
          [item.id]: Number(current.receivedQuantities[item.id] || 0) + 1,
        },
      }));
      notify.success(`Barang diterima: ${item.product.name}`);
    } catch {
      notify.error('Gagal memeriksa barcode produk');
    }
  };

  const openReceiveModal = (po: PO) => {
    setReceiveModal(po);
    setReceiveScannerOpen(false);
    setReceiveForm({
      warehouseId: po.pendingReceipt?.warehouseId || '',
      batchNumber: '',
      expiryDate: '',
      receivedQuantities: Object.fromEntries(
        (po.pendingReceipt?.items || []).map((pendingItem) => {
          const orderItem = po.items.find((item) => item.id === pendingItem.itemId);
          return [pendingItem.itemId, pendingItem.quantityBase / Number(orderItem?.conversion || 1)];
        })
      ),
    });
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

  const openPayModal = (po: PO) => {
    setSelectedPayable(po);
    const total = po.totalAmount;
    const paid = po.paidAmount || (po.paymentStatus === 'LUNAS' ? total : 0);
    const sisa = po.remainingAmount ?? Math.max(0, total - paid);
    setPayMethod('CASH');
    setPayNotes('');
    setPayMode(sisa > 0 ? 'PARTIAL' : 'FULL');
    setPayAmountInput(sisa > 0 ? sisa.toString() : total.toString());
  };

  const handlePayDebt = async () => {
    if (!selectedPayable) return;
    const total = selectedPayable.totalAmount;
    const paid = selectedPayable.paidAmount || (selectedPayable.paymentStatus === 'LUNAS' ? total : 0);
    const sisa = selectedPayable.remainingAmount ?? Math.max(0, total - paid);
    const nominal = payMode === 'FULL' ? sisa : Number(payAmountInput);

    if (isNaN(nominal) || nominal <= 0) {
      notify.error('Masukkan nominal pembayaran yang valid');
      return;
    }
    if (nominal > sisa) {
      notify.error(`Nominal pembayaran melebihi sisa hutang (Maks: Rp ${sisa.toLocaleString('id-ID')})`);
      return;
    }

    setPaying(true);
    try {
      const res = await payPurchaseDebt(selectedPayable.id, payMethod, payNotes, nominal);
      if (res.success) {
        if (res.warning) {
          notify.admin.warning(res.warning);
        } else {
          notify.success(`Pembayaran PO ${selectedPayable.poNumber} sebesar Rp ${nominal.toLocaleString('id-ID')} berhasil dicatat!`);
        }
        setSelectedPayable(null);
        setPayNotes('');
        setPayAmountInput('');
        await load();
        await loadMeta();
      } else {
        notify.error(res.error || 'Gagal memproses pembayaran');
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
            <button onClick={() => setModalOpen(true)} className="flex items-center gap-2 bg-white border border-gray-200 text-gray-700 px-3 py-2.5 rounded-xl text-sm font-bold hover:bg-gray-50 transition-colors shadow-sm">
              <Plus size={16} /> PO Manual
            </button>
            <Link href="/admin/purchases/add" className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2.5 rounded-xl text-sm font-bold hover:bg-emerald-700 transition-colors shadow-sm">
              <Camera size={16} /> PO Scan
            </Link>
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
                  <option value="all">⚖️ Semua Status Bayar</option>
                  <option value="LUNAS">🟢 LUNAS</option>
                  <option value="SEBAGIAN">🟡 DIBAYAR SEBAGIAN</option>
                  <option value="HUTANG">🔴 BELUM BAYAR / HUTANG</option>
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
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-5">
          {['DRAFT', 'APPROVED', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CANCELLED'].map(st => (
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
                    <span className={`text-[11px] font-black px-2 py-0.5 rounded-md border ${
                      po.paymentStatus === 'HUTANG'
                        ? 'bg-red-50 text-red-700 border-red-200'
                        : (po.paymentStatus === 'SEBAGIAN' || po.paymentStatus === 'PARTIAL')
                          ? 'bg-amber-50 text-amber-800 border-amber-300'
                          : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    }`}>
                      {po.paymentStatus === 'SEBAGIAN' || po.paymentStatus === 'PARTIAL' ? 'SEBAGIAN' : (po.paymentStatus || 'LUNAS')}
                    </span>
                    {po.dueDate && po.paymentStatus !== 'LUNAS' && (
                      <span className="text-[10px] text-red-600 font-semibold">
                        Tempo: {new Date(po.dueDate).toLocaleDateString('id-ID')}
                      </span>
                    )}
                  </div>

                  {/* Progress pembayaran jika sebagian */}
                  {(po.paymentStatus === 'SEBAGIAN' || po.paymentStatus === 'PARTIAL' || ((po.paidAmount || 0) > 0 && (po.paidAmount || 0) < po.totalAmount)) && (
                    <div className="bg-amber-50/70 border border-amber-200/60 rounded-xl p-2.5 text-xs">
                      <div className="flex justify-between items-center mb-1 text-[11px]">
                        <span className="text-gray-600 font-bold">Terbayar: <strong className="text-emerald-700">Rp{(po.paidAmount || 0).toLocaleString('id-ID')}</strong></span>
                        <span className="text-amber-800 font-black">Sisa: Rp{(po.remainingAmount ?? (po.totalAmount - (po.paidAmount || 0))).toLocaleString('id-ID')}</span>
                      </div>
                      <div className="w-full bg-amber-200/50 rounded-full h-1.5 overflow-hidden">
                        <div
                          className="bg-emerald-500 h-full rounded-full transition-all"
                          style={{ width: `${Math.min(100, Math.round(((po.paidAmount || 0) / (po.totalAmount || 1)) * 100))}%` }}
                        />
                      </div>
                    </div>
                  )}

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
                      {po.paymentStatus !== 'LUNAS' && po.status !== 'CANCELLED' && (
                        <button
                          onClick={() => openPayModal(po)}
                          className="px-3 py-1.5 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 transition-colors flex items-center gap-1 shadow-sm"
                        >
                          <DollarSign size={12} /> {po.paymentStatus === 'SEBAGIAN' || po.paymentStatus === 'PARTIAL' ? 'Cicil / Lunasi' : 'Bayar / Cicil'}
                        </button>
                      )}
                      {po.status !== 'RECEIVED' && po.status !== 'CANCELLED' && (
                        <button onClick={() => openReceiveModal(po)}
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
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-xs text-gray-800 uppercase">
                              {po.paymentMethod || 'CASH'}
                            </span>
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-black uppercase border ${
                              po.paymentStatus === 'HUTANG'
                                ? 'bg-red-100 text-red-700 border-red-200'
                                : (po.paymentStatus === 'SEBAGIAN' || po.paymentStatus === 'PARTIAL')
                                  ? 'bg-amber-100 text-amber-800 border-amber-300'
                                  : 'bg-green-100 text-green-700 border-green-200'
                            }`}>
                              {po.paymentStatus === 'SEBAGIAN' || po.paymentStatus === 'PARTIAL' ? 'SEBAGIAN' : (po.paymentStatus || 'LUNAS')}
                            </span>
                          </div>
                          {(po.paymentStatus === 'SEBAGIAN' || po.paymentStatus === 'PARTIAL' || ((po.paidAmount || 0) > 0 && (po.paidAmount || 0) < po.totalAmount)) && (
                            <div className="w-36 text-[10px]">
                              <div className="flex justify-between text-gray-500 font-semibold mb-0.5">
                                <span>Bayar: Rp{(po.paidAmount || 0).toLocaleString('id-ID')}</span>
                                <span className="text-amber-800 font-bold">Sisa: Rp{(po.remainingAmount ?? (po.totalAmount - (po.paidAmount || 0))).toLocaleString('id-ID')}</span>
                              </div>
                              <div className="w-full bg-gray-200 rounded-full h-1 overflow-hidden">
                                <div
                                  className="bg-emerald-500 h-full rounded-full"
                                  style={{ width: `${Math.min(100, Math.round(((po.paidAmount || 0) / (po.totalAmount || 1)) * 100))}%` }}
                                />
                              </div>
                            </div>
                          )}
                          {po.dueDate && po.paymentStatus !== 'LUNAS' && (
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
                          {po.paymentStatus !== 'LUNAS' && po.status !== 'CANCELLED' && (
                            <button
                              onClick={() => openPayModal(po)}
                              className="px-2.5 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 transition-colors flex items-center gap-1 shadow-sm"
                              title="Bayar / Cicil Tagihan PO Ini"
                            >
                              <DollarSign size={13} /> {po.paymentStatus === 'SEBAGIAN' || po.paymentStatus === 'PARTIAL' ? 'Cicil / Lunasi' : 'Bayar / Lunasi'}
                            </button>
                          )}
                          {po.status !== 'RECEIVED' && po.status !== 'CANCELLED' && (
                            <button onClick={() => openReceiveModal(po)}
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
                            const currentConversion = Number(item.availableUnits?.find(u => u.code === item.unit)?.contains || 1);
                            updateItem(idx, 'unit', newUnit);
                            if (found) {
                              updateItem(idx, 'unitPrice', getPurchaseUnitPrice(item.unitPrice / currentConversion, found));
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
              <div className="rounded-xl border border-gray-200 p-3 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-gray-900">Jumlah diterima</p>
                    <p className="text-xs text-gray-500">Setiap scan dihitung sebagai 1 {receiveModal.items[0]?.product.unit || 'unit'} PO.</p>
                  </div>
                  {!receiveModal.pendingReceipt && (
                    <button
                      type="button"
                      onClick={() => setReceiveScannerOpen(true)}
                      className="shrink-0 inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white"
                    >
                      <Camera size={15} /> Scan
                    </button>
                  )}
                </div>
                {receiveModal.pendingReceipt && (
                  <p className="rounded-lg bg-amber-50 p-3 text-xs font-semibold text-amber-800">
                    Penerimaan sebelumnya belum selesai. Konfirmasi ini akan melanjutkannya dengan aman.
                  </p>
                )}
                <div className="max-h-56 space-y-2 overflow-y-auto">
                  {receiveModal.items.map((item) => {
                    const orderedBase = Number(item.quantity || 0) * Number(item.conversion || 1);
                    const priorBase = Number(item.receivedQuantityBase || 0);
                    const conversion = Number(item.conversion || 1);
                    const remainingUnits = Math.max(0, Number(item.quantity || 0) - priorBase / conversion);
                    const currentUnits = Number(receiveForm.receivedQuantities[item.id] || 0);
                    return (
                      <label key={item.id} className="flex items-center justify-between gap-3 rounded-lg bg-gray-50 p-3">
                        <span className="min-w-0">
                          <span className="block truncate text-xs font-bold text-gray-900">{item.product.name}</span>
                          <span className="block text-xs text-gray-500">
                            Pesan {item.quantity} {item.product.unit} · diterima {priorBase / conversion} {item.product.unit}
                          </span>
                        </span>
                        <input
                          type="number"
                          min="0"
                          max={remainingUnits}
                          step="1"
                          value={currentUnits}
                          disabled={Boolean(receiveModal.pendingReceipt)}
                          onChange={(event) => {
                            const value = Math.max(0, Math.min(remainingUnits, Math.floor(Number(event.target.value) || 0)));
                            setReceiveForm((current) => ({
                              ...current,
                              receivedQuantities: { ...current.receivedQuantities, [item.id]: value },
                            }));
                          }}
                          className="w-20 rounded-lg border border-gray-200 bg-white px-2 py-2 text-center text-sm font-bold disabled:bg-gray-100"
                          aria-label={`Jumlah diterima ${item.product.name}`}
                        />
                      </label>
                    );
                  })}
                </div>
                <CameraBarcodeScannerModal
                  isOpen={receiveScannerOpen}
                  onClose={() => setReceiveScannerOpen(false)}
                  continuous
                  title="Scan Barang Diterima"
                  description="Satu barcode dihitung sebagai satu satuan PO"
                  onScan={handleReceiveScan}
                />
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
                {saving ? 'Memproses...' : 'Simpan Penerimaan'}
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

            {/* Rincian Status Pembayaran & Riwayat */}
            <div className="bg-gray-50 border border-gray-100 rounded-xl p-3.5 mb-4 space-y-2">
              <div className="flex justify-between items-center text-xs font-bold">
                <span className="text-gray-500 uppercase">Ringkasan Pembayaran</span>
                <span className={`px-2 py-0.5 rounded text-[11px] font-black uppercase ${
                  detailModal.paymentStatus === 'HUTANG'
                    ? 'bg-red-100 text-red-700'
                    : (detailModal.paymentStatus === 'SEBAGIAN' || detailModal.paymentStatus === 'PARTIAL')
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-green-100 text-green-700'
                }`}>
                  {detailModal.paymentStatus || 'LUNAS'}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 pt-1 border-t border-gray-200/60 text-xs">
                <div>
                  <span className="text-[10px] text-gray-500 block">Total PO</span>
                  <strong className="text-gray-900">Rp{detailModal.totalAmount.toLocaleString('id-ID')}</strong>
                </div>
                <div>
                  <span className="text-[10px] text-emerald-600 block">Terbayar</span>
                  <strong className="text-emerald-700">Rp{(detailModal.paidAmount || (detailModal.paymentStatus === 'LUNAS' ? detailModal.totalAmount : 0)).toLocaleString('id-ID')}</strong>
                </div>
                <div>
                  <span className="text-[10px] text-red-600 block">Sisa Hutang</span>
                  <strong className="text-red-700">Rp{(detailModal.remainingAmount ?? Math.max(0, detailModal.totalAmount - (detailModal.paidAmount || 0))).toLocaleString('id-ID')}</strong>
                </div>
              </div>
              {detailModal.paymentHistory && detailModal.paymentHistory.length > 0 && (
                <div className="pt-2 border-t border-gray-200/60">
                  <span className="text-[10px] font-bold text-gray-500 uppercase block mb-1">Riwayat Pembayaran ({detailModal.paymentHistory.length}x):</span>
                  <div className="space-y-1 max-h-28 overflow-y-auto pr-1">
                    {detailModal.paymentHistory.map((h, i) => (
                      <div key={h.id || i} className="bg-white border border-gray-100 rounded-lg p-1.5 text-[11px] flex justify-between items-center">
                        <div>
                          <span className="font-bold text-gray-800">Rp{Number(h.amount || 0).toLocaleString('id-ID')}</span>
                          <span className="text-[10px] text-gray-500 ml-1.5">{h.paymentMethod} • {h.date ? new Date(h.date).toLocaleDateString('id-ID') : '-'}</span>
                        </div>
                        {h.notes && <span className="text-[10px] text-gray-500 italic truncate max-w-[140px]">{h.notes}</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex flex-wrap gap-2 mt-6">
              {detailModal.paymentStatus !== 'LUNAS' && detailModal.status !== 'CANCELLED' && (
                <button
                  onClick={() => {
                    const p = detailModal;
                    setDetailModal(null);
                    openPayModal(p);
                  }}
                  className="w-full py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 flex items-center justify-center gap-2 shadow-sm transition-all"
                >
                  <DollarSign size={16} /> Bayar / Cicil Tagihan PO Ini
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
              {isPoEditable(detailModal) ? (
                <Link
                  href={`/admin/purchases/edit/${detailModal.id}`}
                  className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 flex items-center justify-center gap-2"
                >
                  Edit PO
                </Link>
              ) : (
                <span
                  title={
                    detailModal.status === 'CANCELLED'
                      ? 'PO sudah dibatalkan'
                      : 'PO yang sudah diterima tidak dapat diedit langsung. Silakan batalkan PO atau pesan ulang.'
                  }
                  className="flex-1 py-2.5 rounded-xl bg-gray-100 text-gray-400 text-sm font-bold flex items-center justify-center gap-1.5 cursor-not-allowed select-none opacity-70"
                >
                  <Lock size={15} /> Edit PO
                </span>
              )}
            </div>

            {!isPoEditable(detailModal) && detailModal.status !== 'CANCELLED' && (
              <div className="mt-3 text-[11px] text-amber-700 bg-amber-50 border border-amber-200/60 p-2.5 rounded-xl flex items-start gap-2">
                <AlertCircle size={14} className="shrink-0 mt-0.5 text-amber-600" />
                <span>
                  PO ini berstatus <strong>{STATUS_LABEL[detailModal.status] || detailModal.status}</strong> dan barang sudah masuk ke gudang. Untuk merevisi, silakan klik <strong>Batalkan PO</strong> (stok otomatis ditarik kembali) lalu buat PO baru atau gunakan <strong>Pesan Ulang</strong>.
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===== MODAL PEMBAYARAN / CICILAN SINGLE PO ===== */}
      {selectedPayable && (() => {
        const total = selectedPayable.totalAmount;
        const paid = selectedPayable.paidAmount || (selectedPayable.paymentStatus === 'LUNAS' ? total : 0);
        const sisa = selectedPayable.remainingAmount ?? Math.max(0, total - paid);
        const nominalInput = payMode === 'FULL' ? sisa : Number(payAmountInput || 0);
        const sisaSetelahBayar = Math.max(0, sisa - (isNaN(nominalInput) ? 0 : nominalInput));
        const statusSetelah = sisaSetelahBayar === 0 ? 'LUNAS' : 'SEBAGIAN';

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm overflow-y-auto">
            <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-lg p-6 animate-in fade-in zoom-in-95 duration-150 my-8">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-black text-gray-900 text-lg flex items-center gap-2">
                    <DollarSign size={20} className="text-emerald-600" />
                    Pembayaran / Cicilan PO
                  </h3>
                  <p className="text-xs text-gray-500 font-mono mt-0.5">{selectedPayable.poNumber} • {selectedPayable.supplier.name}</p>
                </div>
                <button
                  onClick={() => setSelectedPayable(null)}
                  className="p-2 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition"
                  aria-label="Tutup"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Status & Ringkasan Hutang */}
              <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200/80 rounded-2xl p-4 mb-4">
                <div className="grid grid-cols-3 gap-2 text-center pb-3 border-b border-amber-200/60">
                  <div>
                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">Total PO</span>
                    <p className="text-sm font-black text-gray-900 mt-0.5">Rp{total.toLocaleString('id-ID')}</p>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider block">Sudah Dibayar</span>
                    <p className="text-sm font-black text-emerald-700 mt-0.5">Rp{paid.toLocaleString('id-ID')}</p>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-red-600 uppercase tracking-wider block">Sisa Hutang</span>
                    <p className="text-sm font-black text-red-700 mt-0.5">Rp{sisa.toLocaleString('id-ID')}</p>
                  </div>
                </div>

                <div className="mt-3">
                  <div className="flex justify-between items-center text-[11px] font-bold text-gray-600 mb-1">
                    <span>Progress Pelunasan</span>
                    <span className="text-amber-800">{Math.min(100, Math.round((paid / (total || 1)) * 100))}%</span>
                  </div>
                  <div className="w-full bg-amber-200/60 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-emerald-500 h-full rounded-full transition-all duration-300"
                      style={{ width: `${Math.min(100, Math.round((paid / (total || 1)) * 100))}%` }}
                    />
                  </div>
                </div>

                {selectedPayable.dueDate && (
                  <p className="text-xs text-amber-800 font-semibold mt-2.5 flex items-center gap-1">
                    <Clock size={12} className="text-amber-600" />
                    Jatuh Tempo: {new Date(selectedPayable.dueDate).toLocaleDateString('id-ID')}
                  </p>
                )}
              </div>

              {/* Pilihan Mode Pembayaran */}
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5 block">
                    Jenis Pembayaran
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setPayMode('PARTIAL');
                        if (!payAmountInput || Number(payAmountInput) === sisa) {
                          setPayAmountInput(Math.round(sisa * 0.5).toString());
                        }
                      }}
                      className={`py-2.5 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 border ${
                        payMode === 'PARTIAL'
                          ? 'bg-amber-500 text-white border-amber-600 shadow-md shadow-amber-200'
                          : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                      }`}
                    >
                      <DollarSign size={14} /> Bayar Sebagian (Cicil)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setPayMode('FULL');
                        setPayAmountInput(sisa.toString());
                      }}
                      className={`py-2.5 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 border ${
                        payMode === 'FULL'
                          ? 'bg-emerald-600 text-white border-emerald-700 shadow-md shadow-emerald-200'
                          : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                      }`}
                    >
                      <CheckCircle2 size={14} /> Lunasi Sisa (100%)
                    </button>
                  </div>
                </div>

                {/* Input Nominal jika Bayar Sebagian */}
                {payMode === 'PARTIAL' && (
                  <div>
                    <div className="flex justify-between items-center mb-1.5">
                      <label className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                        Nominal Yang Dibayarkan
                      </label>
                      <span className="text-[11px] font-bold text-gray-500">Maks: Rp{sisa.toLocaleString('id-ID')}</span>
                    </div>
                    <div className="relative">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-black text-gray-400 text-sm">Rp</span>
                      <input
                        type="number"
                        min={1}
                        max={sisa}
                        value={payAmountInput}
                        onChange={(e) => setPayAmountInput(e.target.value)}
                        placeholder="Contoh: 1000000"
                        className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm font-bold text-gray-900 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>

                    {/* Preset buttons */}
                    <div className="flex gap-1.5 mt-2">
                      {[0.25, 0.5, 0.75].map((pct) => {
                        const val = Math.round(sisa * pct);
                        return (
                          <button
                            key={pct}
                            type="button"
                            onClick={() => setPayAmountInput(val.toString())}
                            className="flex-1 py-1 px-2 text-[10px] font-bold rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 transition"
                          >
                            {pct * 100}%
                          </button>
                        );
                      })}
                      <button
                        type="button"
                        onClick={() => setPayAmountInput(sisa.toString())}
                        className="flex-1 py-1 px-2 text-[10px] font-bold rounded-lg border border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition"
                      >
                        100%
                      </button>
                    </div>

                    {/* Preview status baru */}
                    <div className="mt-2 text-xs bg-gray-50 rounded-xl p-2.5 border border-gray-200/80 flex justify-between items-center">
                      <span className="text-gray-600 font-medium">Sisa tagihan setelah pembayaran:</span>
                      <strong className={`font-black ${sisaSetelahBayar === 0 ? 'text-emerald-700' : 'text-amber-700'}`}>
                        Rp{sisaSetelahBayar.toLocaleString('id-ID')} ({statusSetelah})
                      </strong>
                    </div>
                  </div>
                )}

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
                    Catatan / Nomor Referensi Transfer
                  </label>
                  <textarea
                    value={payNotes}
                    onChange={(e) => setPayNotes(e.target.value)}
                    rows={2}
                    placeholder="Contoh: Transfer BCA Ref #88123 (Termin ke-2)..."
                    className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-800 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
                  />
                </div>

                {/* Riwayat Pembayaran Sebelumnya */}
                {selectedPayable.paymentHistory && selectedPayable.paymentHistory.length > 0 && (
                  <div className="pt-2 border-t border-gray-100">
                    <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5 block">
                      Riwayat Pembayaran Sebelumnya ({selectedPayable.paymentHistory.length}x)
                    </label>
                    <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1">
                      {selectedPayable.paymentHistory.map((hist, idx) => (
                        <div key={hist.id || idx} className="bg-gray-50 border border-gray-100 rounded-xl p-2 text-xs flex justify-between items-center">
                          <div>
                            <span className="font-bold text-gray-800 block">Rp{Number(hist.amount || 0).toLocaleString('id-ID')}</span>
                            <span className="text-[10px] text-gray-500">{hist.paymentMethod} • {hist.date ? new Date(hist.date).toLocaleDateString('id-ID') : '-'} {hist.notes ? `• ${hist.notes}` : ''}</span>
                          </div>
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">
                            Berhasil
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
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
                  disabled={paying || (payMode === 'PARTIAL' && (Number(payAmountInput || 0) <= 0 || Number(payAmountInput || 0) > sisa))}
                  className="flex-1 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-700 transition shadow-lg shadow-emerald-200 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {paying ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                  {paying ? 'Memproses...' : `Konfirmasi Bayar Rp${nominalInput > 0 ? nominalInput.toLocaleString('id-ID') : '0'}`}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

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

