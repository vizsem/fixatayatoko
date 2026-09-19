import { useEffect, useState } from 'react';
import { getProducts, type ProductQueryOptions } from '../actions/product.actions';
import type { NormalizedProduct } from '../normalize';

export default function useProducts(options?: ProductQueryOptions) {
  const [products, setProducts] = useState<NormalizedProduct[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    getProducts(options)
      .then((data) => {
        if (!isMounted) return;
        setProducts(data as unknown as NormalizedProduct[]);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to load products via Supabase:", err);
        if (isMounted) setLoading(false);
      });

    return () => { isMounted = false; };
  }, [options?.category, options?.warehouseId, options?.orderByField, options?.orderDirection, options?.isActive, options?.search, options?.limit]);

  return { products, loading };
}
