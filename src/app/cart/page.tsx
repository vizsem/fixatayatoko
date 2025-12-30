// src/app/cart/page.tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { ShoppingCart, Trash2, Package, Truck, Store, MapPin, CreditCard, Upload, CheckCircle, User } from 'lucide-react';
import Link from 'next/link';
import { 
  addDoc, 
  collection, 
  serverTimestamp,
  doc,
  updateDoc,
  arrayUnion,
  getDoc
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { auth } from '@/lib/firebase';
import { db, storage } from '@/lib/firebase';

type Address = {
  id: string;
  label: string;
  address: string;
  lat: number;
  lng: number;
};

type CartItem = {
  id: number;
  name: string;
  price: number;
  originalPrice: number;
  image: string;
  category: string;
  unit: string;
  quantity: number;
  discount: number;
};

export default function CartPage() {
  const router = useRouter();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [deliveryMethod, setDeliveryMethod] = useState<'pickup' | 'delivery'>('pickup');
  const [customerAddress, setCustomerAddress] = useState('');
  const [deliveryLocation, setDeliveryLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'transfer' | 'qris'>('cash');
  const [note, setNote] = useState('');
  const [paymentProof, setPaymentProof] = useState<File | null>(null);
  const [savedAddresses, setSavedAddresses] = useState<Address[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [proofPreview, setProofPreview] = useState<string | null>(null);
  const [proofUrl, setProofUrl] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const mapRef = useRef<HTMLDivElement>(null);

  // Load cart from localStorage
  useEffect(() => {
    const savedCart = localStorage.getItem('atayatoko-cart');
    if (savedCart) {
      try {
        setCart(JSON.parse(savedCart));
      } catch (e) {
        console.error('Gagal memuat keranjang:', e);
        setCart([]);
      }
    }
    const savedName = localStorage.getItem('atayatoko-customer-name');
    const savedPhone = localStorage.getItem('atayatoko-customer-phone');
    if (savedName) setCustomerName(savedName);
    if (savedPhone) setCustomerPhone(savedPhone);
  }, []);

  useEffect(() => {
    if (cart.length > 0) {
      localStorage.setItem('atayatoko-cart', JSON.stringify(cart));
    }
  }, [cart]);

  // Load user profile & saved addresses
  useEffect(() => {
    const fetchUserData = async () => {
      if (auth.currentUser?.uid) {
        const userRef = doc(db, 'users', auth.currentUser.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          const userData = userSnap.data();
          setProfile(userData);
          setSavedAddresses(userData.addresses || []);
          
          if (userData.addresses?.length === 1) {
            const addr = userData.addresses[0];
            setSelectedAddressId(addr.id);
            setCustomerName(userData.name || '');
            setCustomerPhone(userData.whatsapp || userData.phone || '');
            setCustomerAddress(addr.address);
            setDeliveryLocation({ lat: addr.lat, lng: addr.lng });
          }
        }
      }
    };
    fetchUserData();
  }, []);

  // Handle payment proof preview
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

  // Load Google Maps API
  useEffect(() => {
    if (typeof window !== 'undefined' && deliveryMethod === 'delivery' && !mapLoaded) {
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=AIzaSyDV5Oz_zphv8UatLlZssdLkrbHSIZ8fOZI`;
      script.async = true;
      script.onload = () => setMapLoaded(true);
      document.head.appendChild(script);
      
      return () => {
        if (document.head.contains(script)) {
          document.head.removeChild(script);
        }
      };
    }
  }, [deliveryMethod, mapLoaded]);

  // Initialize map
  useEffect(() => {
    if (mapLoaded && mapRef.current && deliveryMethod === 'delivery') {
      const defaultCenter = { lat: -7.8014, lng: 111.8139 };
      const map = new (window as any).google.maps.Map(mapRef.current, {
        zoom: 13,
        center: deliveryLocation || defaultCenter,
        mapTypeId: (window as any).google.maps.MapTypeId.ROADMAP
      });

      map.addListener('click', (mapsMouseEvent: any) => {
        const lat = mapsMouseEvent.latLng.lat();
        const lng = mapsMouseEvent.latLng.lng();
        setDeliveryLocation({ lat, lng });
      });

      if (deliveryLocation) {
        new (window as any).google.maps.Marker({
          position: { lat: deliveryLocation.lat, lng: deliveryLocation.lng },
          map: map,
          title: 'Lokasi Pengiriman'
        });
      }
    }
  }, [mapLoaded, deliveryMethod, deliveryLocation]);

  const updateQuantity = (id: number, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.id === id) {
            const newQty = item.quantity + delta;
            return newQty > 0 ? { ...item, quantity: newQty } : item;
          }
          return item;
        })
        .filter((item) => item.quantity > 0)
    );
  };

  const removeItem = (id: number) => {
    setCart((prev) => prev.filter((item) => item.id !== id));
  };

  const getTotalPrice = () => {
    return cart.reduce((total, item) => total + item.price * item.quantity, 0);
  };

  const getTotalItems = () => {
    return cart.reduce((total, item) => total + item.quantity, 0);
  };

  const subtotal = getTotalPrice();
  const shipping = deliveryMethod === 'pickup' || subtotal > 100000 ? 0 : 15000;
  const total = subtotal + shipping;

  const buildWhatsAppMessage = () => {
    let message = `Halo ATAYATOKO,\n\nSaya ${customerName || 'pelanggan'} ingin memesan:\n\n`;
    cart.forEach((item) => {
      message += `• ${item.name}\n`;
      message += `  ${item.quantity} x Rp${(item.price * item.quantity).toLocaleString('id-ID')}\n\n`;
    });
    message += `TOTAL: Rp${total.toLocaleString('id-ID')}\n\n`;
    message += `Metode Pengiriman: ${deliveryMethod === 'pickup' ? 'Ambil di Toko' : 'Antar ke Alamat'}\n`;
    message += `Metode Pembayaran: ${
      paymentMethod === 'cash' ? 'Tunai' : paymentMethod === 'transfer' ? 'Transfer Bank' : 'QRIS'
    }\n`;
    if (deliveryMethod === 'delivery' && customerAddress) {
      message += `\nAlamat: ${customerAddress}\n`;
    }
    if (note) message += `\nCatatan: ${note}\n`;
    if (proofUrl) message += `\nBukti pembayaran telah diupload.\n`;
    message += `\nTerima kasih!`;
    return encodeURIComponent(message);
  };

  const validate = () => {
    if ((paymentMethod === 'transfer' || paymentMethod === 'qris') && !auth.currentUser) {
      alert('Silakan login dulu untuk menggunakan metode pembayaran ini');
      router.push('/profil/login');
      return false;
    }
    
    const newErrors: Record<string, string> = {};
    if (!customerName.trim()) newErrors.name = 'Nama wajib diisi';
    if (!customerPhone.trim()) newErrors.phone = 'Nomor WhatsApp wajib diisi';
    if (deliveryMethod === 'delivery') {
      if (!customerAddress.trim()) newErrors.address = 'Alamat pengiriman wajib diisi';
      if (!deliveryLocation) newErrors.location = 'Lokasi pengiriman wajib dipilih di peta';
    }
    if ((paymentMethod === 'transfer' || paymentMethod === 'qris') && !paymentProof) {
      newErrors.paymentProof = 'Bukti pembayaran wajib diupload';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const compressImage = (file: File): Promise<Blob> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          const MAX_WIDTH = 800;
          const MAX_HEIGHT = 600;
          let width = img.width;
          let height = img.height;
          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }
          canvas.width = width;
          canvas.height = height;
          ctx?.drawImage(img, 0, 0, width, height);
          canvas.toBlob((blob) => resolve(blob as Blob), 'image/jpeg', 0.7);
        };
      };
    });
  };

  const uploadPaymentProof = async () => {
    if (!auth.currentUser) {
      alert('Silakan login dulu untuk upload bukti pembayaran');
      router.push('/profil/login');
      return null;
    }
    if (!paymentProof) return null;
    
    setUploading(true);
    try {
      const compressedBlob = await compressImage(paymentProof);
      const storageRef = ref(storage, `payment-proofs/${Date.now()}_${paymentProof.name}`);
      const snapshot = await uploadBytes(storageRef, compressedBlob);
      const downloadURL = await getDownloadURL(snapshot.ref);
      return downloadURL;
    } catch (error) {
      console.error('Gagal upload bukti pembayaran:', error);
      alert('Gagal mengupload bukti pembayaran. Silakan coba lagi.');
      return null;
    } finally {
      setUploading(false);
    }
  };

  const saveOrderToFirestore = async () => {
    if (!validate()) return false;
    
    setIsSubmitting(true);
    try {
      let paymentProofUrl = null;
      if (paymentProof) {
        paymentProofUrl = await uploadPaymentProof();
        if (!paymentProofUrl) return false;
      }

      const backendDeliveryMethod = deliveryMethod === 'pickup' ? 'Ambil di Toko' : 'Kurir Toko';
      const backendPaymentMethod = 
        paymentMethod === 'cash' ? 'CASH' :
        paymentMethod === 'transfer' ? 'TRANSFER' : 'QRIS';

      const orderData = {
        customerId: auth.currentUser?.uid || null,
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        deliveryAddress: customerAddress.trim(),
        deliveryLocation: deliveryLocation,
        deliveryMethod: backendDeliveryMethod,
        paymentMethod: backendPaymentMethod,
        paymentProofUrl: paymentProofUrl,
        note: note.trim(),
        items: cart,
        subtotal,
        shipping,
        total,
        status: paymentMethod === 'cash' ? 'MENUNGGU' : 'MENUNGGU',
        createdAt: serverTimestamp()
      };

      const docRef = await addDoc(collection(db, 'orders'), orderData);
      
      if (auth.currentUser?.uid) {
        const userRef = doc(db, 'users', auth.currentUser.uid);
        await updateDoc(userRef, {
          orders: arrayUnion(docRef.id)
        });
      }

      localStorage.removeItem('atayatoko-cart');
      localStorage.removeItem('atayatoko-customer-name');
      localStorage.removeItem('atayatoko-customer-phone');
      
      return true;
    } catch (error) {
      console.error('Gagal menyimpan pesanan:', error);
      alert('Gagal mengirim pesanan. Silakan coba lagi.');
      return false;
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleWhatsAppAndSave = async () => {
    if (!validate()) return;
    const success = await saveOrderToFirestore();
    if (!success) return;
    const whatsappUrl = `https://wa.me/6285853161174?text=${buildWhatsAppMessage()}`;
    window.open(whatsappUrl, '_blank');
    setTimeout(() => router.push('/'), 1000);
  };

  // ✅ FUNGSI SIMPAN PDF
  const handleDownloadPDF = async () => {
    if (!validate()) return;
    
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

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
            padding: 5mm;
            font-size: 12px;
          }
          .center { text-align: center; }
          .item { display: flex; justify-content: space-between; margin: 2px 0; }
          .bold { font-weight: bold; }
        </style>
      </head>
      <body>
        <div class="center">
          <div class="bold">ATAYATOKO</div>
          <div class="text-xs">Ecer & Grosir</div>
          <div class="text-xs mt-1">${new Date().toLocaleString('id-ID')}</div>
          <hr style="margin: 4px 0; border: 0; border-top: 1px dashed #000;">
        </div>
        
        ${cart.map(item => `
          <div class="item">
            <span>${item.name}</span>
            <span>${item.quantity} x Rp${(item.price * item.quantity).toLocaleString('id-ID')}</span>
          </div>
        `).join('')}
        
        <hr style="margin: 4px 0; border: 0; border-top: 1px dashed #000;">
        <div class="item bold">
          <span>TOTAL</span>
          <span>Rp${total.toLocaleString('id-ID')}</span>
        </div>
        <div class="center mt-4 text-xs">
          Terima kasih!<br>
          Lengkap • Hemat • Terpercaya
        </div>
      </body>
      </html>
    `;

    printWindow.document.write(receiptContent);
    printWindow.document.close();
    
    // Simpan sebagai PDF
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 500);
  };

  const handleSelectAddress = (addr: Address) => {
    setSelectedAddressId(addr.id);
    setCustomerName(profile?.name || '');
    setCustomerPhone(profile?.whatsapp || profile?.phone || '');
    setCustomerAddress(addr.address);
    setDeliveryLocation({ lat: addr.lat, lng: addr.lng });
  };

  const handleSaveNewAddress = async () => {
    if (!auth.currentUser?.uid || !customerAddress.trim() || !deliveryLocation) {
      return;
    }

    const autoLabel = customerAddress.split(',')[0] || `Alamat ${savedAddresses.length + 1}`;
    const newAddress: Address = {
      id: `addr-${Date.now()}`,
      label: autoLabel,
      address: customerAddress.trim(),
      lat: deliveryLocation.lat,
      lng: deliveryLocation.lng
    };

    const userRef = doc(db, 'users', auth.currentUser.uid);
    await updateDoc(userRef, {
      addresses: arrayUnion(newAddress)
    });

    setSavedAddresses(prev => [...prev, newAddress]);
    setSelectedAddressId(newAddress.id);
  };

  useEffect(() => {
    if (customerName) localStorage.setItem('atayatoko-customer-name', customerName);
    if (customerPhone) localStorage.setItem('atayatoko-customer-phone', customerPhone);
  }, [customerName, customerPhone]);

  if (cart.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="text-center py-12">
            <ShoppingCart size={64} className="mx-auto text-gray-400 mb-6" />
            <h1 className="text-2xl font-bold text-gray-900 mb-4">Keranjang Belanja Kosong</h1>
            <p className="text-gray-600 mb-8">Belum ada produk di keranjang Anda.</p>
            <Link
              href="/"
              className="inline-block bg-green-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-green-700 transition-colors"
            >
              Lanjut Belanja
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ✅ HEADER HANYA ICON */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Store className="text-green-600" size={28} />
              {auth.currentUser ? (
                <Link href="/profil" className="text-gray-600 hover:text-green-600">
                  <User size={24} />
                </Link>
              ) : (
                <Link href="/profil/login" className="text-gray-600 hover:text-green-600">
                  <User size={24} />
                </Link>
              )}
            </div>

            <Link href="/" className="text-green-600 hover:text-green-700 text-sm">
              ← Kembali
            </Link>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-6">Keranjang Belanja</h1>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow-sm overflow-hidden">
              {cart.map((item) => (
                <div key={item.id} className="flex items-center p-4 border-b last:border-b-0">
                  <img
                    src={item.image}
                    alt={item.name}
                    className="w-20 h-20 object-cover rounded-md"
                  />
                  <div className="ml-4 flex-1">
                    <h3 className="font-semibold text-gray-900">{item.name}</h3>
                    <p className="text-sm text-gray-600">{item.unit} • {item.category}</p>
                    <div className="flex items-center mt-2">
                      <span className="text-lg font-bold text-gray-900">
                        Rp{item.price.toLocaleString('id-ID')}
                      </span>
                      {item.originalPrice > item.price && (
                        <span className="text-sm text-gray-500 line-through ml-2">
                          Rp{item.originalPrice.toLocaleString('id-ID')}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <button
                      onClick={() => updateQuantity(item.id, -1)}
                      className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center text-gray-600 hover:bg-gray-100"
                    >
                      −
                    </button>
                    <span className="w-8 text-center font-medium text-black">{item.quantity}</span>
                    <button
                      onClick={() => updateQuantity(item.id, 1)}
                      className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center text-gray-600 hover:bg-gray-100"
                    >
                      +
                    </button>
                    <button
                      onClick={() => removeItem(item.id)}
                      className="ml-4 p-1.5 text-gray-500 hover:text-red-500"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6 h-fit space-y-6">
            <h2 className="text-xl font-bold text-gray-900">Detail Pemesanan</h2>

            {auth.currentUser && savedAddresses.length > 0 ? (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Pilih Alamat Pengiriman
                </label>
                <div className="space-y-3">
                  {savedAddresses.map((addr) => (
                    <div 
                      key={addr.id}
                      className={`p-3 border rounded-lg cursor-pointer ${
                        selectedAddressId === addr.id 
                          ? 'border-green-500 bg-green-50' 
                          : 'border-gray-300 hover:bg-gray-50'
                      }`}
                      onClick={() => handleSelectAddress(addr)}
                    >
                      <div className="font-medium">{addr.label}</div>
                      <div className="text-sm text-gray-600">{addr.address}</div>
                      <div className="text-xs text-gray-500 mt-1">
                        {profile?.name || '–'} • {profile?.whatsapp || profile?.phone || '–'}
                      </div>
                    </div>
                  ))}
                  
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedAddressId('new');
                      setCustomerName(profile?.name || '');
                      setCustomerPhone(profile?.whatsapp || profile?.phone || '');
                      setCustomerAddress('');
                      setDeliveryLocation(null);
                    }}
                    className="w-full text-left p-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50"
                  >
                    + Tambah Alamat Baru
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nama Lengkap</label>
                  <input
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 text-black bg-white ${
                      errors.name ? 'border-red-500 focus:ring-red-200' : 'border-gray-300 focus:ring-green-200'
                    }`}
                    placeholder="Contoh: Agus"
                  />
                  {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nomor WhatsApp</label>
                  <input
                    type="text"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 text-black bg-white ${
                      errors.phone ? 'border-red-500 focus:ring-red-200' : 'border-gray-300 focus:ring-green-200'
                    }`}
                    placeholder="Contoh: 081234567890"
                  />
                  {errors.phone && <p className="text-red-500 text-xs mt-1">{errors.phone}</p>}
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Metode Pengiriman</label>
              <div className="space-y-2">
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="delivery"
                    checked={deliveryMethod === 'pickup'}
                    onChange={() => setDeliveryMethod('pickup')}
                    className="mr-2"
                  />
                  <MapPin className="text-gray-600 mr-2" size={16} />
                  <span className="text-gray-900">Ambil di Toko</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="delivery"
                    checked={deliveryMethod === 'delivery'}
                    onChange={() => setDeliveryMethod('delivery')}
                    className="mr-2"
                  />
                  <Truck className="text-gray-600 mr-2" size={16} />
                  <span className="text-gray-900">Antar ke Alamat</span>
                </label>
              </div>
            </div>

            {deliveryMethod === 'delivery' && selectedAddressId === 'new' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Alamat Lengkap*</label>
                  <textarea
                    value={customerAddress}
                    onChange={(e) => setCustomerAddress(e.target.value)}
                    rows={3}
                    className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 text-black bg-white ${
                      errors.address ? 'border-red-500 focus:ring-red-200' : 'border-gray-300 focus:ring-green-200'
                    }`}
                    placeholder="Jl. Merdeka No. 123, Kediri"
                  />
                  {errors.address && <p className="text-red-500 text-xs mt-1">{errors.address}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Pilih Lokasi di Peta
                  </label>
                  <div className="relative h-64 rounded-lg overflow-hidden border border-gray-300">
                    {mapLoaded ? (
                      <div ref={mapRef} className="w-full h-full" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gray-50">
                        <div className="text-gray-500">Memuat peta...</div>
                      </div>
                    )}
                  </div>
                  {errors.location && <p className="text-red-500 text-xs mt-1">{errors.location}</p>}
                </div>

                {auth.currentUser && (
                  <button
                    onClick={handleSaveNewAddress}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded text-sm"
                  >
                    Simpan Alamat Ini
                  </button>
                )}
              </>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Metode Pembayaran</label>
              <div className="space-y-2">
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="payment"
                    checked={paymentMethod === 'cash'}
                    onChange={() => setPaymentMethod('cash')}
                    className="mr-2"
                  />
                  <CreditCard className="text-gray-600 mr-2" size={16} />
                  <span className="text-gray-900">Tunai (Cash)</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="payment"
                    checked={paymentMethod === 'transfer'}
                    onChange={() => setPaymentMethod('transfer')}
                    className="mr-2"
                  />
                  <span className="text-gray-900">Transfer Bank</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="payment"
                    checked={paymentMethod === 'qris'}
                    onChange={() => setPaymentMethod('qris')}
                    className="mr-2"
                  />
                  <span className="text-gray-900">QRIS (DANA/OVO/LinkAja)</span>
                </label>
              </div>
            </div>

            {(paymentMethod === 'transfer' || paymentMethod === 'qris') && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Upload Bukti Pembayaran
                </label>
                <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100">
                  {proofPreview ? (
                    <img src={proofPreview} alt="Preview" className="w-full h-full object-cover rounded" />
                  ) : (
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                      <Upload className="text-gray-400" size={24} />
                      <p className="text-sm text-gray-500 mt-2">Klik untuk upload gambar</p>
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
                  <p className="mt-2 text-sm text-gray-600">
                    File: {paymentProof.name} ({(paymentProof.size / 1024).toFixed(1)} KB)
                  </p>
                )}
                {errors.paymentProof && <p className="text-red-500 text-xs mt-1">{errors.paymentProof}</p>}
                {uploading && (
                  <p className="text-sm text-green-600 mt-2 flex items-center">
                    <CheckCircle size={16} className="mr-1" />
                    Mengupload...
                  </p>
                )}
                {proofUrl && !uploading && (
                  <p className="text-sm text-green-600 mt-2 flex items-center">
                    <CheckCircle size={16} className="mr-1" />
                    Berhasil diupload!
                  </p>
                )}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Catatan Tambahan (Opsional)</label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-200 text-black bg-white"
                placeholder="Contoh: Bel pintu sebelah kiri..."
              />
            </div>

            <div className="border-t pt-4 space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-600">Subtotal</span>
                <span className="font-medium">Rp{subtotal.toLocaleString('id-ID')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Ongkos Kirim</span>
                <span className="font-medium">
                  {shipping === 0 ? 'Gratis' : `Rp${shipping.toLocaleString('id-ID')}`}
                </span>
              </div>
              <div className="flex justify-between text-lg font-bold text-gray-900 pt-2 border-t">
                <span>Total</span>
                <span className="text-green-600">Rp{total.toLocaleString('id-ID')}</span>
              </div>
            </div>

            {/* ✅ TOMBOL AKSI: LIHAT / SIMPAN / KIRIM */}
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => {
                  // ✅ LIHAT: Preview struk di popup
                  const printWindow = window.open('', '_blank');
                  if (printWindow) {
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
                            padding: 5mm;
                            font-size: 12px;
                          }
                          .center { text-align: center; }
                          .item { display: flex; justify-content: space-between; margin: 2px 0; }
                          .bold { font-weight: bold; }
                        </style>
                      </head>
                      <body>
                        <div class="center">
                          <div class="bold">ATAYATOKO</div>
                          <div class="text-xs">Ecer & Grosir</div>
                          <div class="text-xs mt-1">${new Date().toLocaleString('id-ID')}</div>
                          <hr style="margin: 4px 0; border: 0; border-top: 1px dashed #000;">
                        </div>
                        
                        ${cart.map(item => `
                          <div class="item">
                            <span>${item.name}</span>
                            <span>${item.quantity} x Rp${(item.price * item.quantity).toLocaleString('id-ID')}</span>
                          </div>
                        `).join('')}
                        
                        <hr style="margin: 4px 0; border: 0; border-top: 1px dashed #000;">
                        <div class="item bold">
                          <span>TOTAL</span>
                          <span>Rp${total.toLocaleString('id-ID')}</span>
                        </div>
                        <div class="center mt-4 text-xs">
                          Terima kasih!<br>
                          Lengkap • Hemat • Terpercaya
                        </div>
                      </body>
                      </html>
                    `;
                    printWindow.document.write(receiptContent);
                    printWindow.document.close();
                  }
                }}
                className="bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded text-sm"
              >
                👁️ Lihat
              </button>

              <button
                onClick={handleDownloadPDF}
                className="bg-gray-800 hover:bg-black text-white py-2.5 rounded text-sm"
              >
                💾 Simpan
              </button>

              <button
                onClick={handleWhatsAppAndSave}
                disabled={isSubmitting || uploading}
                className="bg-green-600 hover:bg-green-700 text-white py-2.5 rounded text-sm disabled:bg-gray-400"
              >
                📲 Kirim
              </button>
            </div>

            <Link
              href="/"
              className="mt-2 w-full block text-center text-green-600 font-medium hover:text-green-700"
            >
              ← Lanjut Belanja
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}