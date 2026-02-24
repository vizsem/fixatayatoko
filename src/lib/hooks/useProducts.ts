import { useEffect, useState } from 'react';
import { db } from '@/lib/firebase';
import { collection, onSnapshot } from 'firebase/firestore';
import { normalizeProduct, type NormalizedProduct } from '@/lib/normalize';

export default function useProducts() {
  const [products, setProducts] = useState<NormalizedProduct[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'products'), (snap) => {
      setProducts(snap.docs.map((d) => normalizeProduct(d.id, d.data() as Record<string, unknown>)));
      setLoading(false);
    });
    return () => unsub();
  }, []);

  return { products, loading };
}
