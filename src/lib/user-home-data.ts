import { Product, NotificationItem } from '@/lib/types';
import { sbGetDoc } from '@/lib/supabase-helpers';
import { collection, db, getDocs, limit, orderBy, query, where } from '@/lib/firebase';

export async function fetchUserHomeData(userId: string) {
  try {
    const [userSnap, ordersSnap, notifSnap] = await Promise.all([
      sbGetDoc('users', userId, false),
      getDocs(query(
        collection(db, 'orders'),
        where('userId', '==', userId),
        orderBy('createdAt', 'desc'),
        limit(5)
      )).catch(() => ({ docs: [] })),
      getDocs(query(
        collection(db, 'notifications'),
        where('userId', 'in', [userId, 'all']),
        orderBy('createdAt', 'desc'),
        limit(30)
      )).catch(() => ({ docs: [] })),
    ]);

    const userName = userSnap.exists() ? userSnap.data()?.name : null;

    // Repurchase products
    let repurchaseProducts: Product[] = [];
    const allItems = ordersSnap.docs.flatMap((d: any) => d.data().items || []);
    const uniqueItemIds = Array.from(new Set(allItems.map((i: any) => i.id))).slice(0, 10);

    if (uniqueItemIds.length > 0) {
      try {
        const pSnap = await getDocs(
          query(collection(db, 'products'), where('__name__', 'in', uniqueItemIds))
        );
        repurchaseProducts = pSnap.docs.map((doc: any) => {
          const data = { id: doc.id, ...doc.data() };
          return {
            id: data.id,
            name: String(data.name || data.Nama || 'Produk'),
            price: Number(data.price || data.Ecer) || 0,
            wholesalePrice: Number(data.wholesalePrice || data.Grosir) || 0,
            minWholesale: Number(data.minWholesale || data.Min_Grosir || 1),
            stock: Number(data.stock || data.Stok || 0),
            unit: String(data.unit || data.Satuan || 'pcs'),
            category: String(data.category || data.Kategori || 'Umum'),
            image: String(data.image || data.Link_Foto || '/logo-atayatoko.png'),
          } as Product;
        });
      } catch (err) {
        console.error('Error fetching repurchase products:', err);
      }
    }

    const notifications: NotificationItem[] = notifSnap.docs.map((d: any) => ({
      id: d.id,
      ...d.data(),
    }));

    return {
      userName,
      repurchaseProducts,
      notifications,
    };
  } catch (err) {
    console.error('Error fetching user home data:', err);
    return {
      userName: null,
      repurchaseProducts: [],
      notifications: [],
    };
  }
}
