'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { auth, db, storage } from '@/lib/firebase';
import { addInventoryLog } from '@/lib/inventory';
import { useParams, useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, updateDoc, collection, getDocs, serverTimestamp, Timestamp, addDoc, query, where, orderBy } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import {
  Tag, Truck, Save, Layers, Trash2,
  Barcode, Image as ImageIcon, AlertCircle, ChevronLeft, Calendar, History as HistoryIcon,
  Store, Globe, ShoppingBag, Video, TrendingUp, TrendingDown
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import imageCompression from 'browser-image-compression';
import { toast } from 'react-hot-toast';
import { deleteDoc } from 'firebase/firestore';

type ChannelPrices = {
  offline?: number;
  website?: number;
  shopee?: number;
  tiktok?: number;
};

type UnitOption = {
  code: string;
  contains?: number;
  price?: number;
  minQty?: number;
  label?: string;
  prices?: ChannelPrices;
};

interface Warehouse {
  id: string;
  name: string;
}

export default function EditProductPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  
  // State from Add Page structure
  const [units, setUnits] = useState<UnitOption[]>([]);
  const [newUnitCode, setNewUnitCode] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [formData, setFormData] = useState({
    ID: '',
    Barcode: '',
    Parent_ID: '',
    Nama: '',
    Kategori: '',
    Brand: '',
    Expired_Default: '',
    expired_date: '',
    tgl_masuk: '',
    Satuan: 'Pcs',
    Stok: 0,
    Min_Stok: 5,
    Modal: 0,
    Ecer: 0,
    Harga_Coret: 0,
    Grosir: 0,
    Min_Grosir: 1,
    Link_Foto: '',
    Deskripsi: '',
    Status: 1,
    Supplier: '',
    No_WA_Supplier: '',
    Lokasi: '',
    warehouseId: '',
    stockByWarehouse: {} as Record<string, number>
  });

  // Cost History State
  const [costHistory, setCostHistory] = useState<any[]>([]);

  const formDataRef = useRef(formData); // Ref to keep track of latest formData for logs if needed
  
  const fetchCostHistory = useCallback(async () => {
    try {
      const q = query(
        collection(db, 'product_cost_logs'), 
        where('productId', '==', id),
        orderBy('changeDate', 'desc')
      );
      const snap = await getDocs(q);
      const logs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setCostHistory(logs);
    } catch (e) {
      console.error("Gagal load history modal:", e);
    }
  }, [id]);

  const fetchProductData = useCallback(async () => {
    try {
      const docSnap = await getDoc(doc(db, 'products', id));
      if (!docSnap.exists()) {
        toast.error('Produk tidak ditemukan');
        return router.push('/admin/products');
      }
      const data = docSnap.data();
      const baseUnit = String(data.Satuan || 'PCS').toUpperCase();
      const basePrice = Number(data.Ecer || 0);
      const cp = data.channelPricing || {};

      setFormData(prev => ({
        ...prev,
        ID: data.ID || '',
        Barcode: data.Barcode || '',
        Parent_ID: data.Parent_ID || '',
        Nama: data.Nama || data.name || '',
        Kategori: data.Kategori || 'UMUM',
        Brand: data.Brand || '',
        Expired_Default: data.expired_date || '', // Map expired_date to Expired_Default for UI
        expired_date: data.expired_date || '',
        tgl_masuk: data.tgl_masuk || '',
        Satuan: baseUnit,
        Stok: Number(data.Stok ?? 0),
        Min_Stok: Number(data.Min_Stok || 5),
        Modal: Number(data.Modal || 0),
        Ecer: Number(data.Ecer || 0),
        Harga_Coret: Number(data.Harga_Coret || 0),
        Grosir: Number(data.Grosir || 0),
        Min_Grosir: Number(data.Min_Grosir || 1),
        Link_Foto: data.Link_Foto || data.URL_Produk || '',
        Deskripsi: data.Deskripsi || data.description || '',
        Status: data.Status ?? 1,
        Supplier: data.Supplier || '',
        No_WA_Supplier: data.No_WA_Supplier || '',
        Lokasi: data.Lokasi || '',
        warehouseId: data.warehouseId || '',
        stockByWarehouse: data.stockByWarehouse || {}
      }));

      // Handle Units
      const existingUnits = Array.isArray(data.units) ? (data.units as UnitOption[]) : [];
      
      // Ensure base unit exists
      let mergedUnits = [...existingUnits];
      if (!mergedUnits.find(u => u.code === baseUnit)) {
          mergedUnits.unshift({ code: baseUnit, contains: 1, price: basePrice });
      }

      // Add default units if missing (to match Add Product)
      const defaultOptions = ['BOX', 'CTN'];
      defaultOptions.forEach(defCode => {
        if (!mergedUnits.some(u => u.code === defCode)) {
          mergedUnits.push({ code: defCode, contains: 0, price: 0, label: '' });
        }
      });
      
      // Clean up units
      mergedUnits = mergedUnits.map(u => {
          const code = u.code.toUpperCase();
          const prices: ChannelPrices = {
            offline: cp.offline?.[code]?.price,
            website: cp.website?.[code]?.price,
            shopee: cp.shopee?.[code]?.price,
            tiktok: cp.tiktok?.[code]?.price,
          };

          return {
            ...u,
            code,
            contains: Number(u.contains || 0),
            price: Number(u.price || 0),
            minQty: Number(u.minQty || 0),
            prices
          };
      });

      setUnits(mergedUnits);

      const currentPhoto = data.URL_Produk || data.Link_Foto || data.image;
      setImagePreview(currentPhoto || null);
    } catch (e) {
      console.error(e);
      toast.error("Gagal sinkron data");
    }
  }, [id, router]);

  const fetchWarehouses = useCallback(async () => {
    const snapshot = await getDocs(collection(db, 'warehouses'));
    setWarehouses(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Warehouse)));
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) return router.push('/profil/login');
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (!userDoc.exists() || userDoc.data()?.role !== 'admin') return router.push('/profil');
      await Promise.all([fetchProductData(), fetchWarehouses(), fetchCostHistory()]);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [id, router, fetchProductData, fetchWarehouses]);

  const handleAddUnit = () => {
    if (!newUnitCode) return;
    const code = newUnitCode.toUpperCase();
    if (units.some(u => u.code === code)) {
      toast.error('Satuan sudah ada');
      return;
    }
    setUnits([...units, { code, contains: 0, price: 0, label: '' }]);
    setNewUnitCode('');
  };

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressedFile = await imageCompression(file, { maxSizeMB: 0.25, maxWidthOrHeight: 800, useWebWorker: true, initialQuality: 0.7 });
      setImageFile(compressedFile);
      setImagePreview(URL.createObjectURL(compressedFile));
    } catch { toast.error("Gagal proses gambar"); }
  };

  const calculateProfit = (sellingPrice: number, costPrice: number) => {
    const profit = sellingPrice - costPrice;
    const percentage = costPrice > 0 ? (profit / costPrice) * 100 : 0;
    return { profit, percentage };
  };

  const ProfitBadge = ({ profit, percentage }: { profit: number, percentage: number }) => {
    const isProfitable = profit >= 0;
    return (
      <div className={`flex items-center gap-1 text-[9px] font-bold px-2 py-1 rounded-lg ${isProfitable ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
        {isProfitable ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
        <span>
          {isProfitable ? '+' : ''}Rp{profit.toLocaleString('id-ID')} ({percentage.toFixed(1)}%)
        </span>
      </div>
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    const loadingToast = toast.loading("Menyimpan perubahan...");

    try {
      // 1. Ambil data stok lama untuk dibandingkan (Logika Audit)
      const oldDoc = await getDoc(doc(db, 'products', id));
      const oldData = oldDoc.data();
      const oldStocks = oldData?.stockByWarehouse || {};

      // 2. Proses Gambar
      let finalImageUrl = formData.Link_Foto || '';
      if (imageFile) {
        const imageRef = ref(storage, `products/${id}/main_${Date.now()}.jpg`);
        await uploadBytes(imageRef, imageFile);
        finalImageUrl = await getDownloadURL(imageRef);
      }

      // 3. Update Logic
      const baseUnit = String(formData.Satuan || 'PCS').trim().toUpperCase();
      const cleanedUnits = (units || [])
        .map((u) => {
          const code = String(u.code || '').trim().toUpperCase();
          if (!code) return null;
          const contains = Number(u.contains || 0);
          const price = Number(u.price || 0);
          const unitEntry: UnitOption = { code, contains, price };
          if (u.prices) {
             const cleanedPrices: any = {};
             if (u.prices.offline !== undefined && u.prices.offline !== null) cleanedPrices.offline = Number(u.prices.offline);
             if (u.prices.website !== undefined && u.prices.website !== null) cleanedPrices.website = Number(u.prices.website);
             if (u.prices.shopee !== undefined && u.prices.shopee !== null) cleanedPrices.shopee = Number(u.prices.shopee);
             if (u.prices.tiktok !== undefined && u.prices.tiktok !== null) cleanedPrices.tiktok = Number(u.prices.tiktok);
             if (Object.keys(cleanedPrices).length > 0) {
                 unitEntry.prices = cleanedPrices;
             }
          }
          if (u.minQty !== undefined) unitEntry.minQty = Number(u.minQty);
          if (u.label) unitEntry.label = String(u.label);
          return unitEntry;
        })
        .filter(Boolean) as UnitOption[];

      const basePriceFromUnits = cleanedUnits.find((u) => u.code === baseUnit)?.price;
      const nextEcer = (typeof basePriceFromUnits === 'number' && !Number.isNaN(basePriceFromUnits))
        ? basePriceFromUnits
        : Number(formData.Ecer || 0);

      const baseUnitEntry: UnitOption = { 
        code: baseUnit, 
        contains: 1, 
        price: nextEcer, 
        label: '' 
      };
      
      const foundBaseUnit = cleanedUnits.find(u => u.code === baseUnit);
      if (foundBaseUnit?.prices) {
        baseUnitEntry.prices = foundBaseUnit.prices;
      }

      const ensuredBase = [
        baseUnitEntry,
        ...cleanedUnits.filter((u) => u.code !== baseUnit),
      ];

      // Construct Channel Pricing
      const channelPricing: any = { offline: {}, website: {}, shopee: {}, tiktok: {} };
      ensuredBase.forEach(u => {
        if (u.prices) {
          if (u.prices.offline !== undefined) channelPricing.offline[u.code] = { price: Number(u.prices.offline) };
          if (u.prices.website !== undefined) channelPricing.website[u.code] = { price: Number(u.prices.website) };
          if (u.prices.shopee !== undefined) channelPricing.shopee[u.code] = { price: Number(u.prices.shopee) };
          if (u.prices.tiktok !== undefined) channelPricing.tiktok[u.code] = { price: Number(u.prices.tiktok) };
        }
      });

      // Prepare Stock Data
      const totalStock = Number(formData.Stok || 0);
      // Jika warehouseId dipilih, update stock spesifik gudang itu
      // Jika tidak, biarkan stockByWarehouse apa adanya (atau update jika logic lain)
      // Disini kita ikuti logic Add Page: jika ada warehouseId, set stockByWarehouse[id] = totalStock
      // TAPI ini Edit Page, kita harus hati-hati menimpa stockByWarehouse.
      // Kita update stockByWarehouse hanya jika warehouseId dipilih.
      
      const newStocks = { ...formData.stockByWarehouse };
      if (formData.warehouseId) {
          newStocks[formData.warehouseId] = totalStock;
      }
      
      // Recalculate total stock from all warehouses if using warehouse system
      // Or just trust the input if simple system.
      // Let's trust the input 'Stok' as the primary source of truth for the edited context,
      // but update the breakdown if warehouse is selected.
      
      // LOG STOCK CHANGES
      const logEntries: any[] = [];
      
      // Check specific warehouse change if selected
      if (formData.warehouseId) {
          const whId = formData.warehouseId;
          const oldVal = Number(oldStocks[whId] || 0);
          const newVal = totalStock; // Asumsi input Stok adalah stok untuk gudang yang dipilih
          
          if (oldVal !== newVal) {
             const whName = warehouses.find(w => w.id === whId)?.name || whId;
             logEntries.push({
                productId: id,
                productName: formData.Nama.toUpperCase(),
                warehouseId: whId,
                warehouseName: whName,
                previousStock: oldVal,
                newStock: newVal,
                change: newVal - oldVal,
                type: 'EDIT_ADMIN',
                adminEmail: auth.currentUser?.email || 'system',
                createdAt: serverTimestamp(),
             });
          }
      } else {
          // If no warehouse selected, we assume 'Stok' is global stock update? 
          // Or we iterate all warehouses if user edited them individually?
          // Current UI only allows selecting one warehouse to set stock.
          // Let's check if global stock changed significantly without warehouse context
          // For now, let's stick to the Add Page logic which assigns stock to a warehouse.
      }

      const updatePayload = {
        ...formData,
        ID: formData.ID,
        Nama: String(formData.Nama || '').toUpperCase(),
        Satuan: baseUnit,
        sku: formData.ID,
        name: String(formData.Nama || '').toUpperCase(),
        category: formData.Kategori,
        unit: baseUnit,
        description: formData.Deskripsi || '',
        stock: totalStock,
        Stok: totalStock,
        stockByWarehouse: newStocks,
        minStock: Number(formData.Min_Stok || 0),
        Min_Stok: Number(formData.Min_Stok || 0),
        purchasePrice: Number(formData.Modal || 0),
        Modal: Number(formData.Modal || 0),
        priceEcer: nextEcer,
        Ecer: nextEcer,
        price: nextEcer,
        priceGrosir: Number(formData.Grosir || 0),
        wholesalePrice: Number(formData.Grosir || 0),
        Min_Grosir: Number(formData.Min_Grosir || 0),
        minWholesale: Number(formData.Min_Grosir || 0),
        barcode: formData.Barcode || '',
        Barcode: formData.Barcode || '',
        imageUrl: finalImageUrl,
        image: finalImageUrl,
        URL_Produk: finalImageUrl,
        isActive: Number(formData.Status) === 1,
        Status: Number(formData.Status) === 1 ? 1 : 0,
        warehouseId: formData.warehouseId || oldData?.warehouseId || '',
        tgl_masuk: formData.tgl_masuk || '',
        expired_date: formData.expired_date || formData.Expired_Default || '',
        expiredDate: formData.expired_date || formData.Expired_Default || '',
        Lokasi: formData.Lokasi || '',
        units: ensuredBase,
        channelPricing,
        updatedAt: serverTimestamp(),
      };

      await updateDoc(doc(db, 'products', id), updatePayload);

      // Write Logs
      if (logEntries.length > 0) {
        const logPromises = logEntries.map(log => addDoc(collection(db, 'stock_logs'), log));
        await Promise.all(logPromises);
        
        const invLogPromises = logEntries.map(log => addInventoryLog({
          productId: log.productId,
          productName: log.productName,
          type: log.change > 0 ? 'MASUK' : 'KELUAR',
          amount: Math.abs(log.change),
          adminId: log.adminEmail || 'system',
          source: 'MANUAL',
          note: `Edit Product. Prev: ${log.previousStock}, New: ${log.newStock}`,
          prevStock: log.previousStock,
          nextStock: log.newStock,
          fromWarehouseId: log.change < 0 ? log.warehouseId : undefined,
          toWarehouseId: log.change > 0 ? log.warehouseId : undefined,
        }));
        await Promise.all(invLogPromises);
      }

      toast.dismiss(loadingToast);
      toast.success('Produk berhasil diperbarui!');
      router.push('/admin/products');
    } catch (err: any) {
      console.error(err);
      toast.dismiss(loadingToast);
      toast.error(err.message || 'Terjadi kesalahan');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Apakah Anda yakin ingin menghapus produk ini? Data yang dihapus tidak dapat dikembalikan.')) return;
    setIsDeleting(true);
    const toastId = toast.loading('Menghapus produk...');
    try {
      await deleteDoc(doc(db, 'products', id));
      
      // Catat Log Hapus
      await addDoc(collection(db, 'stock_logs'), {
          productId: id,
          productName: formData.Nama.toUpperCase(),
          warehouseId: 'SYSTEM',
          warehouseName: 'SYSTEM',
          previousStock: formData.Stok,
          newStock: 0,
          change: -formData.Stok,
          type: 'DELETE_PRODUCT',
          adminEmail: auth.currentUser?.email,
          createdAt: serverTimestamp(),
      });

      toast.success('Produk berhasil dihapus');
      router.push('/admin/products');
    } catch (error) {
      console.error(error);
      toast.error('Gagal menghapus produk');
      setIsDeleting(false);
    } finally {
      toast.dismiss(toastId);
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div></div>;

  return (
    <div className="p-4 md:p-8 bg-gray-50 min-h-screen pb-24 text-black font-sans">
      <div className="max-w-4xl mx-auto">

        {/* Header Navigation */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Link href="/admin/products" className="p-3 bg-white rounded-2xl shadow-sm hover:bg-black hover:text-white transition-all">
              <ChevronLeft size={20} />
            </Link>
            <div>
              <h1 className="text-xl font-black uppercase tracking-tighter">Edit Produk</h1>
              <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">Update Data Inventaris</p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">

          <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-100">
            <h3 className="text-xs font-black uppercase mb-6 flex items-center gap-2 border-b pb-4 text-blue-600">
              <Tag size={16} />
              Identitas Barang
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-black uppercase text-gray-400 ml-1">ID Produk *</label>
                <input
                  required
                  className="w-full p-4 bg-gray-50 rounded-2xl font-black outline-none"
                  type="text"
                  value={formData.ID}
                  onChange={(e) => setFormData({ ...formData, ID: e.target.value })}
                  placeholder="Contoh: BRG-001"
                />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase text-gray-400 ml-1">Parent ID</label>
                <input
                  className="w-full p-4 bg-gray-50 rounded-2xl font-black outline-none"
                  type="text"
                  value={formData.Parent_ID}
                  onChange={(e) => setFormData({ ...formData, Parent_ID: e.target.value })}
                  placeholder="Opsional"
                />
              </div>
              <div className="md:col-span-2">
                <label className="text-[10px] font-black uppercase text-gray-400 ml-1">Nama Produk</label>
                <input required className="w-full p-4 bg-gray-100 rounded-2xl font-black outline-none" type="text" value={formData.Nama} onChange={e => setFormData({ ...formData, Nama: e.target.value })} />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase text-gray-400 ml-1">Lokasi Rak</label>
                <input className="w-full p-4 bg-gray-50 rounded-2xl font-black outline-none" type="text" value={formData.Lokasi} onChange={e => setFormData({ ...formData, Lokasi: e.target.value })} />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase text-gray-400 ml-1">Kategori</label>
                <input className="w-full p-4 bg-gray-50 rounded-2xl font-black outline-none" type="text" value={formData.Kategori} onChange={e => setFormData({ ...formData, Kategori: e.target.value })} />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase text-gray-400 ml-1">Brand / Merk</label>
                <input className="w-full p-4 bg-gray-50 rounded-2xl font-black outline-none" type="text" value={formData.Brand} onChange={e => setFormData({ ...formData, Brand: e.target.value })} />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase text-gray-400 ml-1">Barcode / SKU</label>
                <div className="relative">
                  <Barcode size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" />
                  <input className="w-full pl-12 pr-4 py-4 bg-gray-50 rounded-2xl font-black outline-none" type="text" value={formData.Barcode} onChange={e => setFormData({ ...formData, Barcode: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="text-[10px] font-black uppercase text-gray-400 ml-1">Tanggal Kadaluarsa</label>
                <div className="relative">
                  <Calendar size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" />
                  <input className="w-full pl-12 pr-4 py-4 bg-gray-50 rounded-2xl font-black outline-none" type="date" value={formData.Expired_Default} onChange={e => setFormData({ ...formData, Expired_Default: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="text-[10px] font-black uppercase text-gray-400 ml-1">Tanggal Masuk</label>
                <div className="relative">
                  <Calendar size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" />
                  <input className="w-full pl-12 pr-4 py-4 bg-gray-50 rounded-2xl font-black outline-none" type="date" value={formData.tgl_masuk} onChange={e => setFormData({ ...formData, tgl_masuk: e.target.value })} />
                </div>
              </div>
            </div>
          </div>

          {/* BAGIAN 2: STOK & KATEGORI */}
          <div className="bg-white p-6 md:p-8 rounded-[2.5rem] shadow-sm border border-gray-100">
            <div className="flex items-center gap-2 mb-6 text-emerald-600">
              <Layers size={18} />
              <h3 className="text-xs font-black uppercase tracking-widest">Kategori & Stok</h3>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-gray-400 ml-2">Satuan</label>
                <input required type="text" placeholder="Pcs/Dus" className="w-full p-4 bg-gray-50 rounded-2xl border-none font-bold" value={formData.Satuan} onChange={e => setFormData({ ...formData, Satuan: e.target.value })} />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-gray-400 ml-2 text-emerald-600">Stok Saat Ini</label>
                <input required type="number" className="w-full p-4 bg-emerald-50 rounded-2xl border-none font-black text-emerald-700" value={formData.Stok} onChange={e => setFormData({ ...formData, Stok: Number(e.target.value) })} />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-gray-400 ml-2 text-red-500">Min. Stok</label>
                <input required type="number" className="w-full p-4 bg-red-50 rounded-2xl border-none font-black text-red-600" value={formData.Min_Stok} onChange={e => setFormData({ ...formData, Min_Stok: Number(e.target.value) })} />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-gray-400 ml-2">Gudang</label>
                <select className="w-full p-4 bg-gray-50 rounded-2xl border-none font-bold" value={formData.warehouseId} onChange={e => setFormData({ ...formData, warehouseId: e.target.value })}>
                  <option value="">Pilih Gudang (Opsional)</option>
                  {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
                <p className="text-[9px] text-gray-400 px-2">Pilih gudang untuk update stok spesifik</p>
              </div>
            </div>

            {/* DETAIL STOK PER GUDANG */}
            <div className="mt-6 pt-6 border-t border-gray-100">
              <h4 className="text-[10px] font-black uppercase text-gray-400 mb-3 ml-1">Rincian Stok Per Gudang</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {warehouses.map(w => {
                  const qty = formData.stockByWarehouse?.[w.id] || 0;
                  return (
                    <div key={w.id} className="p-3 bg-gray-50 rounded-xl border border-gray-100 flex justify-between items-center">
                      <span className="text-[10px] font-bold text-gray-500 uppercase">{w.name}</span>
                      <span className={`text-xs font-black ${qty > 0 ? 'text-emerald-600' : 'text-gray-400'}`}>{qty}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* BAGIAN 3: HARGA & GROSIR */}
          <div className="bg-white p-6 md:p-8 rounded-[2.5rem] shadow-sm border border-gray-100">
            <div className="flex items-center gap-2 mb-6 text-orange-600">
              <Tag size={18} />
              <h3 className="text-xs font-black uppercase tracking-widest">Struktur Harga</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-5">
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-gray-400 ml-2">Harga Modal</label>
                <input required type="number" className="w-full p-4 bg-gray-100 rounded-2xl border-none font-black" value={formData.Modal} onChange={e => setFormData({ ...formData, Modal: Number(e.target.value) })} />
              </div>
              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] font-black uppercase text-gray-400 ml-2">Harga Ecer (Jual)</label>
                  {formData.Ecer > 0 && formData.Modal > 0 && (
                    <ProfitBadge {...calculateProfit(formData.Ecer, formData.Modal)} />
                  )}
                </div>
                <input required type="number" className="w-full p-4 bg-blue-50 rounded-2xl border-none font-black text-blue-700 focus:ring-2 focus:ring-blue-600" value={formData.Ecer} onChange={e => setFormData({ ...formData, Ecer: Number(e.target.value) })} />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-gray-400 ml-2">Harga Coret</label>
                <input type="number" className="w-full p-4 bg-gray-50 rounded-2xl border-none font-black text-gray-300 line-through" value={formData.Harga_Coret} onChange={e => setFormData({ ...formData, Harga_Coret: Number(e.target.value) })} />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 p-6 bg-orange-50 rounded-3xl border border-orange-100">
              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] font-black uppercase text-orange-600 ml-2">Harga Grosir</label>
                  {formData.Grosir > 0 && formData.Modal > 0 && (
                    <ProfitBadge {...calculateProfit(formData.Grosir, formData.Modal)} />
                  )}
                </div>
                <input type="number" className="w-full p-4 bg-white rounded-2xl border-none font-black text-orange-700 shadow-sm" value={formData.Grosir} onChange={e => setFormData({ ...formData, Grosir: Number(e.target.value) })} />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-orange-600 ml-2">Min. Beli Grosir</label>
                <input type="number" className="w-full p-4 bg-white rounded-2xl border-none font-black text-orange-700 shadow-sm" value={formData.Min_Grosir} onChange={e => setFormData({ ...formData, Min_Grosir: Number(e.target.value) })} />
              </div>
            </div>
            <div className="mt-4 flex items-center gap-3">
              <span className="text-[10px] font-black uppercase text-gray-400">Status</span>
              <select className="p-3 bg-gray-50 rounded-xl text-xs font-bold" value={formData.Status} onChange={e => setFormData({ ...formData, Status: Number(e.target.value) })}>
                <option value={1}>Aktif</option>
                <option value={0}>Arsip</option>
              </select>
            </div>
          </div>

          {/* Riwayat Perubahan Modal */}
          {costHistory.length > 0 && (
            <div className="mt-8 pt-6 border-t border-gray-100">
              <h4 className="text-[10px] font-black uppercase text-gray-400 mb-4 flex items-center gap-2">
                <HistoryIcon size={14} /> Riwayat Perubahan Modal (Average Cost)
              </h4>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="text-[10px] text-gray-400 uppercase border-b">
                      <th className="py-2">Tanggal</th>
                      <th className="py-2">Admin</th>
                      <th className="py-2 text-right">Lama</th>
                      <th className="py-2 text-right">Baru</th>
                    </tr>
                  </thead>
                  <tbody className="text-xs font-bold text-gray-700">
                    {costHistory.map((log: any) => (
                      <tr key={log.id} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="py-3">
                          {log.changeDate?.seconds ? new Date(log.changeDate.seconds * 1000).toLocaleDateString('id-ID') : '-'}
                        </td>
                        <td className="py-3">{log.adminEmail || 'System'}</td>
                        <td className="py-3 text-right text-gray-400">Rp{Number(log.oldCost || 0).toLocaleString('id-ID')}</td>
                        <td className="py-3 text-right text-gray-800">Rp{Number(log.newCost || 0).toLocaleString('id-ID')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="bg-white p-6 md:p-8 rounded-[2.5rem] shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2 text-gray-800">
                <Tag size={18} />
                <h3 className="text-xs font-black uppercase tracking-widest">Satuan Jual</h3>
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Kode Satuan (Ex: LUSIN)"
                  className="bg-gray-50 px-3 py-2 rounded-xl text-xs font-bold uppercase outline-none border focus:border-blue-500 w-40"
                  value={newUnitCode}
                  onChange={(e) => setNewUnitCode(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddUnit())}
                />
                <button
                  type="button"
                  onClick={handleAddUnit}
                  className="bg-black text-white px-3 py-2 rounded-xl text-xs font-black uppercase hover:bg-gray-800 transition-all"
                >
                  + Tambah
                </button>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {units.map((u, index) => {
                const code = u.code || '';
                const idx = index;
                const current = u;
                const basePrice = Number(formData.Ecer || 0);
                const contains = Number(current.contains || (code === 'PCS' ? 1 : 0));
                const unitPrice = Number(current.price || 0);
                const perPcs = contains > 0 ? Math.round(unitPrice / contains) : 0;

                return (
                  <div key={code} className="p-4 rounded-2xl border bg-gray-50 relative group">
                    {code !== 'PCS' && (
                      <button
                        type="button"
                        onClick={() => {
                          const next = [...units];
                          next.splice(idx, 1);
                          setUnits(next);
                        }}
                        className="absolute top-2 right-2 p-1 bg-red-100 text-red-600 rounded-lg opacity-0 group-hover:opacity-100 transition-all hover:bg-red-200"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                      </button>
                    )}
                      <div className="flex items-center justify-between gap-3 mb-2">
                      <div className="flex-1">
                        <label className="text-[9px] font-black text-gray-400 uppercase mb-1 block">Kode Satuan</label>
                        <input 
                           type="text" 
                           className="w-full bg-white p-2 rounded-xl text-xs font-black text-gray-800 outline-none border focus:ring-2 focus:ring-blue-500 uppercase"
                           value={code}
                           disabled={code === 'PCS'}
                           onChange={(e) => {
                             const val = e.target.value.toUpperCase();
                             const next = [...units];
                             next[idx] = { ...current, code: val };
                             setUnits(next);
                           }}
                        />
                      </div>
                      <div className="flex-1">
                        <label className="text-[9px] font-black text-gray-400 uppercase mb-1 block">Label</label>
                        <input
                          type="text"
                          className="w-full bg-white p-2 rounded-xl text-[10px] font-black text-gray-700 outline-none border"
                          placeholder="Nama satuan"
                          value={current.label || ''}
                          onChange={(e) => {
                            const next = [...units];
                            next[idx] = { ...current, label: e.target.value };
                            setUnits(next);
                          }}
                        />
                      </div>
                    </div>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] font-black text-gray-500 uppercase">Harga Dasar</span>
                        {Number(current.price) > 0 && formData.Modal > 0 && (
                           <span className={`text-[9px] font-bold ${calculateProfit(Number(current.price), formData.Modal * (current.contains || 1)).profit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                             {calculateProfit(Number(current.price), formData.Modal * (current.contains || 1)).profit >= 0 ? '+' : ''}
                             {((calculateProfit(Number(current.price), formData.Modal * (current.contains || 1)).profit / (formData.Modal * (current.contains || 1))) * 100).toFixed(0)}%
                           </span>
                        )}
                        <input
                          type="number"
                          className="w-32 bg-white p-3 rounded-xl text-sm font-black text-right outline-none border"
                          value={current.price || ''}
                          onChange={(e) => {
                            const val = e.target.value === '' ? undefined : Number(e.target.value);
                            const next = [...units];
                            next[idx] = { ...current, price: val };
                            setUnits(next);
                          }}
                        />
                      </div>
                      
                      {/* CHANNEL PRICING */}
                      <div className="p-3 bg-blue-50/50 rounded-xl border border-blue-100 space-y-2">
                        <p className="text-[9px] font-black text-blue-600 uppercase mb-2">Harga Khusus Channel</p>
                        <div className="grid grid-cols-2 gap-2">
                           <div>
                              <div className="flex justify-between">
                                <label className="text-[9px] text-gray-400 uppercase flex items-center gap-1"><Store size={10}/> Offline</label>
                                {current.prices?.offline && formData.Modal > 0 && (
                                  <span className={`text-[8px] font-bold ${calculateProfit(current.prices.offline, formData.Modal * (current.contains || 1)).profit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                    {((calculateProfit(current.prices.offline, formData.Modal * (current.contains || 1)).profit / (formData.Modal * (current.contains || 1))) * 100).toFixed(0)}%
                                  </span>
                                )}
                              </div>
                              <input type="number" placeholder="Default" className="w-full bg-white p-1.5 rounded-lg text-xs font-bold border outline-none" 
                                value={current.prices?.offline || ''}
                                onChange={e => {
                                  const val = e.target.value ? Number(e.target.value) : undefined;
                                  const next = [...units];
                                  next[idx] = { ...current, prices: { ...current.prices, offline: val } };
                                  setUnits(next);
                                }}
                              />
                           </div>
                           <div>
                              <div className="flex justify-between">
                                <label className="text-[9px] text-gray-400 uppercase flex items-center gap-1"><Globe size={10}/> Website</label>
                                {current.prices?.website && formData.Modal > 0 && (
                                  <span className={`text-[8px] font-bold ${calculateProfit(current.prices.website, formData.Modal * (current.contains || 1)).profit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                    {((calculateProfit(current.prices.website, formData.Modal * (current.contains || 1)).profit / (formData.Modal * (current.contains || 1))) * 100).toFixed(0)}%
                                  </span>
                                )}
                              </div>
                              <input type="number" placeholder="Default" className="w-full bg-white p-1.5 rounded-lg text-xs font-bold border outline-none" 
                                value={current.prices?.website || ''}
                                onChange={e => {
                                  const val = e.target.value ? Number(e.target.value) : undefined;
                                  const next = [...units];
                                  next[idx] = { ...current, prices: { ...current.prices, website: val } };
                                  setUnits(next);
                                }}
                              />
                           </div>
                           <div>
                              <div className="flex justify-between">
                                <label className="text-[9px] text-gray-400 uppercase flex items-center gap-1"><ShoppingBag size={10}/> Shopee</label>
                                {current.prices?.shopee && formData.Modal > 0 && (
                                  <span className={`text-[8px] font-bold ${calculateProfit(current.prices.shopee, formData.Modal * (current.contains || 1)).profit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                    {((calculateProfit(current.prices.shopee, formData.Modal * (current.contains || 1)).profit / (formData.Modal * (current.contains || 1))) * 100).toFixed(0)}%
                                  </span>
                                )}
                              </div>
                              <input type="number" placeholder="Default" className="w-full bg-white p-1.5 rounded-lg text-xs font-bold border outline-none" 
                                value={current.prices?.shopee || ''}
                                onChange={e => {
                                  const val = e.target.value ? Number(e.target.value) : undefined;
                                  const next = [...units];
                                  next[idx] = { ...current, prices: { ...current.prices, shopee: val } };
                                  setUnits(next);
                                }}
                              />
                           </div>
                           <div>
                              <div className="flex justify-between">
                                <label className="text-[9px] text-gray-400 uppercase flex items-center gap-1"><Video size={10}/> TikTok</label>
                                {current.prices?.tiktok && formData.Modal > 0 && (
                                  <span className={`text-[8px] font-bold ${calculateProfit(current.prices.tiktok, formData.Modal * (current.contains || 1)).profit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                    {((calculateProfit(current.prices.tiktok, formData.Modal * (current.contains || 1)).profit / (formData.Modal * (current.contains || 1))) * 100).toFixed(0)}%
                                  </span>
                                )}
                              </div>
                              <input type="number" placeholder="Default" className="w-full bg-white p-1.5 rounded-lg text-xs font-bold border outline-none" 
                                value={current.prices?.tiktok || ''}
                                onChange={e => {
                                  const val = e.target.value ? Number(e.target.value) : undefined;
                                  const next = [...units];
                                  next[idx] = { ...current, prices: { ...current.prices, tiktok: val } };
                                  setUnits(next);
                                }}
                              />
                           </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] font-black text-gray-500 uppercase">Isi (Konversi)</span>
                        <input
                          type="number"
                          disabled={code === 'PCS'}
                          className="w-32 bg-white p-3 rounded-xl text-sm font-black text-right outline-none border disabled:opacity-60"
                          value={code === 'PCS' ? 1 : (current.contains || '')}
                          onChange={(e) => {
                            const val = e.target.value === '' ? undefined : Number(e.target.value);
                            const next = [...units];
                            next[idx] = { ...current, contains: code === 'PCS' ? 1 : val };
                            setUnits(next);
                          }}
                        />
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] font-black text-gray-500 uppercase">Min Qty</span>
                        <input
                          type="number"
                          min="0"
                          className="w-32 bg-white p-3 rounded-xl text-sm font-black text-right outline-none border"
                          value={current.minQty || ''}
                          onChange={(e) => {
                            const val = e.target.value === '' ? undefined : Number(e.target.value);
                            const next = [...units];
                            next[idx] = { ...current, minQty: val };
                            setUnits(next);
                          }}
                        />
                      </div>
                      <div className="text-[10px] font-black text-gray-500 pt-2 border-t border-gray-200">
                        {code} - Rp{basePrice.toLocaleString('id-ID')}{' '}
                        <span className="mx-1 font-bold text-gray-800">Rp{Number(unitPrice || 0).toLocaleString('id-ID')}</span>
                        / Isi {contains || 0} ( Rp {perPcs.toLocaleString('id-ID')} /pcs )
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* BAGIAN 4: MEDIA & SUPPLIER */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-gray-100">
              <h3 className="text-xs font-black uppercase text-gray-400 mb-4 flex items-center gap-2"><ImageIcon size={14} /> Media</h3>
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className="w-28 h-28 border-2 border-dashed border-gray-200 rounded-xl overflow-hidden relative flex items-center justify-center bg-gray-50">
                    {imagePreview ? (
                      <Image src={imagePreview} alt="Preview" fill className="object-cover" />
                    ) : (
                      <ImageIcon size={20} className="text-gray-300" />
                    )}
                  </div>
                  <label className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-xl cursor-pointer text-xs font-bold text-gray-700">
                    Ganti Foto
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleImageChange}
                    />
                  </label>
                </div>
                <input type="text" placeholder="URL Foto Produk" className="w-full p-4 bg-gray-50 rounded-2xl border-none font-bold text-xs" value={formData.Link_Foto} onChange={e => setFormData({ ...formData, Link_Foto: e.target.value })} />
                <textarea rows={3} placeholder="Deskripsi Singkat..." className="w-full p-4 bg-gray-50 rounded-2xl border-none font-bold text-xs" value={formData.Deskripsi} onChange={e => setFormData({ ...formData, Deskripsi: e.target.value })}></textarea>
              </div>
            </div>
            <div className="bg-blue-600 p-6 rounded-[2.5rem] shadow-xl text-white">
              <h3 className="text-xs font-black uppercase text-blue-200 mb-4 flex items-center gap-2"><Truck size={14} /> Supplier</h3>
              <div className="space-y-4">
                <input type="text" placeholder="Nama Supplier" className="w-full p-4 bg-blue-500/30 rounded-2xl border-none font-bold placeholder:text-blue-200 text-white" value={formData.Supplier} onChange={e => setFormData({ ...formData, Supplier: e.target.value })} />
                <input type="text" placeholder="WA: 628..." className="w-full p-4 bg-blue-500/30 rounded-2xl border-none font-bold placeholder:text-blue-200 text-white" value={formData.No_WA_Supplier} onChange={e => setFormData({ ...formData, No_WA_Supplier: e.target.value })} />
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col-reverse md:flex-row gap-4 pt-6">
            <button 
                type="button" 
                onClick={handleDelete}
                disabled={isSubmitting || isDeleting}
                className="p-5 bg-red-50 text-red-600 font-black uppercase text-xs rounded-[2rem] shadow-sm border border-red-100 hover:bg-red-100 transition-all flex items-center justify-center gap-2"
            >
               <Trash2 size={18} /> Hapus Produk
            </button>
            <div className="flex-1 flex gap-4">
                <button type="button" onClick={() => router.back()} className="flex-1 p-5 bg-white text-gray-400 font-black uppercase text-xs rounded-[2rem] shadow-sm border hover:bg-gray-100 transition-all">
                Batal
                </button>
                <button type="submit" disabled={isSubmitting || isDeleting} className="flex-[2] p-5 bg-black text-white font-black uppercase text-xs rounded-[2rem] shadow-2xl hover:bg-emerald-600 transition-all flex items-center justify-center gap-2 tracking-widest">
                {isSubmitting ? 'MENYIMPAN...' : <><Save size={18} /> Simpan Perubahan</>}
                </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
