import { useEffect, useMemo, useState } from 'react';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, orderBy, query, where, type QueryConstraint } from 'firebase/firestore';
import { normalizeProduct, type NormalizedProduct } from '@/lib/normalize';

export type ProductQueryOptions = {
  isActive?: boolean;
  category?: string;
  warehouseId?: string;
  orderByField?: 'name' | 'updatedAt' | 'sku';
  orderDirection?: 'asc' | 'desc';
};

export default function useProducts(options?: ProductQueryOptions) {
  const [products, setProducts] = useState<NormalizedProduct[]>([]);
  const [loading, setLoading] = useState(true);

  const category = options?.category;
  const warehouseId = options?.warehouseId;
  const orderByField = options?.orderByField;
  const orderDirection = options?.orderDirection;

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
    const unsub = onSnapshot(qRef, (snap) => {
      setProducts(snap.docs.map((d) => normalizeProduct(d.id, d.data() as Record<string, unknown>)));
      setLoading(false);
    });
    return () => unsub();
  }, [qRef]);

  return { products, loading };
}
