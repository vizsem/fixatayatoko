'use client';

import { useEffect, useState, useCallback } from 'react';
import { Toaster } from 'react-hot-toast';
import notify from '@/lib/notify';
import { Plus, Edit, Trash2, Search, X, Shield, User, UserCheck, Users } from 'lucide-react';
import { getUsers, createUser, updateUser, deleteUser } from '@/lib/actions/user.actions';

type UserData = {
  id: string;
  name?: string | null;
  email?: string | null;
  role: string;
  createdAt: Date;
};

const ROLE_COLOR: Record<string, string> = {
  OWNER: 'bg-purple-100 text-purple-700',
  ADMIN: 'bg-blue-100 text-blue-700',
  WAREHOUSE: 'bg-emerald-100 text-emerald-700',
  SALES: 'bg-orange-100 text-orange-700',
  DRIVER: 'bg-gray-100 text-gray-700',
};

const emptyForm = { name: '', email: '', password: '', role: 'SALES' as const };

export default function AdminUsers() {
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<UserData[]>([]);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<any>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const data = await getUsers();
    setUsers(data as UserData[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = users.filter(u =>
    (u.name || '').toLowerCase().includes(search.toLowerCase()) ||
    (u.email || '').toLowerCase().includes(search.toLowerCase())
  );

  const openAdd = () => { setEditId(null); setForm(emptyForm); setModalOpen(true); };
  const openEdit = (u: UserData) => {
    setEditId(u.id);
    setForm({ name: u.name || '', email: u.email || '', password: '', role: u.role });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.name || !form.email) { notify.error('Nama dan email wajib diisi'); return; }
    if (!editId && !form.password) { notify.error('Password wajib diisi untuk user baru'); return; }
    setSaving(true);
    const result = editId 
      ? await updateUser(editId, { name: form.name, email: form.email, role: form.role, ...(form.password ? { password: form.password } : {}) }) 
      : await createUser({ name: form.name, email: form.email, password: form.password, role: form.role });
    if (result.success) {
      notify.success(editId ? 'User diperbarui' : 'User dibuat');
      setModalOpen(false);
      await load();
    } else {
      notify.error(result.error || 'Gagal menyimpan');
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    const result = await deleteUser(id);
    if (result.success) { notify.success('User dihapus'); setDeleteId(null); await load(); }
    else notify.error(result.error || 'Gagal menghapus');
  };

  return (
    <>
      <Toaster />
      <div className="min-h-screen bg-gray-50 p-3 md:p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
          <div>
            <h1 className="text-xl font-black text-gray-900">Manajemen User</h1>
            <p className="text-xs text-gray-500 mt-0.5">{users.length} user terdaftar · RBAC aktif</p>
          </div>
          <button onClick={openAdd} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2.5 rounded-xl text-sm font-bold hover:bg-blue-700 shadow-sm">
            <Plus size={16} /> Tambah User
          </button>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-3 mb-4">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Cari nama atau email..."
              className="w-full pl-9 pr-4 py-2 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>

        {/* Role summary */}
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 mb-4">
          {Object.entries(ROLE_COLOR).map(([role, color]) => (
            <div key={role} className={`rounded-xl p-2 text-center ${color}`}>
              <p className="text-xs font-bold">{role}</p>
              <p className="text-lg font-black">{users.filter(u => u.role === role).length}</p>
            </div>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead><tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left p-3 text-xs font-bold text-gray-500 uppercase">User</th>
                <th className="text-left p-3 text-xs font-bold text-gray-500 uppercase">Role</th>
                <th className="text-left p-3 text-xs font-bold text-gray-500 uppercase">Bergabung</th>
                <th className="p-3"></th>
              </tr></thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.length === 0 ? (
                  <tr><td colSpan={4} className="text-center py-10 text-gray-400">Tidak ada user</td></tr>
                ) : filtered.map(u => (
                  <tr key={u.id} className="hover:bg-gray-50 transition-colors group">
                    <td className="p-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-gradient-to-br from-blue-400 to-purple-500 rounded-xl flex items-center justify-center text-white font-bold text-sm">
                          {(u.name || u.email || 'U').charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-bold text-gray-800">{u.name || 'Unnamed'}</p>
                          <p className="text-xs text-gray-400">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-3">
                      <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${ROLE_COLOR[u.role] || 'bg-gray-100 text-gray-600'}`}>{u.role}</span>
                    </td>
                    <td className="p-3 text-xs text-gray-500">{new Date(u.createdAt).toLocaleDateString('id-ID')}</td>
                    <td className="p-3">
                      <div className="flex gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => openEdit(u)} className="p-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100"><Edit size={13} /></button>
                        <button onClick={() => setDeleteId(u.id)} className="p-1.5 bg-red-50 text-red-500 rounded-lg hover:bg-red-100"><Trash2 size={13} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setModalOpen(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-black text-gray-900">{editId ? 'Edit User' : 'Tambah User'}</h2>
              <button onClick={() => setModalOpen(false)} className="p-1.5 rounded-lg hover:bg-gray-100"><X size={18} /></button>
            </div>
            <div className="space-y-3">
              {[
                { label: 'Nama *', key: 'name', type: 'text', placeholder: 'Nama lengkap' },
                { label: 'Email *', key: 'email', type: 'email', placeholder: 'user@email.com' },
                { label: editId ? 'Password Baru (kosongkan jika tidak diubah)' : 'Password *', key: 'password', type: 'password', placeholder: '••••••••' },
              ].map(f => (
                <div key={f.key}>
                  <label className="block text-xs font-bold text-gray-700 mb-1">{f.label}</label>
                  <input type={f.type} value={form[f.key] || ''} onChange={e => setForm((p: any) => ({ ...p, [f.key]: e.target.value }))}
                    placeholder={f.placeholder}
                    className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              ))}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Role *</label>
                <select value={form.role} onChange={e => setForm((p: any) => ({ ...p, role: e.target.value }))}
                  className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500">
                  {['OWNER', 'ADMIN', 'WAREHOUSE', 'SALES', 'DRIVER'].map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setModalOpen(false)} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-bold text-gray-600 hover:bg-gray-50">Batal</button>
              <button onClick={handleSave} disabled={saving} className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 disabled:opacity-50">
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
            <h2 className="text-lg font-black text-gray-900 mb-2">Hapus User?</h2>
            <p className="text-sm text-gray-500 mb-6">Aksi ini tidak dapat dibatalkan.</p>
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
