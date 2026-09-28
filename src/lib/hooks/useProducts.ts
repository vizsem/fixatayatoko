import { useEffect, useState } from 'react';
import { getProducts, type ProductQueryOptions } from '../actions/product.actions';
import type { NormalizedProduct } from '../normalize';
import { supabase } from '../supabase';

export default function useProducts(options?: ProductQueryOptions) {
  const [products, setProducts] = useState<NormalizedProduct[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const fetchLatest = () => {
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
    };

    setLoading(true);
    fetchLatest();

    const channel = supabase
      .channel(`products_realtime_${Math.random().toString(36).substring(2, 9)}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'products' },
        () => {
          fetchLatest();
        }
      )
      .subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(channel);
    };
  }, [options?.category, options?.warehouseId, options?.orderByField, options?.orderDirection, options?.isActive, options?.search, options?.limit]);

  return { products, loading };
}
