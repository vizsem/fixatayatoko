import { useEffect, useMemo, useState } from 'react';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, getDocs, orderBy, query, where, type QueryConstraint } from 'firebase/firestore';
import { normalizeProduct, type NormalizedProduct } from '@/lib/normalize';

export type ProductQueryOptions = {
  isActive?: boolean;
  category?: string;
  warehouseId?: string;
  orderByField?: 'name' | 'updatedAt' | 'sku' | 'createdAt';
  orderDirection?: 'asc' | 'desc';
  realtime?: boolean;
};

export default function useProducts(options?: ProductQueryOptions) {
  const [products, setProducts] = useState<NormalizedProduct[]>([]);
  const [loading, setLoading] = useState(true);

  const isActive = options?.isActive;
  const category = options?.category;
  const warehouseId = options?.warehouseId;
  const orderByField = options?.orderByField;
  const orderDirection = options?.orderDirection;

  const realtime = options?.realtime ?? false;

  const qRef = useMemo(() => {
    const constraints: QueryConstraint[] = [];
    if (category) constraints.push(where('category', '==', category));
    if (warehouseId) constraints.push(where('warehouseId', '==', warehouseId));
    const field = orderByField || 'name';
    const dir = (orderDirection || 'asc') === 'desc' ? 'desc' : 'asc';
    constraints.push(orderBy(field, dir));
    return query(collection(db, 'products'), ...constraints);
  }, [category, warehouseId, orderByField, orderDirection]);

  useEffect(() => {
    if (realtime) {
      const unsub = onSnapshot(qRef, (snap) => {
        let data = snap.docs.map((d) => normalizeProduct(d.id, d.data() as Record<string, unknown>));
        if (isActive === true) data = data.filter(p => p.isActive);
        setProducts(data);
        setLoading(false);
      });
      return () => unsub();
    } else {
      let isMounted = true;
      getDocs(qRef).then((snap) => {
        if (!isMounted) return;
        let data = snap.docs.map((d) => normalizeProduct(d.id, d.data() as Record<string, unknown>));
        if (isActive === true) data = data.filter(p => p.isActive);
        setProducts(data);
        setLoading(false);
      }).catch(err => {
        console.error("useProducts getDocs error:", err);
        if (isMounted) setLoading(false);
      });
      return () => { isMounted = false; };
    }
  }, [qRef, isActive, realtime]);

  return { products, loading };
}
