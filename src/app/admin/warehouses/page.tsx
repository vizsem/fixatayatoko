'use client';

import { useEffect, useState, useCallback } from 'react';
import { Toaster } from 'react-hot-toast';
import notify from '@/lib/notify';
import { Plus, Edit, Trash2, Search, X, Warehouse, MapPin, Package } from 'lucide-react';
import { getWarehouses, createWarehouse, updateWarehouse } from '@/lib/actions/inventory.actions';

type WarehouseData = {
  id: string;
  name: string;
  address?: string | null;
  createdAt: Date;
  _count?: { batches: number };
};

export default function AdminWarehouses() {
  const [loading, setLoading] = useState(true);
  const [warehouses, setWarehouses] = useState<WarehouseData[]>([]);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', address: '' });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const data = await getWarehouses();
    setWarehouses(data as WarehouseData[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = warehouses.filter(w =>
    w.name.toLowerCase().includes(search.toLowerCase()) ||
    (w.address || '').toLowerCase().includes(search.toLowerCase())
  );

  const openAdd = () => { setEditId(null); setForm({ name: '', address: '' }); setModalOpen(true); };
  const openEdit = (w: WarehouseData) => {
    setEditId(w.id);
    setForm({ name: w.name, address: w.address || '' });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { notify.error('Nama gudang wajib diisi'); return; }
    setSaving(true);
    const result = editId
      ? await updateWarehouse(editId, { name: form.name, address: form.address || undefined })
      : await createWarehouse({ name: form.name, address: form.address || undefined });
    if (result.success) {
      notify.success(editId ? 'Gudang diperbarui' : 'Gudang ditambahkan');
      setModalOpen(false);
      await load();
    } else {
      notify.error(result.error || 'Gagal menyimpan');
    }
    setSaving(false);
  };

  return (
    <>
      <Toaster />
      <div className="min-h-screen bg-gray-50 p-3 md:p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
          <div>
            <h1 className="text-xl font-black text-gray-900">Gudang</h1>
            <p className="text-xs text-gray-500 mt-0.5">{warehouses.length} gudang aktif</p>
          </div>
          <button onClick={openAdd} className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2.5 rounded-xl text-sm font-bold hover:bg-emerald-700 shadow-sm">
            <Plus size={16} /> Tambah Gudang
          </button>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-3 mb-4">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Cari gudang..."
              className="w-full pl-9 pr-4 py-2 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" /></div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center">
            <Warehouse size={40} className="mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500 font-medium">Belum ada gudang</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map(w => (
              <div key={w.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:shadow-md transition-all group">
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg">
                    <Warehouse size={22} className="text-white" />
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => openEdit(w)} className="p-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100"><Edit size={13} /></button>
                  </div>
                </div>
                <h3 className="font-black text-gray-900 text-base mb-1">{w.name}</h3>
                {w.address && (
                  <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-3">
                    <MapPin size={11} className="text-gray-400 flex-shrink-0" />
                    <span className="line-clamp-2">{w.address}</span>
                  </div>
                )}
                {w._count && (
                  <div className="flex items-center gap-2 mt-auto pt-3 border-t border-gray-100">
                    <Package size={12} className="text-gray-400" />
                    <span className="text-xs text-gray-500"><strong className="text-gray-800">{w._count.batches}</strong> batch stok</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setModalOpen(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-black text-gray-900">{editId ? 'Edit Gudang' : 'Tambah Gudang'}</h2>
              <button onClick={() => setModalOpen(false)} className="p-1.5 rounded-lg hover:bg-gray-100"><X size={18} /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Nama Gudang *</label>
                <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                  placeholder="Gudang Utama"
                  className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl bg-gray-50 focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Alamat</label>
                <textarea value={form.address} onChange={e => setForm(p => ({ ...p, address: e.target.value }))}
                  placeholder="Alamat lengkap gudang..."
                  rows={3}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl bg-gray-50 focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none" />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setModalOpen(false)} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-bold text-gray-600 hover:bg-gray-50">Batal</button>
              <button onClick={handleSave} disabled={saving} className="flex-1 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 disabled:opacity-50">
                {saving ? 'Menyimpan...' : 'Simpan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
