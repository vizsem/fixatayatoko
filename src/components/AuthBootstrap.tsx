'use client';

import { useEffect } from 'react';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged, signInAnonymously } from 'firebase/auth';

export default function AuthBootstrap() {
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          localStorage.setItem('temp_user_id', user.uid);
        } catch {}
        return;
      }

      try {
        const cred = await signInAnonymously(auth);
        try {
          localStorage.setItem('temp_user_id', cred.user.uid);
        } catch {}
      } catch {}
    });

    return () => unsubscribe();
  }, []);

  return null;
}

