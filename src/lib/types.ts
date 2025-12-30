// src/lib/types.ts

// ========== PRODUK ==========
export interface Product {
  id?: string; // opsional karena Firestore generate otomatis
  name: string;
  price: number; // harga ecer
  wholesalePrice: number; // harga grosir
  stock: number;
  category: string;
  unit: string; // 'kg', 'pcs', 'dus', dll
  barcode?: string;
  image?: string;
  description?: string;
  minWholesaleQty?: number; // minimal beli grosir
  createdAt?: string;
  updatedAt?: string;
}

// ========== PESANAN ==========
export interface OrderItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  unit: string;
}

export interface Order {
  id?: string;
  customerId: string;
  customerName?: string;
  customerPhone?: string;
  items: OrderItem[];
  total: number;
  paymentMethod: 'CASH' | 'COD' | 'QRIS' | 'TRANSFER' | 'CREDIT';
  paymentDetails?: {
    bank?: string;
    proof?: string; // URL bukti transfer
    paid?: boolean; // untuk CREDIT
    dueDate?: string; // untuk CREDIT
  };
  deliveryMethod: 'AMBIL_DI_TOKO' | 'KURIR_TOKO' | 'OJOL';
  deliveryDetails?: {
    courierName?: string;
    courierPhone?: string;
    ojolOrderNumber?: string;
    address?: string;
  };
  status: 'MENUNGGU' | 'DIPROSES' | 'DIKIRIM' | 'SELESAI' | 'DIBATALKAN';
  notes?: string;
  createdAt: string;
  updatedAt?: string;
}

// ========== PELANGGAN ==========
export interface Customer {
  id?: string;
  name: string;
  phone: string;
  address?: string;
  creditLimit?: number; // 0 = tidak boleh tempo
  tags: ('GROSIR' | 'TEMPO' | 'LANGGANAN' | string)[];
  createdAt?: string;
  updatedAt?: string;
}

// ========== USER (untuk admin/kasir) ==========
export interface User {
  id?: string;
  name: string;
  email: string;
  role: 'admin' | 'kasir';
  phone?: string;
  createdAt?: string;
}