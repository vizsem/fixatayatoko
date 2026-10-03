import { supabase } from '@/lib/supabase';
import { Product, NotificationItem } from '@/lib/types';

export async function fetchUserHomeData(userId: string) {
  try {
    const [userRes, ordersRes, notifRes] = await Promise.all([
      supabase.from('users').select('*').eq('id', userId).maybeSingle(),
      supabase
        .from('orders')
        .select('items')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(5),
      supabase
        .from('notifications')
        .select('*')
        .in('user_id', [userId, 'all'])
        .order('created_at', { ascending: false })
        .limit(30),
    ]);

    const userData = userRes.data;
    const userName: string | null =
      userData?.full_name || userData?.name || (userData?.raw_data as any)?.name || null;

    // Kumpulkan ID produk unik dari riwayat pesanan untuk rekomendasi beli ulang
    const allItems: any[] = (ordersRes.data || []).flatMap((o: any) => o.items || []);
    const uniqueItemIds: string[] = Array.from(
      new Set(allItems.map((i: any) => i.id || i.productId).filter(Boolean))
    ).slice(0, 10) as string[];

    let repurchaseProducts: Product[] = [];
    if (uniqueItemIds.length > 0) {
      try {
        const { data: products } = await supabase
          .from('products')
          .select('id,name,Nama,price,Ecer,wholesalePrice,Grosir,minWholesale,Min_Grosir,stock,Stok,unit,Satuan,category,Kategori,image,Link_Foto,image_url,Status')
          .in('id', uniqueItemIds)
          .eq('Status', 1);

        repurchaseProducts = (products || []).map((data: any) => ({
          id: data.id,
          name: String(data.name || data.Nama || 'Produk'),
          price: Number(data.price || data.Ecer) || 0,
          wholesalePrice: Number(data.wholesalePrice || data.Grosir) || 0,
          minWholesale: Number(data.minWholesale || data.Min_Grosir || 1),
          stock: Number(data.stock || data.Stok || 0),
          unit: String(data.unit || data.Satuan || 'pcs'),
          category: String(data.category || data.Kategori || 'Umum'),
          image: String(data.image_url || data.image || data.Link_Foto || '/logo-atayatoko.png'),
        })) as Product[];
      } catch (err) {
        console.error('Error fetching repurchase products:', err);
      }
    }

    const notifications: NotificationItem[] = (notifRes.data || []).map((row: any) => ({
      id: row.id,
      ...(row.raw_data || row),
      created_at: row.created_at,
    }));

    return { userName, repurchaseProducts, notifications };
  } catch (err) {
    console.error('Error fetching user home data:', err);
    return { userName: null, repurchaseProducts: [], notifications: [] };
  }
}
