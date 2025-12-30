// src/app/(cashier)/cashier/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
// ✅ Benar
import {
  collection,
  getDocs,
  addDoc,
  doc,
  updateDoc,
  query,
  orderBy,
  onSnapshot,
  where,
  serverTimestamp,
  getDoc
} from 'firebase/firestore';

// ✅ Impor fungsi storage secara terpisah
import {
  ref,
  uploadBytes,
  getDownloadURL
} from 'firebase/storage';
import { db } from '@/lib/firebase';
import { 
  Package, 
  ShoppingCart, 
  Search, 
  Plus, 
  Minus, 
  Printer, 
  Bell,
  MessageSquare,
  Truck,
  CheckCircle,
  Upload,
  QrCode,
  Barcode
} from 'lucide-react';

// Types
type Product = {
  id: string;
  name: string;
  price: number;
  unit: string;
  stock: number;
  barcode?: string;
};

type CartItem = {
  id: string;
  name: string;
  price: number;
  quantity: number;
  unit: string;
};

type Order = {
  id: string;
  customerName: string;
  customerPhone: string;
  items: any[];
  total: number;
  paymentMethod: string;
  deliveryMethod: string;
  status: string;
  createdAt: string;
};

// ✅ Contoh 5 produk baru
const sampleProducts: Omit<Product, 'id'>[] = [
  { name: "Gula Pasir 1kg", price: 16000, unit: "1kg", stock: 200, barcode: "GP001" },
  { name: "Minyak Goreng 1L", price: 18000, unit: "1L", stock: 150, barcode: "MG002" },
  { name: "Tepung Terigu 1kg", price: 12000, unit: "1kg", stock: 180, barcode: "TT003" },
  { name: "Kopi Sachet 10pcs", price: 8000, unit: "10pcs", stock: 300, barcode: "KS004" },
  { name: "Sabun Mandi 120gr", price: 6000, unit: "pcs", stock: 250, barcode: "SM005" }
];

export default function CashierPOS() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [newOrderCount, setNewOrderCount] = useState(0);
  const [showNotification, setShowNotification] = useState(false);
  const [recentOrders, setRecentOrders] = useState<Order[]>([]);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // ✅ State untuk transaksi & upload
  const [transactionType, setTransactionType] = useState<'toko' | 'online'>('toko');
  const [deliveryMethod, setDeliveryMethod] = useState('Ambil di Toko');
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [cashGiven, setCashGiven] = useState('');
  const [change, setChange] = useState(0);
  const [shippingCost, setShippingCost] = useState(0);
  const [paymentProof, setPaymentProof] = useState<File | null>(null);
  const [proofPreview, setProofPreview] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const total = subtotal + shippingCost;

  // Hitung ongkir & kembalian
  useEffect(() => {
    const shippingRates: Record<string, number> = {
      'Ambil di Toko': 0,
      'Kurir Toko': 15000,
      'OJOL': 0
    };
    setShippingCost(shippingRates[deliveryMethod] || 0);
  }, [deliveryMethod]);

  useEffect(() => {
    if (paymentMethod === 'CASH' && cashGiven) {
      const given = parseFloat(cashGiven) || 0;
      setChange(given - (subtotal + shippingCost));
    } else {
      setChange(0);
    }
  }, [paymentMethod, cashGiven, subtotal, shippingCost]);

  // ✅ Update preview bukti bayar
  useEffect(() => {
    if (paymentProof) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setProofPreview(e.target?.result as string);
      };
      reader.readAsDataURL(paymentProof);
    } else {
      setProofPreview(null);
    }
  }, [paymentProof]);

  // ✅ Proteksi akses
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push('/profil/login');
        return;
      }

      const userDoc = await getDoc(doc(db, 'users', user.uid));
      const role = userDoc.data()?.role;
      
      if (role !== 'cashier' && role !== 'admin') {
        alert('Akses ditolak! Anda bukan kasir atau admin.');
        router.push('/profil');
        return;
      }

      // ✅ Tambahkan contoh produk jika belum ada
      const productsSnapshot = await getDocs(collection(db, 'products'));
      if (productsSnapshot.empty) {
        for (const product of sampleProducts) {
          await addDoc(collection(db, 'products'), {
            ...product,
            createdAt: new Date().toISOString()
          });
        }
      }

      setLoading(false);
    });
    return () => unsubscribe();
  }, [router]);

  // Load produk
  useEffect(() => {
    if (loading) return;

    const fetchProducts = async () => {
      try {
        const snapshot = await getDocs(collection(db, 'products'));
        const productList = snapshot.docs.map(doc => ({
          id: doc.id,
          name: doc.data().name || 'Produk Tanpa Nama',
          price: doc.data().price || 0,
          unit: doc.data().unit || 'pcs',
          stock: doc.data().stock || 0,
          barcode: doc.data().barcode || ''
        })) as Product[];
        setProducts(productList);
        setFilteredProducts(productList);
      } catch (error) {
        console.error('Error fetching products:', error);
      }
    };

    fetchProducts();
  }, [loading]);

  // ✅ Filter produk (termasuk barcode)
  useEffect(() => {
    const filtered = products.filter(product =>
      product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.barcode?.includes(searchQuery)
    );
    setFilteredProducts(filtered);
  }, [searchQuery, products]);

  // 🔔 NOTIFIKASI PESANAN BARU
  useEffect(() => {
    if (loading) return;

    const ordersRef = collection(db, 'orders');
    const q = query(
      ordersRef, 
      where('status', '==', 'MENUNGGU'),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const orders = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Order[];

      setRecentOrders(orders);
      setNewOrderCount(orders.length);
      
      if (orders.length > 0) {
        setShowNotification(true);
        setTimeout(() => setShowNotification(false), 5000);
      }
    }, (error) => {
      console.error("Error listening to orders:", error);
    });

    return () => unsubscribe();
  }, [loading]);

  // Fungsi keranjang
  const addToCart = (product: Product) => {
    const existingItem = cart.find(item => item.id === product.id);
    if (existingItem) {
      setCart(cart.map(item =>
        item.id === product.id 
          ? { ...item, quantity: item.quantity + 1 }
          : item
      ));
    } else {
      setCart([...cart, { 
        id: product.id, 
        name: product.name, 
        price: product.price, 
        quantity: 1,
        unit: product.unit || 'pcs'
      }]);
    }
  };

  const updateQuantity = (id: string, quantity: number) => {
    if (quantity <= 0) {
      setCart(cart.filter(item => item.id !== id));
    } else {
      setCart(cart.map(item =>
        item.id === id ? { ...item, quantity } : item
      ));
    }
  };

  // Cetak struk
  const printReceipt = (order: any) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const isOnline = order.transactionType === 'online';
    const receiptContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Struk ATAYATOKO</title>
        <style>
          body { 
            font-family: 'Courier New', monospace; 
            width: 80mm; 
            margin: 0; 
            padding: 10px;
            font-size: 12px;
          }
          .center { text-align: center; }
          .bold { font-weight: bold; }
          .separator { border-top: 1px dashed #000; margin: 8px 0; }
          .item { display: flex; justify-content: space-between; }
          .highlight { background-color: #f0f0f0; padding: 2px; }
        </style>
      </head>
      <body>
        <div class="center">
          <div class="bold">ATAYATOKO</div>
          <div>Ecer & Grosir</div>
          <div>Jl. Pandan 98, Semen, Kediri</div>
          <div>0858-5316-1174</div>
          <div class="separator"></div>
          <div class="highlight">
            ${isOnline ? 'PESANAN ONLINE' : 'TRANSAKSI TOKO'}
          </div>
          <div>${new Date(order.createdAt).toLocaleString('id-ID')}</div>
          <div class="separator"></div>
        </div>
        
        ${order.items.map((item: any) => `
          <div class="item">
            <span>${item.name} x${item.quantity}</span>
            <span>Rp${(item.price * item.quantity).toLocaleString('id-ID')}</span>
          </div>
        `).join('')}
        
        <div class="separator"></div>
        <div class="item">
          <span>Subtotal</span>
          <span>Rp${order.subtotal.toLocaleString('id-ID')}</span>
        </div>
        ${order.shippingCost > 0 ? `
          <div class="item">
            <span>Ongkir</span>
            <span>Rp${order.shippingCost.toLocaleString('id-ID')}</span>
          </div>
        ` : ''}
        <div class="item bold">
          <span>TOTAL</span>
          <span>Rp${order.total.toLocaleString('id-ID')}</span>
        </div>
        
        <div class="separator"></div>
        <div class="item">
          <span>Metode Bayar</span>
          <span>${order.paymentMethod}</span>
        </div>
        ${order.paymentMethod === 'CASH' ? `
          <div class="item">
            <span>Uang Tunai</span>
            <span>Rp${order.cashGiven.toLocaleString('id-ID')}</span>
          </div>
          <div class="item">
            <span>Kembalian</span>
            <span>Rp${order.change.toLocaleString('id-ID')}</span>
          </div>
        ` : order.paymentProofUrl ? `
          <div class="item">
            <span>Bukti Bayar</span>
            <span>✓ Terupload</span>
          </div>
        ` : ''}
        
        ${isOnline ? `
          <div class="separator"></div>
          <div class="item">
            <span>Pengiriman</span>
            <span>${order.deliveryMethod}</span>
          </div>
        ` : ''}
        
        <div class="separator"></div>
        <div class="center">
          ${isOnline ? 'Pesanan sedang diproses' : 'Terima kasih!'}<br>
          Lengkap • Hemat • Terpercaya
        </div>
      </body>
      </html>
    `;

    printWindow.document.write(receiptContent);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
    printWindow.close();
  };

  // ✅ Fungsi upload bukti bayar ke Firebase Storage
  const uploadPaymentProof = async (file: File) => {
    try {
      const storageRef = ref(storage, `payment-proofs/${Date.now()}_${file.name}`);
      const snapshot = await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(snapshot.ref);
      return downloadURL;
    } catch (error) {
      console.error('Gagal upload bukti pembayaran:', error);
      alert('Gagal mengupload bukti pembayaran. Silakan coba lagi.');
      return null;
    }
  };

  // Fungsi transaksi
  const handleTransaction = async () => {
    if (cart.length === 0) {
      alert('Keranjang kosong!');
      return;
    }

    // ✅ Validasi bukti bayar untuk QRIS/TRANSFER
    if ((paymentMethod === 'QRIS' || paymentMethod === 'TRANSFER') && !paymentProof) {
      alert('Wajib upload bukti pembayaran untuk metode ini!');
      return;
    }

    if (paymentMethod === 'CASH' && change < 0) {
      alert('Uang tunai tidak cukup!');
      return;
    }

    setIsProcessing(true);

    try {
      let paymentProofUrl = null;
      if (paymentProof) {
        paymentProofUrl = await uploadPaymentProof(paymentProof);
        if (!paymentProofUrl) {
          setIsProcessing(false);
          return;
        }
      }

      const orderData = {
        customerId: auth.currentUser?.uid,
        customerName: 'Kasir Toko',
        customerPhone: '',
        items: cart,
        subtotal: subtotal,
        shippingCost: shippingCost,
        total: total,
        paymentMethod: paymentMethod,
        cashGiven: paymentMethod === 'CASH' ? parseFloat(cashGiven) : null,
        change: paymentMethod === 'CASH' ? change : null,
        paymentProofUrl: paymentProofUrl,
        deliveryMethod: deliveryMethod,
        transactionType: transactionType,
        status: transactionType === 'online' ? 'DIPROSES' : 'SELESAI',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      const docRef = await addDoc(collection(db, 'orders'), orderData);
      
      // Cetak struk
      printReceipt({ ...orderData, id: docRef.id, createdAt: new Date().toISOString() });
      
      // Reset
      setCart([]);
      setTransactionType('toko');
      setPaymentMethod('CASH');
      setCashGiven('');
      setDeliveryMethod('Ambil di Toko');
      setPaymentProof(null);
      
      alert('Transaksi berhasil!');
    } catch (error) {
      console.error('Error creating order:', error);
      alert('Gagal menyimpan transaksi.');
    } finally {
      setIsProcessing(false);
    }
  };

  const markAsProcessed = async (orderId: string) => {
    try {
      await updateDoc(doc(db, 'orders', orderId), {
        status: 'DIPROSES',
        deliveryMethod: deliveryMethod,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error('Error updating order:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
          <p className="mt-4 text-black">Memuat sistem kasir...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 🔔 NOTIFIKASI PESANAN BARU */}
      {showNotification && newOrderCount > 0 && (
        <div className="fixed top-4 right-4 z-50 bg-red-600 text-white p-4 rounded-lg shadow-lg animate-pulse">
          <div className="flex items-center gap-3">
            <Bell size={20} />
            <div>
              <p className="font-bold">Pesanan Baru!</p>
              <p>{newOrderCount} pesanan menunggu diproses</p>
            </div>
          </div>
        </div>
      )}

      <div className="p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-black">POS Kasir</h1>
          <button 
            onClick={() => setIsDrawerOpen(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2"
          >
            <ShoppingCart size={18} />
            <span>Pesanan Online ({newOrderCount})</span>
          </button>
        </div>

        {/* Pemilih Jenis Transaksi */}
        <div className="mb-6 bg-white p-4 rounded-lg shadow">
          <div className="flex space-x-4">
            <button
              onClick={() => setTransactionType('toko')}
              className={`px-4 py-2 rounded-lg font-medium ${
                transactionType === 'toko'
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-200 text-black hover:bg-gray-300'
              }`}
            >
              Transaksi Toko
            </button>
            <button
              onClick={() => setTransactionType('online')}
              className={`px-4 py-2 rounded-lg font-medium ${
                transactionType === 'online'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-black hover:bg-gray-300'
              }`}
            >
              Pesanan Online
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Produk */}
          <div className="lg:col-span-3">
            <div className="bg-white rounded-lg shadow p-4 mb-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                <Barcode className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                <input
                  type="text"
                  placeholder="Cari produk atau scan barcode..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 text-black"
                />
              </div>
            </div>

            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 p-4">
                {filteredProducts.map((product) => (
                  <div 
                    key={product.id} 
                    className="border border-gray-200 rounded-lg p-4 hover:shadow-md cursor-pointer"
                    onClick={() => addToCart(product)}
                  >
                    <div className="bg-gray-100 w-full h-24 rounded mb-2 flex items-center justify-center">
                      {product.barcode ? <QrCode className="text-gray-600" size={24} /> : <Package className="text-gray-400" size={24} />}
                    </div>
                    <h3 className="font-medium text-black text-sm mb-1 line-clamp-2">{product.name}</h3>
                    <p className="text-green-600 font-bold text-sm">
                      Rp{(product.price || 0).toLocaleString('id-ID')}
                    </p>
                    <p className="text-xs text-black">{product.unit} {product.barcode && `• #${product.barcode}`}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Keranjang & Form */}
          <div className="bg-white rounded-lg shadow">
            <div className="p-4 border-b">
              <h2 className="font-bold text-lg text-black">Keranjang ({cart.length} item)</h2>
            </div>
            <div className="p-4 max-h-96 overflow-y-auto">
              {cart.length === 0 ? (
                <p className="text-black text-center py-8">Keranjang kosong</p>
              ) : (
                <div className="space-y-4">
                  {cart.map((item) => (
                    <div key={item.id} className="flex items-center justify-between">
                      <div>
                        <h3 className="font-medium text-sm text-black">{item.name}</h3>
                        <p className="text-green-600 text-sm">
                          Rp{(item.price || 0).toLocaleString('id-ID')} × {item.quantity}
                        </p>
                      </div>
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => updateQuantity(item.id, item.quantity - 1)}
                          className="w-6 h-6 rounded-full border border-gray-300 flex items-center justify-center"
                        >
                          <Minus size={12} />
                        </button>
                        <span className="w-8 text-center text-sm text-black">{item.quantity}</span>
                        <button
                          onClick={() => updateQuantity(item.id, item.quantity + 1)}
                          className="w-6 h-6 rounded-full border border-gray-300 flex items-center justify-center"
                        >
                          <Plus size={12} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            {/* Form Transaksi */}
            <div className="p-4 border-t">
              {transactionType === 'online' && (
                <div className="mb-4">
                  <label className="block text-black text-sm font-medium mb-2">
                    Metode Pengiriman
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {['Ambil di Toko', 'Kurir Toko', 'OJOL'].map((method) => (
                      <button
                        key={method}
                        onClick={() => setDeliveryMethod(method)}
                        className={`py-2 rounded text-sm font-medium ${
                          deliveryMethod === method
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-200 text-black hover:bg-gray-300'
                        }`}
                      >
                        {method}
                      </button>
                    ))}
                  </div>
                  {shippingCost > 0 && (
                    <p className="mt-2 text-sm text-black">
                      Ongkir: Rp{shippingCost.toLocaleString('id-ID')}
                    </p>
                  )}
                </div>
              )}

              <div className="mb-4">
                <label className="block text-black text-sm font-medium mb-2">
                  Metode Pembayaran
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {['CASH', 'QRIS', 'TRANSFER', 'CREDIT', 'COD'].map((method) => (
                    <button
                      key={method}
                      onClick={() => {
                        setPaymentMethod(method);
                        if (method !== 'CASH') setCashGiven('');
                        setPaymentProof(null);
                      }}
                      className={`py-2 rounded text-sm font-medium ${
                        paymentMethod === method
                          ? 'bg-green-600 text-white'
                          : 'bg-gray-200 text-black hover:bg-gray-300'
                      }`}
                    >
                      {method}
                    </button>
                  ))}
                </div>
              </div>

              {/* ✅ Upload Bukti Bayar (QRIS/TRANSFER) */}
              {(paymentMethod === 'QRIS' || paymentMethod === 'TRANSFER') && (
                <div className="mb-4">
                  <label className="block text-black text-sm font-medium mb-2">
                    Upload Bukti Pembayaran
                  </label>
                  <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100">
                    {proofPreview ? (
                      <img src={proofPreview} alt="Preview" className="w-full h-full object-cover rounded" />
                    ) : (
                      <div className="flex flex-col items-center justify-center pt-5 pb-6">
                        <Upload className="text-gray-400" size={24} />
                        <p className="text-sm text-gray-500">Klik untuk upload gambar</p>
                      </div>
                    )}
                    <input 
                      type="file" 
                      accept="image/*" 
                      className="hidden" 
                      onChange={(e) => setPaymentProof(e.target.files?.[0] || null)}
                    />
                  </label>
                  {paymentProof && (
                    <p className="mt-2 text-sm text-black">
                      File: {paymentProof.name} ({(paymentProof.size / 1024).toFixed(1)} KB)
                    </p>
                  )}
                </div>
              )}

              {paymentMethod === 'CASH' && (
                <div className="mb-4">
                  <label className="block text-black text-sm font-medium mb-2">
                    Uang Tunai (Rp)
                  </label>
                  <input
                    type="number"
                    value={cashGiven}
                    onChange={(e) => setCashGiven(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded text-black"
                    placeholder="Masukkan jumlah uang"
                    min={total}
                  />
                  {change >= 0 && (
                    <p className="mt-2 text-green-600 font-medium">
                      Kembalian: Rp{change.toLocaleString('id-ID')}
                    </p>
                  )}
                  {change < 0 && (
                    <p className="mt-2 text-red-600">
                      Uang kurang Rp{Math.abs(change).toLocaleString('id-ID')}
                    </p>
                  )}
                </div>
              )}

              <div className="flex justify-between font-bold text-lg mb-3">
                <span className="text-black">Total:</span>
                <span className="text-black">Rp{total.toLocaleString('id-ID')}</span>
              </div>
              
              <button 
                onClick={handleTransaction}
                disabled={isProcessing || (paymentMethod === 'CASH' && change < 0)}
                className="w-full bg-green-600 text-white py-3 rounded-lg hover:bg-green-700 font-medium disabled:bg-gray-400 flex items-center justify-center"
              >
                {isProcessing ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Memproses...
                  </>
                ) : (
                  'Selesai Transaksi'
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 📱 DRAWER PESANAN ONLINE */}
      {isDrawerOpen && (
        <div className="fixed inset-0 z-40">
          <div 
            className="fixed inset-0 bg-black bg-opacity-50"
            onClick={() => setIsDrawerOpen(false)}
          ></div>
          <div className="fixed right-0 top-0 h-full w-full max-w-md bg-white shadow-xl">
            <div className="p-4 border-b">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-black">Pesanan Online</h2>
                <button 
                  onClick={() => setIsDrawerOpen(false)}
                  className="text-black"
                >
                  ✕
                </button>
              </div>
              {newOrderCount > 0 && (
                <p className="text-red-600 text-sm mt-1">
                  {newOrderCount} pesanan menunggu diproses
                </p>
              )}
            </div>
            
            <div className="p-4 overflow-y-auto h-[calc(100vh-120px)]">
              {recentOrders.length === 0 ? (
                <div className="text-center py-12">
                  <ShoppingCart className="mx-auto text-gray-400 mb-3" size={48} />
                  <p className="text-black">Tidak ada pesanan online</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {recentOrders.map((order) => (
                    <div key={order.id} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <h3 className="font-bold text-black">#{order.id.substring(0, 8)}</h3>
                          <p className="text-sm text-black">
                            {new Date(order.createdAt).toLocaleTimeString('id-ID')}
                          </p>
                        </div>
                        <span className="px-2 py-1 bg-red-100 text-red-800 text-xs rounded-full">
                          Baru
                        </span>
                      </div>
                      
                      <p className="font-medium text-black">{order.customerName}</p>
                      <p className="text-sm text-black mb-3">{order.customerPhone}</p>
                      
                      <div className="mb-3">
                        {order.items.slice(0, 2).map((item: any, idx: number) => (
                          <p key={idx} className="text-sm text-black">
                            {item.name} × {item.quantity}
                          </p>
                        ))}
                        {order.items.length > 2 && (
                          <p className="text-sm text-black">
                            +{order.items.length - 2} item lainnya
                          </p>
                        )}
                      </div>
                      
                      <div className="flex justify-between items-center mb-3">
                        <span className="font-bold text-green-600">
                          Rp{(order.total || 0).toLocaleString('id-ID')}
                        </span>
                        <div className="flex items-center gap-1 text-sm text-black">
                          {order.deliveryMethod.includes('Kurir') || order.deliveryMethod.includes('OJOL') ? (
                            <Truck className="text-blue-600" size={14} />
                          ) : (
                            <CheckCircle className="text-green-600" size={14} />
                          )}
                          <span>{order.paymentMethod}</span>
                        </div>
                      </div>
                      
                      <div className="flex gap-2">
                        <button
                          onClick={() => markAsProcessed(order.id)}
                          className="flex-1 bg-blue-600 text-white text-sm py-1.5 rounded"
                        >
                          Proses
                        </button>
                        {order.customerPhone && (
                          <a
                            href={`https://wa.me/${order.customerPhone.replace('+', '')}`}
                            className="p-1.5 bg-green-100 text-green-600 rounded"
                            title="Chat via WhatsApp"
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <MessageSquare size={16} />
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}