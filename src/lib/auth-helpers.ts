export const ADMIN_ROLES = ['admin', 'superadmin', 'super_admin', 'owner', 'super-admin'];

export function isAdminRole(role?: string | null): boolean {
  if (!role) return false;
  const normalized = role.trim().toLowerCase().replace(/[\s-]+/g, '_');
  return ADMIN_ROLES.some(r => r.replace(/[\s-]+/g, '_') === normalized);
}

export function isStaffOrAdmin(role?: string | null): boolean {
  if (!role) return false;
  if (isAdminRole(role)) return true;
  const normalized = role.trim().toLowerCase().replace(/[\s-]+/g, '_');
  return [
    'cashier',
    'kasir',
    'employee',
    'staff',
    'sales',
    'warehouse',
    'driver',
    // Peran yang sudah dimodelkan aplikasi (lihat `UserRole` di
    // admin/employees): HR mengelola kepegawaian, supervisor mengawasi
    // operasional. Keduanya butuh akses data internal, bukan akses publik.
    'hr',
    'supervisor',
  ].includes(normalized);
}

export function isOperationalUser(user: any, profileRole?: string | null): boolean {
  if (!user && !profileRole) return false;

  // PERINGATAN KEAMANAN: awalan email dan `user_metadata` SENGAJA tidak dipakai.
  // Pengguna dapat menulis `user_metadata.role` sendiri, dan email bisa
  // didaftarkan dengan awalan apa pun. Keduanya pernah menjadi jalan masuk
  // tanpa izin ke portal admin.
  const candidateRoles = [
    profileRole,
    user?.role,
    user?.app_metadata?.role,
  ];

  return candidateRoles.some(r => isStaffOrAdmin(r));
}

export function isAuthorizedAdmin(user: any, userDocData?: any): boolean {
  if (!user) return false;

  // Hanya `userDocData` (dari `public.users`), `app_metadata` (hanya bisa ditulis
  // service role), dan `user.role` yang sudah dibersihkan oleh adaptor.
  // `user_metadata` dan awalan email tidak dipakai karena dapat dikendalikan
  // sepenuhnya oleh pengguna.
  const candidateRoles = [
    userDocData?.role,
    user.app_metadata?.role,
    user.role,
  ];

  return candidateRoles.some(r => isAdminRole(r));
}

