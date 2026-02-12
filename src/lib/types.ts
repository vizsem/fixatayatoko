/**
 * Shared Type Definitions for AtayaToko
 */

export interface Product {
    id: string;         // ID dokumen Firestore
    name: string;       // Nama Produk (Primary)
    price: number;      // Harga Ecer (Primary)
    stock: number;      // Stok (Primary)
    category: string;   // Kategori (Primary)
    unit: string;       // Satuan (Primary)
    
    // Optional / Legacy Fields (Mapping from Excel)
    ID?: string;        // Internal ID
    Barcode?: string;
    barcode?: string;   // Unified
    Parent_ID?: string;
    
    // Legacy / Excel keys (Optional)
    Nama?: string;
    Kategori?: string;
    Satuan?: string;
    Stok?: number;
    Min_Stok?: number;
    minStock?: number;
    Modal?: number;
    purchasePrice?: number;
    Ecer?: number;
    Harga_Coret?: number;
    Grosir?: number;
    wholesalePrice?: number;
    Min_Grosir?: number;
    minWholesale?: number;
    Link_Foto?: string;
    image?: string;
    Deskripsi?: string;
    description?: string;
    Status?: number;
    Supplier?: string;
    No_WA_Supplier?: string;
    
    updatedAt?: FirestoreTimestamp | Date | null;
    createdAt?: FirestoreTimestamp | Date | null;
    variant?: string;
    stockByWarehouse?: Record<string, number>;
    expiredDate?: string;
}

export interface FirestoreTimestamp {
    seconds: number;
    nanoseconds: number;
}

export interface CartItem extends Product {
    quantity: number;
}

export interface OrderItem {
    id: string;
    name: string;
    price: number;
    quantity: number;
    unit: string;
    image?: string;
}

export interface Order {
    id: string;
    orderId: string;
    userId: string;
    customerId?: string;
    customerName?: string;
    name?: string; // used for guest/customer name
    items: OrderItem[];
    total: number;
    subtotal?: number;
    status: string;
    paymentStatus?: string;
    delivery?: {
        method: string;
        type?: string;
        address: string;
    };
    payment?: {
        method: string;
        proof?: string;
    };
    createdAt: FirestoreTimestamp | Date | null;
    updatedAt?: FirestoreTimestamp | Date | null;
    phone?: string;
    customerPhone?: string; // legacy fallback
    address?: string;
    customerAddress?: string; // legacy fallback
    shippingCost: number;
    pointsUsed: number;
    voucherUsed?: string | null;
    appliedVoucher?: {
        name: string;
        value: number;
    } | null;
    voucherDiscount?: number;
    discountTotal?: number;
}




export interface Voucher {
    id: string;
    name: string;
    code: string;
    value: number;
    cost: number;
    color?: string;
    status: 'ACTIVE' | 'USED' | 'EXPIRED';
    createdAt: FirestoreTimestamp | Date | null;
}

export interface UserProfile {
    uid: string;
    name: string;
    email: string;
    phone: string;
    points: number;
    isPointsFrozen: boolean;
    role: 'customer' | 'admin' | 'cashier';
    addresses?: string[];
    createdAt: FirestoreTimestamp | Date | null;
}

export interface Promotion {
    id: string;
    name: string;
    type: 'product' | 'category' | 'coupon';
    discountType: 'percentage' | 'fixed';
    discountValue: number;
    targetId?: string;
    targetName?: string;
    startDate: string;
    endDate: string;
    isActive: boolean;
    createdAt?: FirestoreTimestamp | Date | null;
}

export interface Category {
    id: string;
    name: string;
    slug: string;
}
