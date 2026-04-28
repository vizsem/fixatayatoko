/**
 * Shared Type Definitions for AtayaToko
 */

export interface ChannelPriceConfig {
    price: number;
    wholesalePrice?: number;
}

export interface UnitOption {
    code: string;
    contains: number;
    label?: string;
    price?: number;
}

export interface Product {
    id: string;         // ID dokumen Firestore
    name: string;       // Nama Produk (Primary)
    price: number;      // Harga Ecer (Primary)
    stock: number;      // Stok (Primary)
    category: string;   // Kategori (Primary)
    unit: string;       // Satuan (Primary)
    sku?: string;       // Stock Keeping Unit
    units?: UnitOption[];
    
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
    channelPricing?: {
        offline?: ChannelPriceConfig;
        website?: ChannelPriceConfig;
        shopee?: ChannelPriceConfig;
        tiktok?: ChannelPriceConfig;
    };
}

export interface FirestoreTimestamp {
    seconds: number;
    nanoseconds: number;
}

export type UserAddress = {
    id: string;
    label: string;
    receiverName: string;
    receiverPhone: string;
    address: string;
};

export interface CartItem extends Product {
    quantity: number;
    promoType?: string;
    originalPrice?: number;
    unitContains?: number;
    baseUnit?: string;
    basePrice?: number;
    unitPrice?: number;
}

export interface OrderItem {
    id: string;
    name: string;
    price: number;
    quantity: number;
    unit: string;
    image?: string;
    // Fields untuk status pemenuhan
    originalQuantity?: number;
    status?: 'fulfilled' | 'unfulfilled' | 'partial';
    note?: string;
}

export interface Order {
    id: string;
    orderId: string;
    userId: string;
    customerId?: string;
    customerName?: string;
    name?: string;
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
    customerPhone?: string;
    address?: string;
    customerAddress?: string;
    shippingCost: number;
    pointsUsed: number;
    voucherUsed?: string | null;
    appliedVoucher?: {
        name: string;
        value: number;
    } | null;
    voucherDiscount?: number;
    discountTotal?: number;
    walletUsed?: number;
    channel?: 'OFFLINE' | 'WEBSITE' | 'SHOPEE' | 'TIKTOK';
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
    walletBalance?: number;
    addresses?: UserAddress[];
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

export interface SyncConfig {
    autoSync: boolean;
    syncInterval: number; // in milliseconds
    maxRetries: number;
    batchSize: number;
    validationThreshold: number;
    enableValidation: boolean;
    enableNotifications: boolean;
    logLevel: 'ERROR' | 'WARN' | 'INFO' | 'DEBUG';
}

export interface StockSyncLog {
    id?: string;
    productId: string;
    productName?: string;
    warehouseId: string;
    warehouseName?: string;
    type: 'WAREHOUSE_TO_PRODUCT' | 'BATCH_SYNC' | 'STOCK_VALIDATION' | 'STOCK_VALIDATION_ERROR' | 'IN' | 'OUT' | 'TRANSFER' | 'ADJUSTMENT';
    status?: 'SUCCESS' | 'COMPLETED' | 'ERROR';
    quantity?: number;
    previousStock?: number;
    newStock?: number;
    difference?: number;
    systemStock?: number;
    reason?: string;
    timestamp: FirestoreTimestamp | Date;
    synced?: boolean;
    syncError?: string;
    error?: string;
    errorStack?: string;
    executionTime?: number;
    operator?: string;
    validation?: {
        productExists: boolean;
        warehouseStockExists: boolean;
        stockValuesValid: boolean;
        totalStockValid: boolean;
        paramsValid?: boolean;
    };
}

export interface StockValidation {
    productId: string;
    warehouseId: string;
    systemStock: number;
    physicalStock: number;
    difference: number;
    lastSync: FirestoreTimestamp | Date;
    status: 'VALID' | 'INVALID' | 'PENDING';
}

export interface OperationalExpense {
    id: string;
    category: string; // Listrik, Air, Gaji, Packing, Bensin, Lainnya
    amount: number;
    date: FirestoreTimestamp | Date | null;
    description: string;
    proofOfPayment?: string; // URL gambar bukti pembayaran
    recordedBy?: string; // User ID yang mencatat
    createdAt?: FirestoreTimestamp | Date | null;
}
