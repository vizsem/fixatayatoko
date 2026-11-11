import { getProducts } from '@/lib/actions/product.actions';
import { sbGetDocs, sbGetDoc } from '@/lib/supabase-helpers';
import { toPlainRow, toPlainRows } from '@/lib/db-schema';
import { Product, Promotion, Banner, SystemSettings, Category } from '@/lib/types';
import { formatProductName } from '@/lib/format';
import HomeClient from '@/components/home/HomeClient';

// Enable Incremental Static Regeneration (SSG / SSR caching every 60s)
export const revalidate = 60;

export default async function HomePage() {
  try {
    const [productsData, promoSnap, bannerSnap, sysSnap, whSnap, catSnap] = await Promise.all([
      getProducts({ isActive: true, orderByField: 'name', limit: 60 }),
      sbGetDocs({ table: 'promotions' }),
      sbGetDocs({ table: 'banners' }),
      sbGetDoc('settings', 'system'),
      sbGetDocs({ table: 'warehouses' }),
      sbGetDocs({ table: 'categories' }),
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
      name: formatProductName(p.name || 'Produk'),
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
      isPreOrder: Boolean(p.isPreOrder || p.raw_data?.isPreOrder),
      poLeadTimeDays: Number(p.poLeadTimeDays || p.raw_data?.poLeadTimeDays || 3),
      poNotes: p.poNotes || p.raw_data?.poNotes || '',
      raw_data: p.raw_data,
    }));

    // Set nama kategori dari produk aktif
    const productCategoryNames = new Set(mappedProducts.map((p) => p.category));

    // Ambil kategori dari DB, filter hanya yang show_on_homepage dan punya produk aktif
    const dbCategories: Category[] = catSnap.docs.map((doc) => {
      const data = doc.data();
      const raw = data.raw_data || {};
      return {
        id: doc.id,
        name: data.name || raw.name || 'Kategori',
        slug: data.slug || raw.slug || (data.name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        sort_order: raw.sort_order ?? 999,
        show_on_homepage: raw.show_on_homepage !== false,
        icon: raw.icon || '📦',
      };
    });

    // Filter: hanya yang show_on_homepage=true DAN ada produk aktif, sort by sort_order
    const categories: Category[] = dbCategories
      .filter((c) => c.show_on_homepage && productCategoryNames.has(c.name))
      .sort((a, b) => (a.sort_order ?? 999) - (b.sort_order ?? 999) || a.name.localeCompare(b.name));

    // Fallback: jika tidak ada kategori dari DB, generate dari produk
    const finalCategories: Category[] = categories.length > 0
      ? categories
      : Array.from(productCategoryNames).map((name, i) => ({
          id: `cat-${i}`,
          name,
          slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        }));

    return (
      <HomeClient
        initialProducts={JSON.parse(JSON.stringify(mappedProducts))}
        initialBanners={JSON.parse(JSON.stringify(banners))}
        initialPromos={JSON.parse(JSON.stringify(activePromos))}
        initialSettings={JSON.parse(JSON.stringify(systemSettings))}
        initialWarehouses={JSON.parse(JSON.stringify(warehouses))}
        initialCategories={JSON.parse(JSON.stringify(finalCategories))}
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
