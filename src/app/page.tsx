import { getProducts } from '@/lib/actions/product.actions';
import { sbGetDocs, sbGetDoc } from '@/lib/supabase-helpers';
import { toPlainRow, toPlainRows } from '@/lib/db-schema';
import { Product, Promotion, Banner, SystemSettings, Category } from '@/lib/types';
import HomeClient from '@/components/home/HomeClient';

// Enable Incremental Static Regeneration (SSG / SSR caching every 60s)
export const revalidate = 60;

export default async function HomePage() {
  try {
    const [productsData, promoSnap, bannerSnap, sysSnap, whSnap] = await Promise.all([
      getProducts({ isActive: true, orderByField: 'name', limit: 60 }),
      sbGetDocs({ table: 'promotions' }),
      sbGetDocs({ table: 'banners' }),
      sbGetDoc('settings', 'system'),
      sbGetDocs({ table: 'warehouses' }),
    ]);

    const now = new Date();
    const rawPromos = promoSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    const plainPromos = toPlainRows(rawPromos) as unknown as Promotion[];
    const activePromos = plainPromos.filter(
      (p) => p.isActive && new Date(p.startDate) <= now && new Date(p.endDate) >= now
    );

    const rawBanners = bannerSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
    const plainBanners = toPlainRows(rawBanners) as unknown as Banner[];
    const banners = plainBanners.filter((b) => b.isActive);

    const rawWarehouses = whSnap.docs.map((d) => ({
      id: d.id,
      name: String(d.data().name || ''),
    }));
    const warehouses = toPlainRows(rawWarehouses) as unknown as { id: string; name: string }[];

    const systemSettings = sysSnap.exists()
      ? (toPlainRow(sysSnap.data()) as unknown as SystemSettings)
      : null;

    const initialWarehouseId = systemSettings?.displayWarehouseId || warehouses[0]?.id || '';

    const mappedProducts: Product[] = (productsData || []).map((p: any) => ({
      id: p.id,
      name: p.name || 'Produk',
      price: Number(p.priceEcer || 0),
      wholesalePrice: Number(p.priceGrosir || p.priceEcer || 0),
      minWholesale: Number(p.minWholesaleQty || 1),
      stock: systemSettings?.displayWarehouseId
        ? Number(p.stockByWarehouse?.[systemSettings.displayWarehouseId] || 0)
        : Number(p.stock || 0),
      unit: (p.unit || 'PCS').toString().toUpperCase(),
      category: p.category || 'Umum',
      image: p.imageUrl || '/logo-atayatoko.png',
      units: p.units || [],
    }));

    const categories: Category[] = Array.from(new Set(mappedProducts.map((p) => p.category))).map(
      (name, i) => ({
        id: `cat-${i}`,
        name,
        slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      })
    );

    return (
      <HomeClient
        initialProducts={JSON.parse(JSON.stringify(mappedProducts))}
        initialBanners={JSON.parse(JSON.stringify(banners))}
        initialPromos={JSON.parse(JSON.stringify(activePromos))}
        initialSettings={JSON.parse(JSON.stringify(systemSettings))}
        initialWarehouses={JSON.parse(JSON.stringify(warehouses))}
        initialCategories={JSON.parse(JSON.stringify(categories))}
        initialWarehouseId={initialWarehouseId}
      />
    );
  } catch (err) {
    console.error('Error rendering homepage SSR/SSG:', err);
    return (
      <HomeClient
        initialProducts={[]}
        initialBanners={[]}
        initialPromos={[]}
        initialSettings={null}
        initialWarehouses={[]}
        initialCategories={[]}
        initialWarehouseId=""
      />
    );
  }
}
