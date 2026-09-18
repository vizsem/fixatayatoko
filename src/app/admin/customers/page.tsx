'use client';

import { useEffect, useState, useCallback } from 'react';
import { Toaster } from 'react-hot-toast';
import notify from '@/lib/notify';
import { Plus, Edit, Trash2, Search, X, UserCircle, Phone, Mail, MapPin, ShoppingBag } from 'lucide-react';
import { getCustomers, createCustomer, updateCustomer, deleteCustomer } from '@/lib/actions/customer.actions';

type Customer = {
  id: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  type?: string | null;
  createdAt: Date;
  _count?: { salesOrders: number };
};

const emptyForm = { name: '', phone: '', email: '', address: '', type: 'Retail' };

export default function AdminCustomers() {
  const [loading, setLoading] = useState(true);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const data = await getCustomers();
    setCustomers(data as Customer[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = customers.filter(c => {
    const matchSearch = c.name.toLowerCase().includes(search.toLowerCase()) ||
      (c.phone || '').includes(search);
    const matchType = typeFilter === 'all' || c.type === typeFilter;
    return matchSearch && matchType;
  });

  const openAdd = () => { setEditId(null); setForm(emptyForm); setModalOpen(true); };
  const openEdit = (c: Customer) => {
    setEditId(c.id);
    setForm({ name: c.name, phone: c.phone || '', email: c.email || '', address: c.address || '', type: c.type || 'Retail' });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { notify.error('Nama pelanggan wajib diisi'); return; }
    setSaving(true);
    const payload = { name: form.name, phone: form.phone || undefined, email: form.email || undefined, address: form.address || undefined, type: form.type || undefined };
    const result = editId ? await updateCustomer(editId, payload) : await createCustomer(payload);
    if (result.success) {
      notify.success(editId ? 'Pelanggan diperbarui' : 'Pelanggan ditambahkan');
      setModalOpen(false);
      await load();
    } else {
      notify.error(result.error || 'Gagal menyimpan');
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    const result = await deleteCustomer(id);
    if (result.success) { notify.success('Pelanggan dihapus'); setDeleteId(null); await load(); }
    else notify.error(result.error || 'Gagal menghapus');
  };

  const TYPE_COLOR: Record<string, string> = {
    Retail: 'bg-blue-100 text-blue-700',
    Grosir: 'bg-purple-100 text-purple-700',
    'Semi-Grosir': 'bg-emerald-100 text-emerald-700',
  };

  return (
    <>
      <Toaster />
      <div className="min-h-screen bg-gray-50 p-3 md:p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
          <div>
            <h1 className="text-xl font-black text-gray-900">Pelanggan</h1>
            <p className="text-xs text-gray-500 mt-0.5">{customers.length} pelanggan terdaftar</p>
          </div>
          <button onClick={openAdd} className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2.5 rounded-xl text-sm font-bold hover:bg-emerald-700 shadow-sm">
            <Plus size={16} /> Tambah Pelanggan
          </button>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-3 mb-4 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Cari nama atau telepon..."
              className="w-full pl-9 pr-4 py-2 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          </div>
          <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
            className="px-3 py-2 text-sm border border-gray-200 rounded-xl bg-gray-50 focus:outline-none focus:ring-2 focus:ring-emerald-500">
            <option value="all">Semua Tipe</option>
            <option value="Retail">Retail</option>
            <option value="Grosir">Grosir</option>
            <option value="Semi-Grosir">Semi-Grosir</option>
          </select>
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" /></div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center">
            <UserCircle size={40} className="mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500 font-medium">Belum ada pelanggan</p>
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map(c => (
              <div key={c.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 hover:shadow-md transition-all group">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-emerald-400 to-blue-500 rounded-xl flex items-center justify-center text-white font-bold text-sm">
                      {c.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900 text-sm">{c.name}</h3>
                      {c.type && <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${TYPE_COLOR[c.type] || 'bg-gray-100 text-gray-600'}`}>{c.type}</span>}
                    </div>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => openEdit(c)} className="p-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100"><Edit size={13} /></button>
                    <button onClick={() => setDeleteId(c.id)} className="p-1.5 bg-red-50 text-red-500 rounded-lg hover:bg-red-100"><Trash2 size={13} /></button>
                  </div>
                </div>
                <div className="space-y-1.5">
                  {c.phone && <div className="flex items-center gap-2 text-xs text-gray-600"><Phone size={11} className="text-gray-400" />{c.phone}</div>}
                  {c.email && <div className="flex items-center gap-2 text-xs text-gray-600"><Mail size={11} className="text-gray-400" /><span className="truncate">{c.email}</span></div>}
                  {c.address && <div className="flex items-center gap-2 text-xs text-gray-600"><MapPin size={11} className="text-gray-400" /><span className="line-clamp-1">{c.address}</span></div>}
                </div>
                {c._count && (
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <span className="text-[10px] font-bold text-purple-600 bg-purple-50 px-2 py-1 rounded-lg">
                      <ShoppingBag size={10} className="inline mr-1" />{c._count.salesOrders} Transaksi
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setModalOpen(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-black text-gray-900">{editId ? 'Edit Pelanggan' : 'Tambah Pelanggan'}</h2>
              <button onClick={() => setModalOpen(false)} className="p-1.5 rounded-lg hover:bg-gray-100"><X size={18} /></button>
            </div>
            <div className="space-y-3">
              {[
                { label: 'Nama *', key: 'name', placeholder: 'Nama lengkap' },
                { label: 'Telepon', key: 'phone', placeholder: '08xxxxxxxxxx' },
                { label: 'Email', key: 'email', placeholder: 'email@contoh.com' },
                { label: 'Alamat', key: 'address', placeholder: 'Alamat lengkap' },
              ].map(f => (
                <div key={f.key}>
                  <label className="block text-xs font-bold text-gray-700 mb-1">{f.label}</label>
                  <input value={(form as any)[f.key]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                    placeholder={f.placeholder}
                    className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl bg-gray-50 focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                </div>
              ))}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Tipe Pelanggan</label>
                <select value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value }))}
                  className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl bg-gray-50 focus:outline-none focus:ring-2 focus:ring-emerald-500">
                  <option value="Retail">Retail</option>
                  <option value="Grosir">Grosir</option>
                  <option value="Semi-Grosir">Semi-Grosir</option>
                </select>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setModalOpen(false)} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-bold text-gray-600 hover:bg-gray-50">Batal</button>
              <button onClick={handleSave} disabled={saving} className="flex-1 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 disabled:opacity-50">
                {saving ? 'Menyimpan...' : 'Simpan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setDeleteId(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center">
            <div className="w-14 h-14 bg-red-100 rounded-2xl flex items-center justify-center mx-auto mb-4"><Trash2 size={24} className="text-red-500" /></div>
            <h2 className="text-lg font-black text-gray-900 mb-2">Hapus Pelanggan?</h2>
            <p className="text-sm text-gray-500 mb-6">Data ini tidak dapat dipulihkan.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteId(null)} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-bold text-gray-600">Batal</button>
              <button onClick={() => handleDelete(deleteId)} className="flex-1 py-2.5 rounded-xl bg-red-500 text-white text-sm font-bold hover:bg-red-600">Hapus</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
