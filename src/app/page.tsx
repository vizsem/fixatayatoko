import { getProducts } from '@/lib/actions/product.actions';
import { sbGetDocs, sbGetDoc } from '@/lib/supabase-helpers';
import { toPlainRow, toPlainRows } from '@/lib/db-schema';
import { Product, Promotion, Banner, SystemSettings, Category } from '@/lib/types';
import { formatProductName, cleanCategoryName, toCategorySlug, EXCLUDED_CATEGORY_NAMES } from '@/lib/format';
import { supabaseAdmin } from '@/lib/supabase';
import HomeClient from '@/components/home/HomeClient';

// Enable Incremental Static Regeneration (SSG / SSR caching every 60s)
export const revalidate = 60;

export default async function HomePage() {
  try {
    const [productsData, promoSnap, bannerSnap, sysSnap, whSnap, catSnap, activeCatRes] = await Promise.all([
      getProducts({ isActive: true, orderByField: 'name', limit: 300 }),
      sbGetDocs({ table: 'promotions' }),
      sbGetDocs({ table: 'banners' }),
      sbGetDoc('settings', 'system'),
      sbGetDocs({ table: 'warehouses' }),
      sbGetDocs({ table: 'categories' }),
      supabaseAdmin.from('products').select('category, raw_data').eq('is_active', true),
    ]);

    const now = new Date();
    const rawPromos = promoSnap.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
    const plainPromos = toPlainRows(rawPromos) as unknown as Promotion[];
    const activePromos = plainPromos.filter(
      (p) => p.isActive && new Date(p.startDate) <= now && new Date(p.endDate) >= now
    );

    const rawBanners = bannerSnap.docs.map((d: any) => ({ id: d.id, ...d.data() }));
    const plainBanners = toPlainRows(rawBanners) as unknown as Banner[];
    const banners = plainBanners.filter((b) => b.isActive);

    const rawWarehouses = whSnap.docs.map((d: any) => ({
      id: d.id,
      name: String(d.data().name || ''),
    }));
    const warehouses = toPlainRows(rawWarehouses) as unknown as { id: string; name: string }[];

    const systemSettings = sysSnap.exists()
      ? (toPlainRow(sysSnap.data()) as unknown as SystemSettings)
      : null;

    const initialWarehouseId = systemSettings?.displayWarehouseId || warehouses[0]?.id || '';

    // 1. Kumpulkan seluruh kategori unik yang BENAR-BENAR ada produk berstatus AKTIF
    const activeCategoryMap = new Map<string, { cleanName: string; slug: string }>();
    for (const r of activeCatRes.data || []) {
      const raw = r.raw_data || {};
      const isArchived =
        raw.isActive === false ||
        raw.isActive === 'false' ||
        raw.status === 'ARCHIVED';
      if (isArchived) continue;

      const rawCat = (r.category || raw.Kategori || raw.kategori || raw.category || '').trim();
      if (!rawCat) continue;
      const clean = cleanCategoryName(rawCat);
      const normKey = clean.toLowerCase();
      if (EXCLUDED_CATEGORY_NAMES.has(normKey)) continue;

      if (!activeCategoryMap.has(normKey)) {
        activeCategoryMap.set(normKey, {
          cleanName: clean,
          slug: toCategorySlug(clean),
        });
      }
    }

    const mappedProducts: Product[] = (productsData || []).map((p: any) => {
      const rawCat = p.category || p.raw_data?.Kategori || p.raw_data?.category || 'Umum';
      const cleanCat = cleanCategoryName(rawCat);
      return {
        id: p.id,
        name: formatProductName(p.name || 'Produk'),
        price: Number(p.priceEcer || 0),
        wholesalePrice: Number(p.priceGrosir || p.priceEcer || 0),
        minWholesale: Number(p.minWholesaleQty || 1),
        stock: systemSettings?.displayWarehouseId
          ? Number(p.stockByWarehouse?.[systemSettings.displayWarehouseId] || 0)
          : Number(p.stock || 0),
        unit: (p.unit || 'PCS').toString().toUpperCase(),
        category: cleanCat,
        image: p.imageUrl || '/logo-atayatoko.png',
        units: p.units || [],
        isPreOrder: Boolean(p.isPreOrder || p.raw_data?.isPreOrder),
        poLeadTimeDays: Number(p.poLeadTimeDays || p.raw_data?.poLeadTimeDays || 3),
        poNotes: p.poNotes || p.raw_data?.poNotes || '',
        raw_data: p.raw_data,
      };
    });

    // 2. Bentuk daftar kategori: HANYA yang ada produk aktifnya
    const seenCatKeys = new Set<string>();
    const finalCategories: Category[] = [];

    // Prioritas 1: Kategori dari tabel master categories (bila memiliki icon/custom order)
    for (const doc of catSnap.docs) {
      const data = doc.data();
      const raw = data.raw_data || {};
      const catName = cleanCategoryName(data.name || raw.name || '');
      const normKey = catName.toLowerCase();
      if (!activeCategoryMap.has(normKey) || seenCatKeys.has(normKey)) continue;

      seenCatKeys.add(normKey);
      finalCategories.push({
        id: doc.id,
        name: catName,
        slug: toCategorySlug(catName),
        sort_order: raw.sort_order ?? 999,
        show_on_homepage: raw.show_on_homepage !== false,
        icon: raw.icon || '📦',
      });
    }

    // Prioritas 2: Kategori dari produk aktif yang belum ada di tabel categories
    for (const [normKey, info] of activeCategoryMap.entries()) {
      if (seenCatKeys.has(normKey)) continue;
      seenCatKeys.add(normKey);
      finalCategories.push({
        id: `cat-${normKey.replace(/[^a-z0-9]/g, '-')}`,
        name: info.cleanName,
        slug: info.slug,
        sort_order: 999,
        show_on_homepage: true,
        icon: '📦',
      });
    }

    finalCategories.sort((a, b) => (a.sort_order ?? 999) - (b.sort_order ?? 999) || a.name.localeCompare(b.name));

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
