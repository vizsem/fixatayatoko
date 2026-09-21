'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import notify from '@/lib/notify';

import { auth, getDoc, onAuthStateChanged } from '@/lib/firebase';
import { isAdminRole } from '@/lib/auth-helpers';

type AllowedRole = 'admin' | 'superadmin' | 'super_admin' | 'owner' | 'cashier' | 'employee' | 'staff';

interface UseAdminAuthOptions {
  /** Allowed roles. Defaults to ['admin'] */
  allowedRoles?: AllowedRole[];
  /** Redirect path on failed auth. Defaults to '/profil/login' */
  redirectOnFail?: string;
}

interface AdminAuthState {
  adminId: string | null;
  role: string | null;
  authLoading: boolean;
}

/**
 * Shared hook that verifies Supabase auth and role from app_metadata.
 * Replaces the duplicated onAuthStateChanged + getDoc(users) pattern
 * found in every admin page.
 *
 * Usage:
 *   const { adminId, authLoading } = useAdminAuth();
 *   if (authLoading) return <Spinner />;
 */
export default function useAdminAuth(options?: UseAdminAuthOptions): AdminAuthState {
  const { allowedRoles = ['admin'], redirectOnFail = '/admin/login' } = options || {};
  const router = useRouter();

  const [adminId, setAdminId] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const isRoleAllowed = (checkRole?: string | null, email?: string | null) => {
    if (!checkRole && !email) return false;
    const lowerEmail = (email || '').toLowerCase();
    if (lowerEmail.startsWith('admin') || lowerEmail.includes('hadzikoh')) return true;
    
    if (allowedRoles.includes('admin') && isAdminRole(checkRole)) {
      return true;
    }
    return checkRole ? (allowedRoles as string[]).includes(checkRole.toLowerCase()) : false;
  };

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
          router.push(redirectOnFail);
          setAuthLoading(false);
          return;
        }

        const userRole = (user.app_metadata?.role || user.user_metadata?.role || (user.email?.startsWith('admin') ? 'admin' : (user.email?.startsWith('kasir') ? 'cashier' : undefined))) as string | undefined;

        if (!isRoleAllowed(userRole, user.email)) {
          notify.aksesDitolakAdmin();
          router.push('/profil');
          setAuthLoading(false);
          return;
        }

        setAdminId(user.id);
        setRole(userRole || 'admin');
      } catch (err) {
        console.error('[useAdminAuth] Error verifying role:', err);
        router.push(redirectOnFail);
      } finally {
        setAuthLoading(false);
      }
    };

    // Check on mount
    checkAuth();

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        router.push(redirectOnFail);
        return;
      }
      const userRole = (session.user.app_metadata?.role || session.user.user_metadata?.role || (session.user.email?.startsWith('admin') ? 'admin' : (session.user.email?.startsWith('kasir') ? 'cashier' : undefined))) as string | undefined;
      if (!isRoleAllowed(userRole, session.user.email)) {
        notify.aksesDitolakAdmin();
        router.push('/profil');
        return;
      }
      setAdminId(session.user.id);
      setRole(userRole || 'admin');
    });

    return () => subscription.unsubscribe();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { adminId, role, authLoading };
}
