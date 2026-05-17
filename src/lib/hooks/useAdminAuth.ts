'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import notify from '@/lib/notify';

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
 * Shared hook that verifies Firebase auth and Firestore role.
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
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push(redirectOnFail);
        setAuthLoading(false);
        return;
      }

      try {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        const userRole = userDoc.data()?.role as string | undefined;

        if (!userRole || !allowedRoles.includes(userRole as AllowedRole)) {
          notify.aksesDitolakAdmin();
          router.push('/profil');
          setAuthLoading(false);
          return;
        }

        setAdminId(user.uid);
        setRole(userRole);
      } catch (err) {
        console.error('[useAdminAuth] Error verifying role:', err);
        router.push(redirectOnFail);
      } finally {
        setAuthLoading(false);
      }
    });

    return () => unsub();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { adminId, role, authLoading };
}
