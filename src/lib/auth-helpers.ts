export const ADMIN_ROLES = ['admin', 'superadmin', 'super_admin', 'owner', 'super-admin'];

export function isAdminRole(role?: string | null): boolean {
  if (!role) return false;
  const normalized = role.trim().toLowerCase().replace(/[\s-]+/g, '_');
  return ADMIN_ROLES.some(r => r.replace(/[\s-]+/g, '_') === normalized);
}

export function isStaffOrAdmin(role?: string | null): boolean {
  if (!role) return false;
  if (isAdminRole(role)) return true;
  const normalized = role.trim().toLowerCase();
  return ['cashier', 'kasir', 'employee', 'staff', 'sales', 'warehouse'].includes(normalized);
}

export function isAuthorizedAdmin(user: any, userDocData?: any): boolean {
  if (!user) return false;

  // Check email shortcut
  const email = (user.email || '').toLowerCase();
  if (email.startsWith('admin') || email.includes('hadzikoh')) {
    return true;
  }

  // Check roles across all metadata and document sources
  const candidateRoles = [
    user.role,
    user.app_metadata?.role,
    user.user_metadata?.role,
    userDocData?.role
  ];

  return candidateRoles.some(r => isAdminRole(r));
}
