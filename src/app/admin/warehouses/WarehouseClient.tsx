'use client';

import { useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { Toaster } from 'react-hot-toast';
import notify from '@/lib/notify';
import {
  Plus, Edit, Search, X, Warehouse, MapPin, Package,
  RefreshCw, ArrowRightLeft, User, Phone, CheckCircle2,
  Building2, Layers, LayoutGrid, List, ExternalLink,
  ShieldCheck, AlertCircle
} from 'lucide-react';
import { getWarehouses, createWarehouse, updateWarehouse } from '@/lib/actions/inventory.actions';

export type WarehouseData = {
  id: string;
  name: string;
  address?: string | null;
  pic?: string | null;
  phone?: string | null;
  capacity?: number;
  isActive?: boolean;
  isMain?: boolean;
  totalSku?: number;
  totalStock?: number;
  createdAt?: string | Date;
  _count?: { batches: number };
};

interface WarehouseClientProps {
  initialWarehouses: WarehouseData[];
}

export default function WarehouseClient({ initialWarehouses }: WarehouseClientProps) {
  const [loading, setLoading] = useState(false);
  const [warehouses, setWarehouses] = useState<WarehouseData[]>(initialWarehouses || []);
  const [search, setSearch] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<'ALL' | 'MAIN' | 'BRANCH'>('ALL');
  const [viewMode, setViewMode] = useState<'GRID' | 'TABLE'>('GRID');

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: '',
    address: '',
    pic: '',
    phone: '',
    capacity: 10000,
    isMain: false,
  });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getWarehouses();
      setWarehouses(data as WarehouseData[]);
    } catch (err) {
      console.error('Gagal memuat gudang:', err);
      notify.error('Gagal memperbarui data gudang');
    } finally {
      setLoading(false);
    }
  }, []);

  // Filtered warehouses
  const filtered = useMemo(() => {
    return warehouses.filter(w => {
      const matchSearch =
        w.name.toLowerCase().includes(search.toLowerCase()) ||
        (w.address || '').toLowerCase().includes(search.toLowerCase()) ||
        (w.pic || '').toLowerCase().includes(search.toLowerCase()) ||
        (w.phone || '').toLowerCase().includes(search.toLowerCase());

      if (!matchSearch) return false;

      if (selectedFilter === 'MAIN') return w.isMain;
      if (selectedFilter === 'BRANCH') return !w.isMain;
      return true;
    });
  }, [warehouses, search, selectedFilter]);

  // Ringkasan KPI
  const stats = useMemo(() => {
    const totalWarehouses = warehouses.length;
    const mainWarehouses = warehouses.filter(w => w.isMain).length;
    const totalSku = warehouses.reduce((acc, curr) => acc + (curr.totalSku || 0), 0);
    const totalStock = warehouses.reduce((acc, curr) => acc + (curr.totalStock || 0), 0);
    const totalCapacity = warehouses.reduce((acc, curr) => acc + (curr.capacity || 0), 0);
    const avgOccupancy = totalCapacity > 0 ? Math.min(100, Math.round((totalStock / totalCapacity) * 100)) : 0;

    return { totalWarehouses, mainWarehouses, totalSku, totalStock, totalCapacity, avgOccupancy };
  }, [warehouses]);

  const openAdd = () => {
    setEditId(null);
    setForm({
      name: '',
      address: '',
      pic: '',
      phone: '',
      capacity: 10000,
      isMain: false,
    });
    setModalOpen(true);
  };

  const openEdit = (w: WarehouseData) => {
    setEditId(w.id);
    setForm({
      name: w.name,
      address: w.address || '',
      pic: w.pic || '',
      phone: w.phone || '',
      capacity: w.capacity || 10000,
      isMain: !!w.isMain,
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      notify.error('Nama gudang wajib diisi');
      return;
    }
    setSaving(true);
    const payload = {
      name: form.name.trim(),
      address: form.address.trim() || undefined,
      pic: form.pic.trim() || undefined,
      phone: form.phone.trim() || undefined,
      capacity: Number(form.capacity) || 0,
      isMain: form.isMain,
    };

    const result = editId
      ? await updateWarehouse(editId, payload)
      : await createWarehouse(payload);

    if (result.success) {
      notify.success(editId ? 'Gudang berhasil diperbarui' : 'Gudang berhasil ditambahkan');
      setModalOpen(false);
      await load();
    } else {
      notify.error(result.error || 'Gagal menyimpan gudang');
    }
    setSaving(false);
  };

  return (
    <>
      <Toaster />
      <div className="bg-gray-50 min-h-screen p-3 md:p-6 space-y-6">
        {/* Header Eksekutif */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-5 md:p-6 rounded-2xl border border-gray-100 shadow-sm">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                Multi-Warehouse System
              </span>
              <span className="text-xs text-gray-400">•</span>
              <span className="text-xs text-gray-500 font-medium">AtayaToko Logistics</span>
            </div>
            <h1 className="text-2xl font-black text-gray-900 tracking-tight">Pusat Gudang & Distribusi</h1>
            <p className="text-xs md:text-sm text-gray-500 mt-1 max-w-2xl">
              Kelola lokasi fisik penyimpanan, monitor kapasitas tampung, alokasi stok per gudang, serta kelancaran transfer antar fasilitas.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={load}
              disabled={loading}
              title="Segarkan data secara real-time"
              className="p-2.5 bg-gray-50 border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-100 disabled:opacity-50 transition-all shadow-sm"
            >
              <RefreshCw size={17} className={loading ? 'animate-spin text-emerald-600' : ''} />
            </button>

            {warehouses.length > 0 && (
              <Link
                href={`/admin/warehouses/mutasi/${warehouses[0].id}`}
                className="flex items-center gap-2 bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-100 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-sm"
              >
                <ArrowRightLeft size={15} /> Transfer Antar Gudang
              </Link>
            )}

            <button
              onClick={openAdd}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl text-xs font-bold transition-all shadow-sm hover:shadow"
            >
              <Plus size={16} /> Tambah Gudang Baru
            </button>
          </div>
        </div>

        {/* 4 Stat Cards KPI */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 md:gap-4">
          {/* Card 1 */}
          <div className="bg-white p-4 md:p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
              <Building2 size={24} />
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Total Gudang</p>
              <div className="flex items-baseline gap-1.5 mt-0.5">
                <span className="text-xl md:text-2xl font-black text-gray-900">{stats.totalWarehouses}</span>
                <span className="text-xs font-bold text-gray-500">Lokasi</span>
              </div>
              <p className="text-[11px] text-emerald-600 font-semibold mt-0.5">{stats.mainWarehouses} Gudang Utama</p>
            </div>
          </div>

          {/* Card 2 */}
          <div className="bg-white p-4 md:p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
              <Layers size={24} />
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Total Varian (SKU)</p>
              <div className="flex items-baseline gap-1.5 mt-0.5">
                <span className="text-xl md:text-2xl font-black text-gray-900">{stats.totalSku.toLocaleString('id-ID')}</span>
                <span className="text-xs font-bold text-gray-500">Item</span>
              </div>
              <p className="text-[11px] text-gray-500 font-medium mt-0.5">Terdaftar di gudang</p>
            </div>
          </div>

          {/* Card 3 */}
          <div className="bg-white p-4 md:p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
              <Package size={24} />
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Total Stok Fisik</p>
              <div className="flex items-baseline gap-1.5 mt-0.5">
                <span className="text-xl md:text-2xl font-black text-gray-900">{stats.totalStock.toLocaleString('id-ID')}</span>
                <span className="text-xs font-bold text-gray-500">Unit</span>
              </div>
              <p className="text-[11px] text-emerald-600 font-semibold mt-0.5">Siap didistribusikan</p>
            </div>
          </div>

          {/* Card 4 */}
          <div className="bg-white p-4 md:p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
              <Warehouse size={24} />
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Kapasitas Maksimal</p>
              <div className="flex items-baseline gap-1.5 mt-0.5">
                <span className="text-xl md:text-2xl font-black text-gray-900">
                  {stats.totalCapacity > 0 ? stats.totalCapacity.toLocaleString('id-ID') : 'Tak Terbatas'}
                </span>
                {stats.totalCapacity > 0 && <span className="text-xs font-bold text-gray-500">Unit</span>}
              </div>
              <p className="text-[11px] text-gray-500 font-medium mt-0.5">
                {stats.totalCapacity > 0 ? `Okupansi ~${stats.avgOccupancy}%` : 'Daya tampung dinamis'}
              </p>
            </div>
          </div>
        </div>

        {/* Toolbar Pencarian & Filter View */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-3.5 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:w-80">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Cari gudang, alamat, atau PIC..."
              className="w-full pl-9 pr-8 py-2 text-xs md:text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X size={14} />
              </button>
            )}
          </div>

          <div className="flex items-center justify-between sm:justify-end gap-2 w-full sm:w-auto">
            {/* Filter Buttons */}
            <div className="flex bg-gray-100 p-1 rounded-xl">
              <button
                onClick={() => setSelectedFilter('ALL')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  selectedFilter === 'ALL' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                Semua ({warehouses.length})
              </button>
              <button
                onClick={() => setSelectedFilter('MAIN')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  selectedFilter === 'MAIN' ? 'bg-white text-emerald-700 shadow-xs' : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                Utama ({warehouses.filter(w => w.isMain).length})
              </button>
              <button
                onClick={() => setSelectedFilter('BRANCH')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  selectedFilter === 'BRANCH' ? 'bg-white text-indigo-700 shadow-xs' : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                Cabang ({warehouses.filter(w => !w.isMain).length})
              </button>
            </div>

            {/* View Mode Toggle */}
            <div className="flex bg-gray-100 p-1 rounded-xl">
              <button
                onClick={() => setViewMode('GRID')}
                title="Tampilan Kartu Grid"
                className={`p-1.5 rounded-lg transition-all ${
                  viewMode === 'GRID' ? 'bg-white text-emerald-600 shadow-xs' : 'text-gray-400 hover:text-gray-700'
                }`}
              >
                <LayoutGrid size={15} />
              </button>
              <button
                onClick={() => setViewMode('TABLE')}
                title="Tampilan Tabel Rinci"
                className={`p-1.5 rounded-lg transition-all ${
                  viewMode === 'TABLE' ? 'bg-white text-emerald-600 shadow-xs' : 'text-gray-400 hover:text-gray-700'
                }`}
              >
                <List size={15} />
              </button>
            </div>
          </div>
        </div>

        {/* Content Area */}
        {filtered.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center">
            <Warehouse size={48} className="mx-auto text-gray-300 mb-3" />
            <h3 className="text-base font-bold text-gray-800">Tidak ada gudang ditemukan</h3>
            <p className="text-xs text-gray-500 max-w-sm mx-auto mt-1">
              {search
                ? `Tidak ada data gudang yang cocok dengan kata kunci "${search}".`
                : 'Belum ada data gudang yang terdaftar di sistem.'}
            </p>
            {search && (
              <button
                onClick={() => setSearch('')}
                className="mt-4 px-4 py-2 text-xs font-bold bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-all"
              >
                Reset Pencarian
              </button>
            )}
          </div>
        ) : viewMode === 'GRID' ? (
          /* Grid View Mode */
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map(w => {
              const capacity = w.capacity || 0;
              const totalStock = w.totalStock || 0;
              const occupancy = capacity > 0 ? Math.min(100, Math.round((totalStock / capacity) * 100)) : 0;

              return (
                <div
                  key={w.id}
                  className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all flex flex-col justify-between overflow-hidden group"
                >
                  <div className="p-5">
                    {/* Top Header Card */}
                    <div className="flex items-start justify-between gap-3 mb-3.5">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-md ${
                            w.isMain
                              ? 'bg-gradient-to-br from-emerald-500 to-teal-600 text-white'
                              : 'bg-gradient-to-br from-blue-500 to-indigo-600 text-white'
                          }`}
                        >
                          <Warehouse size={22} />
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider ${
                                w.isMain
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                              }`}
                            >
                              {w.isMain ? 'Gudang Utama' : 'Gudang Cabang'}
                            </span>
                            <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-600">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                              Aktif
                            </span>
                          </div>
                          <h3 className="font-black text-gray-900 text-base mt-1 line-clamp-1">{w.name}</h3>
                        </div>
                      </div>

                      <button
                        onClick={() => openEdit(w)}
                        title="Edit Informasi Gudang"
                        className="p-1.5 bg-gray-50 text-gray-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all"
                      >
                        <Edit size={14} />
                      </button>
                    </div>

                    {/* Alamat & Kontak PIC */}
                    <div className="space-y-2 py-2 border-y border-gray-50 text-xs text-gray-600">
                      <div className="flex items-start gap-2">
                        <MapPin size={13} className="text-gray-400 mt-0.5 shrink-0" />
                        <span className="line-clamp-2 text-gray-600">{w.address || 'Alamat belum diatur'}</span>
                      </div>

                      <div className="flex items-center justify-between gap-2 pt-1">
                        <div className="flex items-center gap-1.5">
                          <User size={12} className="text-gray-400" />
                          <span className="text-gray-700 font-medium">PIC: {w.pic || 'Belum ditentukan'}</span>
                        </div>
                        {w.phone && (
                          <div className="flex items-center gap-1 text-gray-500">
                            <Phone size={11} className="text-gray-400" />
                            <span>{w.phone}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Metrik Stok & SKU */}
                    <div className="grid grid-cols-2 gap-2 mt-4 bg-gray-50 p-2.5 rounded-xl border border-gray-100">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Total SKU</p>
                        <p className="text-sm font-black text-gray-900 mt-0.5">
                          {(w.totalSku || 0).toLocaleString('id-ID')} <span className="text-[10px] font-semibold text-gray-500">Varian</span>
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Stok Fisik</p>
                        <p className="text-sm font-black text-emerald-600 mt-0.5">
                          {(w.totalStock || 0).toLocaleString('id-ID')} <span className="text-[10px] font-semibold text-gray-500">Unit</span>
                        </p>
                      </div>
                    </div>

                    {/* Progress Bar Kapasitas */}
                    {capacity > 0 && (
                      <div className="mt-3.5">
                        <div className="flex justify-between text-[11px] font-bold mb-1">
                          <span className="text-gray-500">Kapasitas Okupansi</span>
                          <span className={occupancy > 90 ? 'text-red-600' : 'text-gray-700'}>{occupancy}%</span>
                        </div>
                        <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${
                              occupancy > 90
                                ? 'bg-red-500'
                                : occupancy > 75
                                ? 'bg-amber-500'
                                : 'bg-emerald-500'
                            }`}
                            style={{ width: `${occupancy}%` }}
                          />
                        </div>
                        <p className="text-[10px] text-gray-400 mt-1">
                          Maks: {capacity.toLocaleString('id-ID')} unit
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Card Action Footer */}
                  <div className="p-3 bg-gray-50 border-t border-gray-100 flex items-center justify-between gap-2">
                    <Link
                      href={`/admin/warehouses/mutasi/${w.id}`}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 bg-white border border-gray-200 text-gray-700 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 rounded-xl text-xs font-bold transition-all shadow-2xs"
                    >
                      <ArrowRightLeft size={13} /> Mutasi Stok
                    </Link>

                    <Link
                      href={`/admin/inventory?warehouseId=${w.id}`}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 bg-emerald-600 text-white hover:bg-emerald-700 rounded-xl text-xs font-bold transition-all shadow-2xs"
                    >
                      <Package size={13} /> Lihat Stok
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* Table View Mode */
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-50 text-gray-400 font-bold uppercase tracking-wider text-[10px] border-b border-gray-100">
                  <tr>
                    <th className="px-5 py-3.5">Gudang</th>
                    <th className="px-5 py-3.5">Lokasi / Alamat</th>
                    <th className="px-5 py-3.5">PIC & Kontak</th>
                    <th className="px-5 py-3.5 text-right">Total SKU</th>
                    <th className="px-5 py-3.5 text-right">Stok Fisik</th>
                    <th className="px-5 py-3.5">Kapasitas</th>
                    <th className="px-5 py-3.5 text-center">Aksi Cepat</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filtered.map(w => {
                    const capacity = w.capacity || 0;
                    const totalStock = w.totalStock || 0;
                    const occupancy = capacity > 0 ? Math.min(100, Math.round((totalStock / capacity) * 100)) : 0;

                    return (
                      <tr key={w.id} className="hover:bg-gray-50/80 transition-colors">
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div
                              className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                                w.isMain ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-blue-600'
                              }`}
                            >
                              <Warehouse size={16} />
                            </div>
                            <div>
                              <div className="font-black text-gray-900 text-sm">{w.name}</div>
                              <span
                                className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${
                                  w.isMain ? 'bg-emerald-100 text-emerald-700' : 'bg-indigo-100 text-indigo-700'
                                }`}
                              >
                                {w.isMain ? 'Utama' : 'Cabang'}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-4 text-gray-600 max-w-xs truncate">
                          {w.address || '-'}
                        </td>
                        <td className="px-5 py-4">
                          <div className="font-bold text-gray-800">{w.pic || '-'}</div>
                          <div className="text-[11px] text-gray-400">{w.phone || '-'}</div>
                        </td>
                        <td className="px-5 py-4 text-right font-black text-gray-900">
                          {(w.totalSku || 0).toLocaleString('id-ID')}
                        </td>
                        <td className="px-5 py-4 text-right font-black text-emerald-600">
                          {(w.totalStock || 0).toLocaleString('id-ID')}
                        </td>
                        <td className="px-5 py-4 min-w-[140px]">
                          {capacity > 0 ? (
                            <div>
                              <div className="flex justify-between text-[10px] font-bold text-gray-500 mb-0.5">
                                <span>{occupancy}%</span>
                                <span>{capacity.toLocaleString('id-ID')}</span>
                              </div>
                              <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${
                                    occupancy > 90 ? 'bg-red-500' : 'bg-emerald-500'
                                  }`}
                                  style={{ width: `${occupancy}%` }}
                                />
                              </div>
                            </div>
                          ) : (
                            <span className="text-gray-400 italic">Dinamis</span>
                          )}
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex items-center justify-center gap-1.5">
                            <Link
                              href={`/admin/warehouses/mutasi/${w.id}`}
                              title="Mutasi Stok"
                              className="p-1.5 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-lg transition-all"
                            >
                              <ArrowRightLeft size={14} />
                            </Link>
                            <Link
                              href={`/admin/inventory?warehouseId=${w.id}`}
                              title="Lihat Inventaris"
                              className="p-1.5 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 rounded-lg transition-all"
                            >
                              <Package size={14} />
                            </Link>
                            <button
                              onClick={() => openEdit(w)}
                              title="Edit Gudang"
                              className="p-1.5 bg-gray-100 text-gray-600 hover:bg-gray-200 rounded-lg transition-all"
                            >
                              <Edit size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Modal Tambah / Edit Gudang */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setModalOpen(false)}
          />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 overflow-hidden">
            <div className="flex items-center justify-between pb-4 border-b border-gray-100 mb-5">
              <div>
                <h2 className="text-lg font-black text-gray-900">{editId ? 'Edit Gudang' : 'Tambah Gudang Baru'}</h2>
                <p className="text-xs text-gray-500 mt-0.5">Lengkapi identitas dan kapasitas fasilitas penyimpanan.</p>
              </div>
              <button
                onClick={() => setModalOpen(false)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              {/* Nama & Tipe */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-gray-700 mb-1">Nama Gudang *</label>
                  <input
                    value={form.name}
                    onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                    placeholder="Contoh: Gudang Barat / Toko Depan"
                    className="w-full px-3 py-2.5 text-xs bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block font-bold text-gray-700 mb-1">Status Fasilitas</label>
                  <label className="flex items-center gap-2 px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl cursor-pointer hover:bg-gray-100 transition-all">
                    <input
                      type="checkbox"
                      checked={form.isMain}
                      onChange={e => setForm(p => ({ ...p, isMain: e.target.checked }))}
                      className="rounded text-emerald-600 focus:ring-emerald-500"
                    />
                    <span className="font-bold text-gray-800">Tandai Gudang Utama</span>
                  </label>
                </div>
              </div>

              {/* PIC & Phone */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-gray-700 mb-1">Penanggung Jawab (PIC)</label>
                  <input
                    value={form.pic}
                    onChange={e => setForm(p => ({ ...p, pic: e.target.value }))}
                    placeholder="Nama Kepala Gudang / Staf"
                    className="w-full px-3 py-2.5 text-xs bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block font-bold text-gray-700 mb-1">Nomor Telepon / WhatsApp</label>
                  <input
                    value={form.phone}
                    onChange={e => setForm(p => ({ ...p, phone: e.target.value }))}
                    placeholder="0812xxxxxxxx"
                    className="w-full px-3 py-2.5 text-xs bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              {/* Kapasitas Maks */}
              <div>
                <label className="block font-bold text-gray-700 mb-1">Estimasi Kapasitas Maksimal (Unit)</label>
                <input
                  type="number"
                  value={form.capacity}
                  onChange={e => setForm(p => ({ ...p, capacity: Number(e.target.value) }))}
                  placeholder="10000"
                  className="w-full px-3 py-2.5 text-xs bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <p className="text-[11px] text-gray-400 mt-1">Digunakan untuk menghitung persentase okupansi gudang.</p>
              </div>

              {/* Alamat */}
              <div>
                <label className="block font-bold text-gray-700 mb-1">Alamat Lengkap</label>
                <textarea
                  value={form.address}
                  onChange={e => setForm(p => ({ ...p, address: e.target.value }))}
                  placeholder="Alamat lengkap fasilitas, nomor jalan, kecamatan, kota..."
                  rows={3}
                  className="w-full px-3 py-2 text-xs bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6 pt-4 border-t border-gray-100">
              <button
                onClick={() => setModalOpen(false)}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-xs font-bold text-gray-600 hover:bg-gray-50 transition-all"
              >
                Batal
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 py-2.5 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 disabled:opacity-50 transition-all shadow-sm"
              >
                {saving ? 'Menyimpan...' : editId ? 'Simpan Perubahan' : 'Buat Gudang Baru'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
