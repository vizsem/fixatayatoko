// src/app/(admin)/users/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  where
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { 
  Users, 
  Shield,
  Mail,
  Phone,
  UserCheck,
  UserX,
  User,
  AlertTriangle
} from 'lucide-react';

type UserDoc = {
  id: string;
  email: string;
  name: string;
  phone?: string;
  role: 'admin' | 'cashier' | 'user';
  createdAt: string;
};

export default function AdminUsers() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<UserDoc[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<string | null>(null);

  // Proteksi: hanya admin yang bisa akses
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push('/profil/login');
        return;
      }

      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (!userDoc.exists() || userDoc.data()?.role !== 'admin') {
        alert('Akses ditolak! Anda bukan admin.');
        router.push('/profil');
        return;
      }

      setCurrentUser(user.uid);
      await fetchUsers();
      setLoading(false);
    });
    return () => unsubscribe();
  }, [router]);

  const fetchUsers = async () => {
    try {
      const q = query(collection(db, 'users'));
      const querySnapshot = await getDocs(q);
      const userList: UserDoc[] = [];
      
      querySnapshot.docs.forEach((doc) => {
        const data = doc.data();
        userList.push({
          id: doc.id,
          email: data.email || '',
          name: data.name || '–',
          phone: data.phone,
          role: data.role || 'user',
          createdAt: data.createdAt || ''
        });
      });
      
      setUsers(userList);
      setError(null);
    } catch (err) {
      console.error('Gagal memuat pengguna:', err);
      setError('Gagal memuat daftar pengguna.');
    }
  };

  const handleUpdateRole = async (userId: string, newRole: 'admin' | 'cashier' | 'user') => {
    if (userId === currentUser) {
      alert('Anda tidak bisa mengubah role diri sendiri.');
      return;
    }
    
    if (newRole === 'admin' && !confirm('Yakin memberikan akses admin?')) {
      return;
    }

    try {
      await updateDoc(doc(db, 'users', userId), { role: newRole });
      setUsers(users.map(u => u.id === userId ? { ...u, role: newRole } : u));
    } catch (err) {
      console.error('Gagal memperbarui role:', err);
      alert('Gagal memperbarui role pengguna.');
    }
  };

  const handleDeleteUser = async (userId: string, userName: string) => {
    if (userId === currentUser) {
      alert('Anda tidak bisa menghapus akun sendiri.');
      return;
    }
    
    if (!confirm(`Hapus pengguna "${userName}"? Tindakan ini tidak bisa dikembalikan.`)) {
      return;
    }

    try {
      // Hapus dari Firestore
      await deleteDoc(doc(db, 'users', userId));
      
      // Catatan: Firebase Auth tidak dihapus otomatis — opsional jika perlu
      setUsers(users.filter(u => u.id !== userId));
    } catch (err) {
      console.error('Gagal menghapus pengguna:', err);
      alert('Gagal menghapus pengguna.');
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin': return 'bg-red-100 text-red-800';
      case 'cashier': return 'bg-blue-100 text-blue-800';
      case 'user': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'admin': return <Shield className="text-red-600" size={16} />;
      case 'cashier': return <UserCheck className="text-blue-600" size={16} />;
      case 'user': return <User className="text-gray-600" size={16} />;
      default: return <User className="text-gray-600" size={16} />;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
          <p className="mt-4 text-black">Memuat data pengguna...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <Users className="text-black" size={28} />
          <h1 className="text-2xl font-bold text-black">Manajemen Pengguna & Role</h1>
        </div>
        <p className="text-black">Atur akses dan peran pengguna sistem ATAYATOKO2</p>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-lg border border-red-200">
          {error}
        </div>
      )}

      {/* Ringkasan Role */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white p-4 rounded-lg shadow border border-gray-200">
          <div className="flex items-center">
            <Shield className="text-red-600 mr-2" size={24} />
            <div>
              <p className="text-sm text-black">Admin</p>
              <p className="font-bold text-black">
                {users.filter(u => u.role === 'admin').length}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow border border-gray-200">
          <div className="flex items-center">
            <UserCheck className="text-blue-600 mr-2" size={24} />
            <div>
              <p className="text-sm text-black">Kasir</p>
              <p className="font-bold text-black">
                {users.filter(u => u.role === 'cashier').length}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow border border-gray-200">
          <div className="flex items-center">
            <User className="text-gray-600 mr-2" size={24} />
            <div>
              <p className="text-sm text-black">Pelanggan</p>
              <p className="font-bold text-black">
                {users.filter(u => u.role === 'user').length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabel Pengguna */}
      <div className="bg-white shadow rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-black uppercase tracking-wider">
                  Pengguna
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-black uppercase tracking-wider">
                  Kontak
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-black uppercase tracking-wider">
                  Role
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-black uppercase tracking-wider">
                  Aksi
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {users.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-black">
                    <Users className="mx-auto h-10 w-10 text-gray-400 mb-3" />
                    <p>Belum ada pengguna terdaftar</p>
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="font-medium text-black">{user.name}</div>
                      <div className="text-sm text-black">{user.email}</div>
                      <div className="text-xs text-black mt-1">
                        {new Date(user.createdAt).toLocaleDateString('id-ID')}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-black">
                      {user.phone ? (
                        <div className="flex items-center gap-1">
                          <Phone size={14} className="text-gray-500" />
                          {user.phone}
                        </div>
                      ) : (
                        <span className="text-gray-500">–</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full flex items-center gap-1 ${getRoleColor(user.role)}`}>
                        {getRoleIcon(user.role)}
                        {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-black">
                      {user.id !== currentUser && (
                        <div className="flex items-center gap-2">
                          {/* Ubah Role */}
                          <select
                            value={user.role}
                            onChange={(e) => handleUpdateRole(user.id, e.target.value as any)}
                            className="text-sm border border-gray-300 rounded px-2 py-1"
                          >
                            <option value="admin">Admin</option>
                            <option value="cashier">Kasir</option>
                            <option value="user">Pelanggan</option>
                          </select>
                          
                          {/* Hapus */}
                          <button
                            onClick={() => handleDeleteUser(user.id, user.name)}
                            className="text-red-600 hover:text-red-800"
                            title="Hapus Pengguna"
                          >
                            <UserX size={16} />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Catatan Keamanan */}
      <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
        <div className="flex items-start gap-2">
          <AlertTriangle size={20} className="text-yellow-600 mt-0.5 flex-shrink-0" />
          <div className="text-black">
            <p className="font-medium">Catatan Keamanan:</p>
            <ul className="list-disc list-inside text-sm mt-1 space-y-1">
              <li>Hanya pengguna dengan role <strong>Admin</strong> yang bisa mengakses halaman ini</li>
              <li>Anda tidak bisa mengubah role atau menghapus akun Anda sendiri</li>
              <li>Pemberian role <strong>Admin</strong> memberikan akses penuh ke seluruh sistem</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}