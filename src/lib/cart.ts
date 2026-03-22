import { Product, CartItem } from './types';

// No unused imports needed here


// Fungsi untuk mengambil keranjang dari localStorage
export const getCart = (): CartItem[] => {
  if (typeof window !== 'undefined') {
    const data = localStorage.getItem('atayatoko-cart');
    return data ? JSON.parse(data) : [];
  }
  return [];
};

// Fungsi untuk menyimpan keranjang ke localStorage
export const saveCart = (cart: CartItem[]): void => {
  if (typeof window !== 'undefined') {
    localStorage.setItem('atayatoko-cart', JSON.stringify(cart));
  }
};

// Fungsi untuk menambahkan item ke keranjang
export const addToCart = (product: Product): void => {
  const cart = getCart();
  const existingItem = cart.find(item => item.id === product.id);

  if (existingItem) {
    existingItem.quantity += 1;
  } else {
    cart.push({ ...product, quantity: 1 });
  }

  saveCart(cart);
};

// Fungsi untuk memperbarui kuantitas
export const updateQuantity = (id: string, quantity: number): void => {
  const cart = getCart();
  const updatedCart = cart
    .map(item => item.id === id ? { ...item, quantity } : item)
    .filter(item => item.quantity > 0);

  saveCart(updatedCart);
};

// Fungsi untuk menghapus item
export const removeItem = (id: string): void => {
  const cart = getCart().filter(item => item.id !== id);
  saveCart(cart);
};

// ✅ Fungsi Cerdas: Menghitung total harga dengan logika Grosir
// Jika jumlah barang >= Min_Grosir, gunakan harga Grosir, jika tidak gunakan harga Ecer
export const getItemPrice = (item: CartItem): number => {
  if (item.promoType === 'TEBUS_MURAH') return 10000;

  const contains = Math.max(1, Math.floor(Number(item.unitContains || 1)));
  const baseQty = Math.max(1, Math.floor(Number(item.quantity || 0))) * contains;

  const baseEcer = Number(item.price ?? item.Ecer ?? 0);
  const grosirPrice = Number(item.wholesalePrice ?? item.Grosir ?? 0);
  const minGrosirQty = Number(item.minWholesale ?? item.Min_Grosir ?? (item as any).minWholesaleQty ?? 0);

  const baseUnitPrice = grosirPrice > 0 && minGrosirQty > 1 && baseQty >= minGrosirQty ? grosirPrice : baseEcer;
  const unitPrice = item.unitPrice != null ? Number(item.unitPrice) : baseUnitPrice * contains;
  return unitPrice;
};

// 💡 FITUR BARU: Analisis Psikologis Grosir
// Menghitung berapa lagi item yang harus dibeli untuk mendapat harga grosir
export const getWholesaleUpsellInfo = (item: CartItem): {
  isEligible: boolean;
  qtyNeeded: number;
  potentialSavings: number;
  message: string;
} | null => {
  const contains = Math.max(1, Math.floor(Number(item.unitContains || 1)));
  const baseQty = Math.max(1, Math.floor(Number(item.quantity || 0))) * contains;
  
  const baseEcer = Number(item.price ?? item.Ecer ?? 0);
  const grosirPrice = Number(item.wholesalePrice ?? item.Grosir ?? 0);
  const minGrosirQty = Number(item.minWholesale ?? item.Min_Grosir ?? (item as any).minWholesaleQty ?? 0);

  // Jika produk tidak punya setting grosir yang valid, lewati
  if (grosirPrice <= 0 || minGrosirQty <= 1) return null;

  // Jika sudah mencapai grosir
  if (baseQty >= minGrosirQty) {
    const totalSavings = (baseEcer - grosirPrice) * baseQty;
    return {
      isEligible: true,
      qtyNeeded: 0,
      potentialSavings: totalSavings,
      message: `🎉 Harga Grosir Aktif! Anda hemat Rp${totalSavings.toLocaleString('id-ID')}`
    };
  }

  // Jika belum mencapai grosir, hitung kekurangannya
  const qtyNeeded = minGrosirQty - baseQty;
  
  // Tampilkan pesan upsell jika pembeli sudah memasukkan minimal separuh dari target grosir
  // (misal target 10, dia beli 5. Kita push agar dia nambah 5 lagi)
  if (baseQty >= (minGrosirQty / 2)) {
    const savingsPerItem = baseEcer - grosirPrice;
    const totalPotentialSavings = savingsPerItem * minGrosirQty;
    
    return {
      isEligible: false,
      qtyNeeded: Math.ceil(qtyNeeded / contains), // Disesuaikan dengan unit yang dia pilih (misal BOX/PCS)
      potentialSavings: totalPotentialSavings,
      message: `Tanggung! Tambah ${Math.ceil(qtyNeeded / contains)} lagi untuk dapat Harga Grosir. Hemat Rp${totalPotentialSavings.toLocaleString('id-ID')}!`
    };
  }

  return null;
};

export const getTotalPrice = (cart: CartItem[]): number => {
  return cart.reduce((total, item) => total + getItemPrice(item) * item.quantity, 0);
};

export const getTotalItems = (cart: CartItem[]): number => {
  return cart.reduce((total, item) => total + item.quantity, 0);
};

// Fungsi tambahan untuk membersihkan keranjang setelah checkout
export const clearCart = (): void => {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('atayatoko-cart');
  }
};
