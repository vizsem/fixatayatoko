'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import notify from '@/lib/notify';

import { auth, getDoc, onAuthStateChanged } from '@/lib/firebase';
type AllowedRole = 'admin' | 'cashier' | 'employee';

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
  const { allowedRoles = ['admin'], redirectOnFail = '/profil/login' } = options || {};
  const router = useRouter();

  const [adminId, setAdminId] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
          router.push(redirectOnFail);
          setAuthLoading(false);
          return;
        }

        const userRole = user.app_metadata?.role as string | undefined;

        if (!userRole || !allowedRoles.includes(userRole as AllowedRole)) {
          notify.aksesDitolakAdmin();
          router.push('/profil');
          setAuthLoading(false);
          return;
        }

        setAdminId(user.id);
        setRole(userRole);
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
      const userRole = session.user.app_metadata?.role as string | undefined;
      if (!userRole || !allowedRoles.includes(userRole as AllowedRole)) {
        notify.aksesDitolakAdmin();
        router.push('/profil');
        return;
      }
      setAdminId(session.user.id);
      setRole(userRole);
    });

    return () => subscription.unsubscribe();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { adminId, role, authLoading };
}
