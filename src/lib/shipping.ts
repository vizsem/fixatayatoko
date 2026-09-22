// src/lib/shipping.ts

/**
 * Atayatoko Logistics & Delivery Engine
 * Koordinat Gudang Pusat: https://maps.app.goo.gl/WhdNdqYNLNKQVHWY9
 */

export type DeliveryZone = 'PICKUP' | 'RING1' | 'RING2' | 'RING3' | 'LUAR_KOTA';

export type DeliveryType = 'PICKUP' | 'KURIR_TOKO' | 'EKSPEDISI' | 'CARGO';

export interface DeliveryMethodConfig {
  id: string;
  name: string;
  type: DeliveryType;
  zone: DeliveryZone;
  cost: number;
  minSpendFree?: number;     // Syarat minimal belanja untuk dapat Gratis Ongkir
  radiusMaxKm?: number;      // Batas maksimal radius zona (km)
  radiusMinKm?: number;      // Batas minimal radius zona (km)
  description: string;
  estimatedTime: string;
  enabled: boolean;
  courierCode?: 'ATAYA' | 'JNE' | 'JNT' | 'SICEPAT' | 'CARGO' | 'INDAH';
  iconName?: string;
  isPopular?: boolean;
}

export interface WarehouseLocationConfig {
  name: string;
  latitude: number;
  longitude: number;
  address: string;
  mapsUrl: string;
  city: string;
  postalCode: string;
  phone: string;
}

// Koordinat Presisi Titik Gudang ATAYATOKO (Tamanan / Semen, Kediri)
export const ATAYATOKO_WAREHOUSE: WarehouseLocationConfig = {
  name: 'Gudang Pusat ATAYATOKO',
  latitude: -7.8338933,
  longitude: 111.9802823,
  address: 'Tamanan, Kec. Mojoroto / Semen, Kota Kediri, Jawa Timur 64116',
  mapsUrl: 'https://maps.app.goo.gl/WhdNdqYNLNKQVHWY9',
  city: 'Kediri',
  postalCode: '64116',
  phone: '0812-3456-7890',
};

// Metode Pengiriman Default Lengkap
export const DEFAULT_DELIVERY_METHODS: DeliveryMethodConfig[] = [
  {
    id: 'PICKUP',
    name: 'Ambil di Toko / Gudang',
    type: 'PICKUP',
    zone: 'PICKUP',
    cost: 0,
    minSpendFree: 0,
    description: 'Ambil langsung ke Gudang ATAYATOKO (Tamanan, Kediri)',
    estimatedTime: 'Siap dalam 1 jam',
    enabled: true,
    courierCode: 'ATAYA',
  },
  {
    id: 'KURIR_RING1',
    name: 'Kurir Toko Ring 1 (0 – 3 km)',
    type: 'KURIR_TOKO',
    zone: 'RING1',
    radiusMinKm: 0,
    radiusMaxKm: 3,
    cost: 5000,
    minSpendFree: 50000,
    description: 'Area Dekat Gudang / Dalam Kota (Gratis Min. Belanja Rp50.000)',
    estimatedTime: 'Hari yang sama (Same-Day)',
    enabled: true,
    courierCode: 'ATAYA',
    isPopular: true,
  },
  {
    id: 'KURIR_RING2',
    name: 'Kurir Toko Ring 2 (3 – 7 km)',
    type: 'KURIR_TOKO',
    zone: 'RING2',
    radiusMinKm: 3,
    radiusMaxKm: 7,
    cost: 8000,
    minSpendFree: 120000,
    description: 'Sekitar Kota Kediri & Kecamatan Sekitar (Gratis Min. Belanja Rp120.000)',
    estimatedTime: 'Pengiriman Kloter (Siang / Sore)',
    enabled: true,
    courierCode: 'ATAYA',
  },
  {
    id: 'KURIR_RING3',
    name: 'Kurir Toko Ring 3 (7 – 12 km / Grosir)',
    type: 'KURIR_TOKO',
    zone: 'RING3',
    radiusMinKm: 7,
    radiusMaxKm: 12,
    cost: 15000,
    minSpendFree: 300000,
    description: 'Pinggiran Kota / Luar Kecamatan (Gratis Min. Belanja Rp300.000)',
    estimatedTime: '1 – 2 Hari / Sesuai Rute Armada',
    enabled: true,
    courierCode: 'ATAYA',
  },
  {
    id: 'JNT_REG',
    name: 'J&T Express (Luar Kota)',
    type: 'EKSPEDISI',
    zone: 'LUAR_KOTA',
    cost: 12000,
    description: 'Layanan kirim paket reguler antar-kota / seluruh Indonesia',
    estimatedTime: '2 – 3 Hari Kerja',
    enabled: true,
    courierCode: 'JNT',
  },
  {
    id: 'JNE_REG',
    name: 'JNE Reguler (Luar Kota)',
    type: 'EKSPEDISI',
    zone: 'LUAR_KOTA',
    cost: 13000,
    description: 'Ekspedisi resmi terpercaya seluruh Indonesia',
    estimatedTime: '2 – 4 Hari Kerja',
    enabled: true,
    courierCode: 'JNE',
  },
  {
    id: 'CARGO_HEMAT',
    name: 'Kargo / JTR / Indah Cargo (Partai Besar)',
    type: 'CARGO',
    zone: 'LUAR_KOTA',
    cost: 35000,
    minSpendFree: 500000,
    description: 'Khusus pesanan bal-balan krupuk / grosir > 10 kg (Gratis Min. Rp500.000)',
    estimatedTime: '3 – 5 Hari Kerja',
    enabled: true,
    courierCode: 'CARGO',
    isPopular: true,
  },
];

/**
 * Hitung jarak lurus (km) menggunakan rumus Haversine
 */
export function calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Radius bumi dalam km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

/**
 * Kalkulasi ongkos kirim akhir berdasarkan subtotal belanja
 */
export function calculateDeliveryCost(
  method: DeliveryMethodConfig,
  subtotal: number
): {
  originalCost: number;
  finalCost: number;
  isFree: boolean;
  minSpendFree: number;
  remainingForFree: number;
  badgeText?: string;
} {
  const originalCost = method.cost;
  const minSpend = method.minSpendFree || 0;

  if (method.type === 'PICKUP' || originalCost === 0) {
    return {
      originalCost: 0,
      finalCost: 0,
      isFree: true,
      minSpendFree: 0,
      remainingForFree: 0,
      badgeText: 'GRATIS',
    };
  }

  // Jika ada syarat gratis ongkir dan subtotal memenuhi syarat
  if (minSpend > 0 && subtotal >= minSpend) {
    return {
      originalCost,
      finalCost: 0,
      isFree: true,
      minSpendFree: minSpend,
      remainingForFree: 0,
      badgeText: 'GRATIS ONGKIR',
    };
  }

  // Belum memenuhi syarat gratis
  const remainingForFree = minSpend > 0 ? Math.max(0, minSpend - subtotal) : 0;
  return {
    originalCost,
    finalCost: originalCost,
    isFree: false,
    minSpendFree: minSpend,
    remainingForFree,
    badgeText: remainingForFree > 0 ? `Tambah Rp${remainingForFree.toLocaleString('id-ID')} lagi Gratis` : undefined,
  };
}
