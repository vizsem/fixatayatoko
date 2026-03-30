'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import NextImage from 'next/image';
import { auth, db, storage } from '@/lib/firebase';
import {
  CheckCircle2, ChevronLeft, Coins, CreditCard,
  Loader2, MapPin, Package, Send,
  Snowflake, Ticket, Upload, Plus, Minus, Trash2, ShoppingBag, Sparkles
} from 'lucide-react';


import { collection, doc, getDoc, query, where, getDocs, limit } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { onAuthStateChanged } from 'firebase/auth';
import { Toaster } from 'react-hot-toast';
import notify from '@/lib/notify';
import { CartItem, UserProfile, Voucher } from '@/lib/types';





// ... (Fungsi compressImage dan generateOrderId tetap sama seperti sebelumnya) ...
const compressImage = (file: File): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const result = event.target?.result;
      if (!result) {
        reject(new Error('File tidak valid'));
        return;
      }
      const img = new Image();
      img.onerror = () => reject(new Error('Gagal memuat gambar'));
      img.src = String(result);
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 800;
        const scaleSize = MAX_WIDTH / img.width;
        canvas.width = MAX_WIDTH;
        canvas.height = img.height * scaleSize;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Canvas empty')), 'image/jpeg', 0.7);
      };
    };
    reader.onerror = (error) => reject(error);
  });
};

// Order ID dihasilkan di server

export default function CartPage() {
  const router = useRouter();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [userData, setUserData] = useState<UserProfile | null>(null);
  const [unitsHydrated, setUnitsHydrated] = useState(false);



  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');





  const [deliveryMethod, setDeliveryMethod] = useState<'pickup' | 'delivery'>('pickup');
  const [courierType] = useState<'toko' | 'ojol' | 'ekspedisi'>('toko');


  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'transfer' | 'qris_bri' | 'wallet' | 'tempo'>('cash');
  const [tempoDueDate, setTempoDueDate] = useState<string>('');
  const [paymentProof, setPaymentProof] = useState<File | null>(null);
  const [proofPreview, setProofPreview] = useState<string | null>(null);
  const [useProfileShipping, setUseProfileShipping] = useState(true);
  const [selectedProfileAddressIndex, setSelectedProfileAddressIndex] = useState(0);

  // STATE POIN & VOUCHER
  const [usePoints, setUsePoints] = useState(false);
  const [useWallet, setUseWallet] = useState(false);
  const [voucherCode, setVoucherCode] = useState('');
  const [appliedVoucher, setAppliedVoucher] = useState<Voucher | null>(null);
  const [promoProduct, setPromoProduct] = useState<CartItem | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);

  const getItemId = (item: CartItem) => String(item.id || (item as any).ID || (item as any).productId || '');

  const getBaseUnit = (item: CartItem) => {
    const base = (item.baseUnit || (item as any).Satuan || item.unit || 'PCS') as string;
    return String(base || 'PCS').toUpperCase();
  };

  const getAvailableUnits = (item: CartItem) => {
    const raw = (item.units || (item as any).availableUnits || []) as Array<{ code: string; contains: number; price?: number }>;
    const baseUnit = getBaseUnit(item);
    const normalized = raw
      .map((u) => ({
        code: String(u.code || '').toUpperCase(),
        contains: Math.max(1, Math.floor(Number(u.contains || 1))),
        price: u.price,
      }))
      .filter((u) => u.code);
    const hasBase = normalized.some((u) => u.code === baseUnit);
    const list = hasBase ? normalized : [{ code: baseUnit, contains: 1 }, ...normalized];
    const uniq = new Map<string, { code: string; contains: number; price?: number }>();
    list.forEach((u) => {
      if (!uniq.has(u.code)) uniq.set(u.code, u);
    });
    return Array.from(uniq.values());
  };

  const normalizeCartItems = (items: CartItem[]) => {
    const mapped = items
      .map((i) => {
        const id = getItemId(i);
        const baseUnit = getBaseUnit(i);
        const unit = String((i.unit || baseUnit) as string).toUpperCase();
        const available = getAvailableUnits({ ...i, baseUnit, unit } as CartItem);
        const selected = available.find((u) => u.code === unit);
        const unitContains = Math.max(1, Math.floor(Number(i.unitContains || selected?.contains || 1)));
        const basePrice = Number(i.basePrice ?? (i as any).Ecer ?? i.price ?? 0);
        const unitPrice = i.unitPrice != null ? Number(i.unitPrice) : (selected?.price != null ? Number(selected.price) : basePrice * unitContains);

        if (i.promoType === 'TEBUS_MURAH') {
          return {
            ...i,
            id,
            baseUnit,
            unit: baseUnit,
            unitContains: 1,
            basePrice,
            unitPrice: 10000,
          } as CartItem;
        }

        return {
          ...i,
          id,
          baseUnit,
          unit,
          unitContains,
          basePrice,
          unitPrice,
          units: (i.units || (i as any).availableUnits) as any,
        } as CartItem;
      })
      .filter((i) => i.id);
    return mapped;
  };

  const persistCart = (nextCart: CartItem[]) => {
    setCart(nextCart);
    localStorage.setItem('cart', JSON.stringify(nextCart));
    window.dispatchEvent(new Event('cart-updated'));
  };

  const getBaseQuantity = (item: CartItem) => {
    const contains = Math.max(1, Math.floor(Number(item.unitContains || 1)));
    return Math.max(1, Math.floor(Number(item.quantity || 0))) * contains;
  };

  const getItemUnitPrice = (item: CartItem) => {
    if (item.promoType === 'TEBUS_MURAH') return 10000;

    const baseEcer = Number((item as any).Ecer ?? item.basePrice ?? item.price ?? 0);
    const baseGrosir = Number((item as any).Grosir ?? 0);
    const minGrosir = Number((item as any).Min_Grosir ?? 10);
    const baseQty = getBaseQuantity(item);
    const baseUnitPrice = baseGrosir > 0 && baseQty >= minGrosir ? baseGrosir : baseEcer;

    const unit = String(item.unit || getBaseUnit(item)).toUpperCase();
    const contains = Math.max(1, Math.floor(Number(item.unitContains || 1)));
    const unitConfig = getAvailableUnits(item).find((u) => u.code === unit);
    if (unitConfig?.price != null) return Number(unitConfig.price);
    return baseUnitPrice * contains;
  };

  const getLineTotal = (item: CartItem) => getItemUnitPrice(item) * Math.max(1, Math.floor(Number(item.quantity || 0)));

  const getWholesaleUpsellInfo = (item: CartItem) => {
    const contains = Math.max(1, Math.floor(Number(item.unitContains || 1)));
    const baseQty = getBaseQuantity(item);
    
    const baseEcer = Number((item as any).Ecer ?? item.basePrice ?? item.price ?? 0);
    const baseGrosir = Number((item as any).wholesalePrice ?? (item as any).Grosir ?? 0);
    const minGrosir = Number((item as any).minWholesale ?? (item as any).Min_Grosir ?? (item as any).minWholesaleQty ?? 0);

    if (baseGrosir <= 0 || minGrosir <= 1) return null;

    if (baseQty >= minGrosir) {
      const savings = (baseEcer - baseGrosir) * baseQty;
      return { isEligible: true, qtyNeeded: 0, savings, message: `🎉 Grosir Aktif (Hemat Rp${savings.toLocaleString('id-ID')})` };
    }

    if (baseQty >= Math.floor(minGrosir / 2)) {
      const sisaQty = minGrosir - baseQty;
      const potentialSavings = (baseEcer - baseGrosir) * minGrosir;
      return { isEligible: false, qtyNeeded: Math.ceil(sisaQty / contains), savings: potentialSavings, message: `Tambah ${Math.ceil(sisaQty / contains)} ${item.unit} lagi untuk Grosir. Hemat Rp${potentialSavings.toLocaleString('id-ID')}!` };
    }
    
    return null;
  };

  const updateQuantity = (itemId: string, nextQty: number) => {
    const q = Math.max(1, Math.floor(Number(nextQty || 1)));
    const next = cart.map((i) => {
      if (getItemId(i) !== itemId) return i;
      const contains = Math.max(1, Math.floor(Number(i.unitContains || 1)));
      const maxUnits = contains > 0 ? Math.max(1, Math.floor(Number(i.stock || 0) / contains)) : q;
      const safeQty = Math.min(q, maxUnits);
      if (q > maxUnits) notify.user.error(`Stok tidak cukup untuk ${i.unit}`);
      
      // Upsell Grosir check saat tambah barang
      if (q > i.quantity) {
        const baseQty = safeQty * contains;
        const minGrosir = Number((i as any).minWholesale ?? (i as any).Min_Grosir ?? (i as any).minWholesaleQty ?? 0);
        const baseEcer = Number((i as any).Ecer ?? i.basePrice ?? i.price ?? 0);
        const baseGrosir = Number((i as any).wholesalePrice ?? (i as any).Grosir ?? 0);
        
        // Munculkan notifikasi Upsell jika pembeli memasukkan jumlah nanggung (separuh dari target)
        if (minGrosir > 1 && baseGrosir > 0 && baseQty >= Math.floor(minGrosir / 2) && baseQty < minGrosir) {
          const sisaQty = minGrosir - baseQty;
          const saving = (baseEcer - baseGrosir) * minGrosir;
          notify.user.success(`Tanggung! Tambah ${Math.ceil(sisaQty / contains)} ${i.unit} lagi untuk harga Grosir. Hemat Rp${saving.toLocaleString('id-ID')}!`);
        } else if (minGrosir > 1 && baseGrosir > 0 && baseQty === minGrosir && i.quantity * contains < minGrosir) {
          // Notif saat Hore berhasil mencapai grosir
          notify.user.success(`Hore! Harga Grosir Aktif untuk ${i.name}`);
        }
      }

      return { ...i, quantity: safeQty };
    });
    persistCart(next);
  };

  const updateUnit = (itemId: string, nextUnit: string) => {
    const unitCode = String(nextUnit || '').toUpperCase();
    const next = cart.map((i) => {
      if (getItemId(i) !== itemId) return i;
      if (i.promoType === 'TEBUS_MURAH') return i;
      const available = getAvailableUnits(i);
      const selected = available.find((u) => u.code === unitCode) || { code: getBaseUnit(i), contains: 1 };
      const oldContains = Math.max(1, Math.floor(Number(i.unitContains || 1)));
      const oldBaseQty = Math.max(1, Math.floor(Number(i.quantity || 1))) * oldContains;
      const newContains = Math.max(1, Math.floor(Number(selected.contains || 1)));
      const newQty = Math.max(1, Math.ceil(oldBaseQty / newContains));
      const maxUnits = Math.max(1, Math.floor(Number(i.stock || 0) / newContains));
      const safeQty = Math.min(newQty, maxUnits);
      if (newQty > maxUnits) notify.user.error(`Stok tidak cukup untuk ${selected.code}`);
      return {
        ...i,
        unit: selected.code,
        unitContains: newContains,
        quantity: safeQty,
      };
    });
    persistCart(next);
  };

  const removeItem = (itemId: string) => {
    const next = cart.filter((i) => getItemId(i) !== itemId);
    persistCart(next);
  };

  // AUTO-FILL DATA DARI PROFIL USER
  useEffect(() => {
    if (userData) {
      // Isi nama jika belum diisi
      if (!customerName && userData.name) {
        setCustomerName(userData.name);
      }
      
      // Isi nomor HP jika belum diisi
      if (!customerPhone && userData.phone) {
        setCustomerPhone(userData.phone);
      }
      
      // Isi alamat jika belum diisi
      if (!customerAddress) {
        // Cek array addresses
        if (userData.addresses && userData.addresses.length > 0) {
          setCustomerAddress(userData.addresses[0]?.address || '');
        } 
        // Cek properti legacy 'address' (jika ada)
        else {
          const legacy = (userData as Partial<{ address: string }>).address;
          if (legacy) setCustomerAddress(legacy);
        }
      }
    }
  }, [userData, customerName, customerPhone, customerAddress]);

  const profileAddresses = useMemo(() => {
    if (!userData) return [] as Array<{ id: string; label: string; receiverName: string; receiverPhone: string; address: string }>;
    const list = Array.isArray(userData.addresses) ? userData.addresses.filter((a) => a && typeof a === 'object' && 'address' in a) : [];
    if (list.length > 0) return list as Array<{ id: string; label: string; receiverName: string; receiverPhone: string; address: string }>;
    const legacy = (userData as Partial<{ address: string }>).address;
    if (!legacy) return [];
    return [
      {
        id: 'legacy',
        label: 'Alamat',
        receiverName: userData.name || 'Penerima',
        receiverPhone: userData.phone || '',
        address: legacy,
      },
    ];
  }, [userData]);

  const selectedProfileAddress = profileAddresses[selectedProfileAddressIndex] || null;

  const effectiveCustomerName =
    useProfileShipping && deliveryMethod === 'delivery'
      ? (selectedProfileAddress?.receiverName || userData?.name || customerName)
      : (useProfileShipping && userData?.name ? userData.name : customerName);
  const effectiveCustomerPhone =
    useProfileShipping && deliveryMethod === 'delivery'
      ? (selectedProfileAddress?.receiverPhone || userData?.phone || customerPhone)
      : (useProfileShipping && userData?.phone ? userData.phone : customerPhone);
  const effectiveCustomerAddress =
    deliveryMethod === 'delivery'
      ? (useProfileShipping && selectedProfileAddress?.address ? selectedProfileAddress.address : customerAddress)
      : '';

  useEffect(() => {
    // Fetch Promo Product (Minyak atau produk lain untuk tebus murah)
    const fetchPromo = async () => {
       try {
         // OPTIMASI: Cari produk promo dengan stock > 0 dan status active
         const q = query(
           collection(db, 'products'), 
           where('Nama', '>=', 'Minyak'), 
           where('Nama', '<=', 'Minyak\uf8ff'),
           where('stock', '>', 0),
           where('status', '==', 'active'),
           limit(1)
         );
         const snap = await getDocs(q);
         if (!snap.empty) {
            const d = snap.docs[0].data();
            setPromoProduct({ id: snap.docs[0].id, ...d } as CartItem);
         } else {
            // Fallback: cari produk aktif dengan stock tersedia
            const q2 = query(
              collection(db, 'products'),
              where('stock', '>', 0),
              where('status', '==', 'active'),
              limit(1)
            );
            const snap2 = await getDocs(q2);
            if (!snap2.empty) {
               const d = snap2.docs[0].data();
               setPromoProduct({ id: snap2.docs[0].id, ...d } as CartItem);
            }
         }
       } catch (e) { console.log("Promo fetch error", e); }
    };
    fetchPromo();

    const fetchCombinedCart = async (uid: string | null) => {
      const localCart = JSON.parse(localStorage.getItem('cart') || '[]');
      let cloudItems: CartItem[] = [];

      const currentUid = uid || localStorage.getItem('temp_user_id');
      if (currentUid) {
        setUserId(currentUid);
        try {
          const cartSnap = await getDoc(doc(db, 'carts', currentUid));
          if (cartSnap.exists()) cloudItems = cartSnap.data().items || [];
          const userSnap = await getDoc(doc(db, 'users', currentUid));
          if (userSnap.exists()) setUserData(userSnap.data() as UserProfile);

        } catch { }

      }
      const merged = [...cloudItems];
      localCart.forEach((lItem: CartItem) => {
        const idToMatch = lItem.id || lItem.ID;
        const exists = merged.find(m => (m.id === idToMatch || m.ID === idToMatch));
        if (!exists) merged.push({ ...lItem });

      });
      const normalized = normalizeCartItems(merged);
      setCart(normalized);
      setIsLoaded(true);
    };

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const userSnap = await getDoc(doc(db, 'users', firebaseUser.uid));
        if (userSnap.exists()) {
          setUserData(userSnap.data() as UserProfile);
        }


        fetchCombinedCart(firebaseUser.uid);
      } else {
        fetchCombinedCart(null);
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!isLoaded || unitsHydrated) return;
    const idsToFetch = cart
      .filter((i) => !Array.isArray(i.units) || i.units.length === 0)
      .map((i) => getItemId(i))
      .filter(Boolean);
    const uniq = Array.from(new Set(idsToFetch));
    if (uniq.length === 0) {
      setUnitsHydrated(true);
      return;
    }
    (async () => {
      try {
        const snaps = await Promise.all(uniq.map((id) => getDoc(doc(db, 'products', id))));
        const byId = new Map<string, any>();
        snaps.forEach((s) => {
          if (s.exists()) byId.set(s.id, s.data());
        });
        const next = normalizeCartItems(cart.map((i) => {
          const id = getItemId(i);
          const data = byId.get(id);
          if (!data) return i;
          const units = (data.units || (data as any).availableUnits) as any;
          const baseUnit = String((data.unit || data.Satuan || i.baseUnit || i.unit || 'PCS') as string).toUpperCase();
          const basePrice = Number(data.Ecer ?? data.price ?? i.basePrice ?? i.price ?? 0);
          return { ...i, units, baseUnit, basePrice } as CartItem;
        }));
        setCart(next);
      } finally {
        setUnitsHydrated(true);
      }
    })();
  }, [isLoaded, unitsHydrated, cart]);

  const subtotal = cart.reduce((t, i) => t + getLineTotal(i), 0);

  const isGrosirTotal = cart.some(item => {
    const minGrosir = Number((item as any).Min_Grosir ?? 10);
    return getBaseQuantity(item) >= minGrosir;
  });


  // HITUNG DISKON POIN (Maks 50% dari Subtotal)
  const userPoints = userData?.points || 0;
  const isFrozen = userData?.isPointsFrozen || false;
  const maxRedeemable = subtotal * 0.5;
  const pointsToUse = usePoints ? Math.min(userPoints, maxRedeemable) : 0;

  // HITUNG DISKON VOUCHER
  const voucherDiscount = appliedVoucher ? appliedVoucher.value : 0;

  const walletBalance = userData?.walletBalance || 0;
  const baseTotal = Math.max(0, subtotal - pointsToUse - voucherDiscount);
  const walletToUse = useWallet ? Math.min(walletBalance, baseTotal) : 0;

  // TOTAL AKHIR
  const totalBayar = Math.max(0, baseTotal - walletToUse);

  // FUNGSI CEK VOUCHER
  const handleCheckVoucher = async () => {
    if (!voucherCode) return notify.user.error("Masukkan kode voucher!");
    if (!userId) return notify.user.error("Silakan login untuk menggunakan voucher");

    try {
      const q = query(collection(db, 'user_vouchers'),
        where('userId', '==', userId),
        where('code', '==', voucherCode.toUpperCase()),
        where('status', '==', 'ACTIVE')
      );
      const snap = await getDocs(q);

      if (snap.empty) {
        notify.user.error("Voucher tidak valid atau sudah digunakan");
      } else {
        const docSnap = snap.docs[0];
        const vData = { id: docSnap.id, ...docSnap.data() } as Voucher;

        setAppliedVoucher(vData);
        notify.user.success(`Voucher Berhasil: ${vData.name}`);

      }
    } catch {
      notify.user.error("Gagal memeriksa voucher");
    }
  };

  // Tambahkan ini di dalam fungsi CartPage, sebelum bagian return
  const validation = (() => {
    if (cart.length === 0) return { ok: false, msg: "Keranjang Kosong" };

    if (!String(effectiveCustomerName || '').trim()) return { ok: false, msg: "Nama wajib diisi" };
    if (!String(effectiveCustomerPhone || '').trim()) return { ok: false, msg: "WhatsApp wajib diisi" };
    if (deliveryMethod === 'delivery' && !String(effectiveCustomerAddress || '').trim()) return { ok: false, msg: "Alamat wajib diisi" };

    // Validasi Pengiriman
    if (deliveryMethod === 'delivery' && courierType === 'toko') {
      if (!isGrosirTotal && subtotal < 100000) {
        return { ok: false, msg: "Min. Belanja Kurir Toko 100rb" };
      }
    }

    // Jika semua oke
    return { ok: true, msg: "Siap dipesan" };
  })();
  const handleCheckout = async () => {
    if (!validation.ok) {
      notify.user.error(validation.msg);
      return;
    }

    // 1. Validasi Stok Sebelum Checkout
    for (const item of cart) {
      try {
        const prodId = getItemId(item);
        const productRef = doc(db, 'products', prodId);
        const productSnap = await getDoc(productRef);
        
        if (productSnap.exists()) {
          const productData = productSnap.data();
          const currentStock = productData.Stok || productData.stock || 0;
          const contains = Math.max(1, Math.floor(Number(item.unitContains || 1)));
          const baseQty = Math.max(1, Math.floor(Number(item.quantity || 0))) * contains;

          if (currentStock < baseQty) {
            // @ts-ignore
            notify.user.error(`Stok ${item.name || item.Nama} tidak cukup! Sisa: ${currentStock}`);
            return;
          }
        } else {
          // @ts-ignore
          notify.user.error(`Produk ${item.name || item.Nama} tidak ditemukan!`);
          return;
        }
      } catch (error) {
        console.error("Error checking stock:", error);
        notify.user.error("Gagal memvalidasi stok. Coba lagi.");
        return;
      }
    }

    const shouldUseWallet = useWallet || paymentMethod === 'wallet';

    if (!userId && (usePoints || shouldUseWallet || appliedVoucher)) {
      return notify.user.error("Silakan login untuk menggunakan poin, voucher, atau dompet.");
    }

    if (paymentMethod === 'transfer' && !paymentProof) {
      return notify.user.error("Upload bukti transfer!");
    }
    if (paymentMethod === 'tempo' && !tempoDueDate) return notify.user.error("Pilih tanggal jatuh tempo untuk pembayaran tempo!");
    if (paymentMethod === 'wallet' && (!userData || userData.walletBalance === undefined)) return notify.user.error("Dompet tidak tersedia!");
    if (paymentMethod === 'wallet' && userData && (userData.walletBalance || 0) < baseTotal) return notify.user.error("Saldo dompet tidak mencukupi!");
    
    setIsSubmitting(true);
    // const orderId = generateOrderId(); // Generated on server now

    try {
      let proofUrl = "";
      if (paymentProof && paymentMethod === 'transfer') {
        // Upload proof first (client-side upload is fine for now, URL passed to server)
        const compressed = await compressImage(paymentProof);
        // We need a temp ID for filename since we don't have orderId yet, or generate one client side just for filename
        const tempId = `proof-${Date.now()}`;
        const sRef = ref(storage, `payments/${tempId}`);
        const snap = await uploadBytes(sRef, compressed);
        proofUrl = await getDownloadURL(snap.ref);
      }

      // CALL SECURE API
      const response = await fetch('/api/orders/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: cart.map(item => ({
            id: item.id || item.ID,
            quantity: Math.max(1, Math.floor(Number(item.quantity || 0))),
            unit: String(item.unit || item.baseUnit || (item as any).Satuan || 'PCS').toUpperCase(),
            contains: Math.max(1, Math.floor(Number(item.unitContains || 1))),
            promoType: item.promoType,
          })),
          customer: {
            name: effectiveCustomerName,
            phone: effectiveCustomerPhone,
            address: effectiveCustomerAddress || customerAddress
          },
          delivery: {
            method: deliveryMethod,
            type: courierType,
            address: effectiveCustomerAddress || customerAddress
          },
          payment: {
            method: paymentMethod,
            proof: proofUrl
          },
          dueDate: paymentMethod === 'tempo' ? tempoDueDate : undefined,
          status: paymentMethod === 'tempo' ? 'BELUM_LUNAS' : undefined,
          userId: userId || undefined,
          voucherCode: appliedVoucher?.code,
          usePoints: Boolean(userId && usePoints),
          useWallet: Boolean(userId && shouldUseWallet)
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Gagal memproses pesanan');
      }

      if (paymentMethod === 'qris_bri') {
        await fetch('/api/payments/bri/qris', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderId: result.orderId }),
        }).catch(() => {});
      }

      localStorage.removeItem('cart');
      window.dispatchEvent(new Event('cart-updated'));
      router.push(`/success?id=${result.orderId}`);

    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Gagal memproses pesanan.';
      notify.user.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isLoaded) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 page-fade">
        <Loader2 className="animate-spin text-green-600 mb-3" size={28} />
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
          Memuat keranjang...
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-24 page-fade">
      <Toaster position="top-center" />
      <header className="bg-white/80 backdrop-blur-md p-4 shadow-sm flex items-center gap-4 sticky top-0 z-50 border-b">
        <button onClick={() => router.back()} className="p-2 hover:bg-slate-100 rounded-full transition-colors"><ChevronLeft /></button>
        <h1 className="font-black text-green-600 uppercase text-sm tracking-widest italic underline decoration-yellow-400">Checkout</h1>
        <div className="ml-auto">
          <NextImage src="/logo-atayatoko.png" alt="Logo" width={100} height={24} className="h-6 w-auto" />
        </div>
      </header>


      <main className="max-w-6xl mx-auto p-4 grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-5">

          {/* PROMO BANNER TEBUS MURAH */}
          {subtotal >= 50000 && promoProduct && !cart.some(i => i.promoType === 'TEBUS_MURAH') && (
            <div className="bg-gradient-to-r from-orange-500 to-red-600 rounded-[2rem] p-6 text-white shadow-lg relative overflow-hidden mb-6 animate-in slide-in-from-top-4">
               <div className="relative z-10 flex items-center justify-between">
                  <div className="flex-1 pr-4">
                    <span className="bg-white/20 px-3 py-1 rounded-full text-[9px] font-black uppercase mb-2 inline-block animate-pulse">🎉 Spesial Offer</span>
                    <h3 className="text-xl font-black uppercase tracking-tighter leading-none mb-1">Tebus Murah Cuma 10rb!</h3>
                    <p className="text-xs font-bold opacity-90 mb-4 line-clamp-1">{promoProduct.Nama || promoProduct.name} (Normal: Rp{(promoProduct.Ecer || promoProduct.price || 0).toLocaleString()})</p>
                    <button 
                      onClick={() => {
                        const baseUnit = String((promoProduct.Satuan || promoProduct.unit || 'PCS') as string).toUpperCase();
                        const newItem = { ...promoProduct, id: promoProduct.id, quantity: 1, promoType: 'TEBUS_MURAH', price: 10000, baseUnit, unit: baseUnit, unitContains: 1, unitPrice: 10000, basePrice: 10000 } as CartItem;
                        const newCart = normalizeCartItems([...cart, newItem]);
                        persistCart(newCart);
                        notify.user.success('Promo berhasil diambil!');
                      }}
                      className="bg-white text-red-600 px-6 py-2.5 rounded-xl text-[10px] font-black uppercase shadow-xl active:scale-95 transition-all hover:bg-gray-100"
                    >
                      Ambil Sekarang
                    </button>
                  </div>
                  <div className="w-20 h-20 bg-white rounded-2xl p-1 rotate-6 shadow-2xl flex-shrink-0">
                     <NextImage src={promoProduct.Link_Foto || promoProduct.image || '/logo-atayatoko.png'} width={100} height={100} className="w-full h-full object-cover rounded-xl" alt="" />
                  </div>
               </div>
               <div className="absolute -right-4 -bottom-10 opacity-10 rotate-12">
                 <Package size={140} />
               </div>
            </div>
          )}

          {/* CART ITEMS (Tampilan ringkas) */}
          <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-slate-100">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-black flex items-center gap-2 text-[10px] tracking-widest uppercase text-slate-400">
                <ShoppingBag size={16} /> Keranjang
              </h2>
              <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                {cart.length} item
              </div>
            </div>

            <div className="space-y-4">
              {cart.length === 0 ? (
                <div className="bg-slate-50 rounded-2xl p-10 text-center border border-dashed border-slate-200">
                  <p className="text-sm font-black text-slate-800">Keranjang masih kosong</p>
                  <p className="text-xs font-bold text-slate-400 mt-1">Yuk belanja dulu.</p>
                </div>
              ) : (
                cart.map((item) => {
                  const itemId = getItemId(item);
                  const unit = String(item.unit || getBaseUnit(item)).toUpperCase();
                  const contains = Math.max(1, Math.floor(Number(item.unitContains || 1)));
                  const units = getAvailableUnits(item);
                  const maxUnits = contains > 0 ? Math.max(1, Math.floor(Number(item.stock || 0) / contains)) : item.quantity;

                  return (
                    <div key={itemId} className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm">
                      <div className="flex gap-4">
                        <NextImage
                          src={item.Link_Foto || item.image || '/logo-atayatoko.png'}
                          alt={item.Nama || item.name || 'Produk'}
                          width={64}
                          height={64}
                          className="w-16 h-16 rounded-2xl object-cover border border-slate-100"
                        />

                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-black uppercase leading-tight line-clamp-2">
                            {item.Nama || item.name}
                          </p>
                          <div className="mt-1 text-[10px] font-bold text-slate-400 flex flex-wrap gap-x-3 gap-y-1">
                            <span>Stok: {Number(item.stock || 0).toLocaleString('id-ID')} {getBaseUnit(item)}</span>
                            <span>Subtotal: Rp {getLineTotal(item).toLocaleString('id-ID')}</span>
                          </div>

                          <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div className="bg-slate-50 rounded-2xl p-3 border border-slate-100">
                              <div className="text-[9px] font-black uppercase tracking-widest text-slate-400">Satuan</div>
                              <select
                                value={unit}
                                disabled={item.promoType === 'TEBUS_MURAH'}
                                onChange={(e) => updateUnit(itemId, e.target.value)}
                                className="mt-2 w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-black text-slate-800 outline-none disabled:opacity-60"
                              >
                                {units.map((u) => (
                                  <option key={u.code} value={u.code}>
                                    {u.code} ({u.contains})
                                  </option>
                                ))}
                              </select>
                              <div className="mt-1 text-[10px] font-bold text-slate-400">
                                Harga: Rp {getItemUnitPrice(item).toLocaleString('id-ID')} / {unit}
                              </div>
                            </div>

                            <div className="bg-slate-50 rounded-2xl p-3 border border-slate-100">
                              <div className="text-[9px] font-black uppercase tracking-widest text-slate-400">Qty</div>
                              <div className="mt-2 flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => updateQuantity(itemId, Number(item.quantity || 1) - 1)}
                                  className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center hover:bg-slate-100 active:scale-95 transition-all"
                                >
                                  <Minus size={16} />
                                </button>
                                <input
                                  type="number"
                                  min={1}
                                  max={maxUnits}
                                  value={item.quantity}
                                  onChange={(e) => updateQuantity(itemId, Number(e.target.value || 1))}
                                  className="flex-1 h-10 bg-white border border-slate-200 rounded-xl px-3 text-xs font-black text-center outline-none"
                                />
                                <button
                                  type="button"
                                  onClick={() => updateQuantity(itemId, Number(item.quantity || 1) + 1)}
                                  className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center hover:bg-slate-100 active:scale-95 transition-all"
                                >
                                  <Plus size={16} />
                                </button>
                              </div>
                              <div className="mt-1 text-[10px] font-bold text-slate-400">
                                Setara: {getBaseQuantity(item).toLocaleString('id-ID')} {getBaseUnit(item)}
                              </div>
                            </div>

                            <div className="bg-slate-50 rounded-2xl p-3 border border-slate-100">
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <div className="text-[9px] font-black uppercase tracking-widest text-slate-400">Total</div>
                                  <div className="mt-2 text-sm font-black text-slate-900">
                                    Rp {getLineTotal(item).toLocaleString('id-ID')}
                                  </div>
                                  {item.promoType === 'TEBUS_MURAH' && (
                                    <div className="mt-1 text-[10px] font-black text-rose-600 uppercase tracking-widest">Promo</div>
                                  )}
                                </div>
                                <button
                                  type="button"
                                  onClick={() => removeItem(itemId)}
                                  className="p-2 rounded-xl bg-white border border-slate-200 text-slate-500 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 transition-colors"
                                  title="Hapus"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </div>
                  </div>
                  
                  {/* TAMPILAN UPSELL GROSIR PSIKOLOGIS */}
                  {(() => {
                    const upsell = getWholesaleUpsellInfo(item);
                    if (!upsell) return null;

                    return (
                      <div className={`mt-3 p-3 rounded-xl flex items-start gap-2 ${
                        upsell.isEligible 
                          ? 'bg-green-50 border border-green-100 text-green-700' 
                          : 'bg-orange-50 border border-orange-100 text-orange-700'
                      }`}>
                        <div className="mt-0.5">
                          {upsell.isEligible ? <CheckCircle2 size={14} /> : <Sparkles size={14} />}
                        </div>
                        <div className="flex-1">
                          <p className="text-[10px] font-bold leading-tight">{upsell.message}</p>
                          {!upsell.isEligible && (
                            <button 
                              onClick={() => updateQuantity(item.id, item.quantity + upsell.qtyNeeded)}
                              className="mt-1.5 text-[9px] font-black uppercase bg-white px-2 py-1 rounded-lg border shadow-sm hover:bg-orange-50 active:scale-95 transition-all"
                            >
                              + Tambah {upsell.qtyNeeded} {item.unit}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })()}

                </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* WIDGET POIN & VOUCHER (Kombinasi Baru) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Box Poin */}
            <div className={`p-6 rounded-[2rem] border-2 transition-all ${usePoints ? 'bg-blue-50 border-blue-200 shadow-lg shadow-blue-100' : 'bg-white border-slate-100'}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`p-3 rounded-2xl ${isFrozen ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}`}>
                    {isFrozen ? <Snowflake size={20} /> : <Coins size={20} />}
                  </div>
                  <div>
                    <h3 className="text-[9px] font-black uppercase tracking-widest text-slate-400">Saldo Poin</h3>
                    <p className="text-sm font-black italic">{userPoints.toLocaleString()}</p>
                  </div>
                </div>
                {!isFrozen && userId && (
                  <button onClick={() => setUsePoints(!usePoints)} className={`w-12 h-6 rounded-full transition-all relative ${usePoints ? 'bg-blue-600 shadow-inner' : 'bg-slate-200'}`}>
                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${usePoints ? 'left-7' : 'left-1'}`} />
                  </button>
                )}
              </div>
              {isFrozen && <p className="text-[8px] font-black text-red-500 uppercase italic mt-3">* Poin dibekukan Admin</p>}
            </div>

            {/* Box Input Voucher */}
            <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100">
              <div className="flex items-center gap-3 mb-3 text-slate-400">
                <Ticket size={20} />
                <span className="text-[9px] font-black uppercase tracking-widest">Gunakan Voucher</span>
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="KODE..."
                  value={voucherCode}
                  onChange={(e) => setVoucherCode(e.target.value.toUpperCase())}
                  className="flex-1 bg-slate-50 border border-slate-100 p-3 rounded-xl text-xs font-black uppercase outline-none focus:ring-2 focus:ring-green-400"
                />
                <button onClick={handleCheckVoucher} className="bg-black text-white px-4 rounded-xl text-[10px] font-black uppercase transition-transform active:scale-90">CEK</button>
              </div>
              {appliedVoucher && (
                <div className="mt-2 bg-emerald-50 p-2 rounded-xl flex items-center justify-between border border-emerald-100">
                  <span className="text-[8px] font-black text-emerald-600 uppercase">🎟️ {appliedVoucher.name}</span>
                  <button onClick={() => setAppliedVoucher(null)} className="text-[8px] font-black text-rose-500">BATAL</button>
                </div>
              )}
            </div>
          </div>

          <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-2xl bg-emerald-100 text-emerald-600">
                  <CreditCard size={20} />
                </div>
                <div>
                  <h3 className="text-[9px] font-black uppercase tracking-widest text-slate-400">Dompet Digital</h3>
                  <p className="text-sm font-black italic">
                    Rp{walletBalance.toLocaleString()}
                  </p>
                </div>
              </div>
              {userId && walletBalance > 0 && (
                <button
                  onClick={() => setUseWallet(!useWallet)}
                  className={`w-12 h-6 rounded-full transition-all relative ${useWallet ? 'bg-emerald-600 shadow-inner' : 'bg-slate-200'}`}
                >
                  <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${useWallet ? 'left-7' : 'left-1'}`} />
                </button>
              )}
            </div>
            {(!userId || walletBalance <= 0) && (
              <p className="text-[8px] font-black text-slate-400 uppercase italic mt-3">
                {userId ? 'Belum ada saldo dompet yang bisa digunakan' : 'Login untuk menggunakan saldo dompet'}
              </p>
            )}
          </div>

          {/* INFORMASI PENGIRIMAN (Form Ringkas) */}
          <div className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-slate-100 space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2"><MapPin size={16} /> Tujuan Pengantaran</h3>
              {userData && (
                <button
                  type="button"
                  onClick={() => setUseProfileShipping((v) => !v)}
                  className="text-[9px] font-black uppercase tracking-widest text-emerald-700 bg-emerald-50 border border-emerald-100 px-3 py-2 rounded-xl hover:bg-emerald-100 transition-colors"
                >
                  {useProfileShipping ? 'Ubah' : 'Pakai Profil'}
                </button>
              )}
            </div>

            <div className="flex bg-slate-100 p-1.5 rounded-2xl gap-1">
              <button onClick={() => setDeliveryMethod('pickup')} className={`flex-1 py-3 rounded-xl text-[9px] font-black uppercase ${deliveryMethod === 'pickup' ? 'bg-white shadow-md text-green-600' : 'text-slate-400'}`}>Ambil Sendiri</button>
              <button onClick={() => setDeliveryMethod('delivery')} className={`flex-1 py-3 rounded-xl text-[9px] font-black uppercase ${deliveryMethod === 'delivery' ? 'bg-white shadow-md text-green-600' : 'text-slate-400'}`}>Kirim Ke Rumah</button>
            </div>

            {useProfileShipping && userData ? (
              <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100 space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <p className="text-[9px] font-black uppercase text-slate-400">Nama</p>
                    <p className="text-xs font-black text-slate-800">{effectiveCustomerName || '-'}</p>
                  </div>
                  <div>
                    <p className="text-[9px] font-black uppercase text-slate-400">WhatsApp</p>
                    <p className="text-xs font-black text-slate-800">{effectiveCustomerPhone || '-'}</p>
                  </div>
                </div>

                {deliveryMethod === 'delivery' && (
                  <div>
                    <p className="text-[9px] font-black uppercase text-slate-400 mb-2">Alamat</p>
                    {profileAddresses.length > 1 ? (
                      <select
                        value={selectedProfileAddressIndex}
                        onChange={(e) => setSelectedProfileAddressIndex(Number(e.target.value || 0))}
                        className="w-full bg-white p-4 rounded-2xl text-xs font-black outline-none border border-slate-200"
                      >
                        {profileAddresses.map((a, idx) => (
                          <option key={idx} value={idx}>
                            {`${a.label || 'Alamat'} - ${a.receiverName || 'Penerima'}`}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <div className="bg-white border border-slate-200 rounded-2xl p-4 text-xs font-black text-slate-700">
                        {selectedProfileAddress?.address || 'Alamat profil belum ada'}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase text-slate-400 ml-2">Nama</label>
                    <input value={customerName} onChange={e => setCustomerName(e.target.value)} className="w-full bg-slate-50 p-4 rounded-2xl text-xs font-black outline-none border border-slate-50 focus:bg-white focus:border-green-400" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase text-slate-400 ml-2">WhatsApp</label>
                    <input value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} className="w-full bg-slate-50 p-4 rounded-2xl text-xs font-black outline-none border border-slate-50 focus:bg-white focus:border-green-400" />
                  </div>
                </div>

                {deliveryMethod === 'delivery' && (
                  <textarea placeholder="Tulis alamat lengkap Anda..." value={customerAddress} onChange={e => setCustomerAddress(e.target.value)} className="w-full p-5 bg-slate-50 rounded-[1.5rem] text-xs font-black h-28 outline-none border border-slate-50 focus:bg-white focus:border-green-400" />
                )}
              </>
            )}
          </div>
        </div>

        {/* SIDEBAR PAYMENT & TOTAL */}
        <div className="space-y-5">
          <div className="bg-white rounded-[2.5rem] p-8 shadow-2xl border border-slate-100 sticky top-24">
            <h2 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-6 flex items-center gap-2"><CreditCard size={18} /> Metode Bayar</h2>
            <div className="grid grid-cols-1 gap-2 mb-8">
              {([
                { key: 'cash', label: 'Tunai' },
                { key: 'transfer', label: 'Transfer' },
                { key: 'qris_bri', label: 'QRIS (BRI)' },
                { key: 'wallet', label: 'Dompet' },
                { key: 'tempo', label: 'Tempo' },
              ] as const).map(m => (
                <button
                  key={m.key}
                  onClick={() => {
                    setPaymentMethod(m.key);
                    setPaymentProof(null);
                    setProofPreview(null);
                  }}
                  className={`p-4 border-2 rounded-2xl text-left transition-all flex items-center justify-between ${paymentMethod === m.key ? 'border-green-600 bg-green-50 text-green-700' : 'border-slate-50 bg-slate-50 text-slate-400'}`}
                >
                  <span className="text-[10px] font-black uppercase">{m.label}</span>
                  {paymentMethod === m.key && <CheckCircle2 size={16} />}
                </button>
              ))}
            </div>

            {paymentMethod === 'transfer' && (
              <label className="block bg-slate-50 border-2 border-dashed border-slate-200 rounded-3xl p-4 text-center cursor-pointer mb-8">
                {proofPreview ? (
                  <NextImage src={proofPreview} alt="Bukti Transfer" width={200} height={128} className="h-32 mx-auto rounded-xl object-contain" />
                ) : (
                  <div className="py-4">
                    <Upload size={20} className="mx-auto text-slate-400 mb-2" />
                    <span className="text-[9px] font-black uppercase text-slate-400">Bukti Transfer</span>
                  </div>
                )}
                <input type="file" hidden accept="image/*" onChange={e => {
                  const file = e.target.files?.[0];
                  if (file) { setPaymentProof(file); setProofPreview(URL.createObjectURL(file)); }
                }} />
              </label>
            )}

            {paymentMethod === 'qris_bri' && (
              <div className="bg-emerald-50 border-2 border-emerald-200 rounded-3xl p-4 mb-8">
                <p className="text-[10px] font-black uppercase text-emerald-700 mb-1">QRIS (BRI) Otomatis</p>
                <p className="text-[10px] text-emerald-700/80">Setelah konfirmasi, QR akan dibuat otomatis dan muncul di halaman sukses.</p>
              </div>
            )}

            {paymentMethod === 'tempo' && (
              <div className="bg-amber-50 border-2 border-amber-200 rounded-3xl p-4 mb-8">
                <p className="text-[10px] font-black uppercase text-amber-700 mb-2">Pembayaran Tempo</p>
                <p className="text-[10px] text-amber-700/80 mb-3">Transaksi akan dicatat sebagai piutang. Tentukan tanggal jatuh tempo.</p>
                <label className="text-[9px] font-black uppercase text-amber-700 ml-1 mb-1 block">Jatuh Tempo</label>
                <input
                  type="date"
                  value={tempoDueDate}
                  onChange={(e) => setTempoDueDate(e.target.value)}
                  className="w-full bg-white p-4 rounded-2xl text-xs font-black outline-none border border-amber-200 focus:border-amber-400"
                />
              </div>
            )}

            {paymentMethod === 'wallet' && userData && (
              <div className="bg-blue-50 border-2 border-blue-200 rounded-3xl p-4 text-center mb-8">
                <p className="text-[10px] font-black text-blue-700 uppercase">Saldo Dompet</p>
                <p className="text-lg font-black text-blue-700">Rp{(userData.walletBalance || 0).toLocaleString()}</p>
                <p className="text-[10px] text-blue-600">Total dibayar: Rp{baseTotal.toLocaleString()}</p>
                {(userData.walletBalance || 0) >= baseTotal ? (
                  <p className="text-[10px] text-green-600 font-bold">✓ Saldo mencukupi</p>
                ) : (
                  <p className="text-[10px] text-red-600 font-bold">✗ Saldo tidak mencukupi</p>
                )}
              </div>
            )}

            <div className="space-y-3 pt-6 border-t border-slate-50">
              <div className="flex justify-between text-[10px] font-black uppercase text-slate-400">
                <span>Subtotal</span>
                <span>Rp{subtotal.toLocaleString()}</span>
              </div>
              {pointsToUse > 0 && (
                <div className="flex justify-between text-[10px] font-black uppercase text-blue-600 italic">
                  <span>- Diskon Poin</span>
                  <span>Rp{pointsToUse.toLocaleString()}</span>
                </div>
              )}
              {voucherDiscount > 0 && (
                <div className="flex justify-between text-[10px] font-black uppercase text-emerald-600 italic">
                  <span>- Voucher</span>
                  <span>Rp{voucherDiscount.toLocaleString()}</span>
                </div>
              )}
              {walletToUse > 0 && (
                <div className="flex justify-between text-[10px] font-black uppercase text-emerald-600 italic">
                  <span>- Dompet</span>
                  <span>Rp{walletToUse.toLocaleString()}</span>
                </div>
              )}
              <div className="flex justify-between items-end pt-4">
                <span className="text-[11px] font-black uppercase italic">Total Akhir</span>
                <span className="text-3xl font-black text-green-600 italic tracking-tighter shadow-green-100 drop-shadow-sm">Rp{totalBayar.toLocaleString()}</span>
              </div>
            </div>

            <button
              onClick={handleCheckout}
              disabled={isSubmitting}
              className="w-full bg-green-600 text-white py-5 rounded-[2rem] font-black mt-8 shadow-xl shadow-green-200 disabled:bg-slate-200 disabled:shadow-none transition-all flex items-center justify-center gap-3 uppercase text-xs"
            >
              {isSubmitting ? <Loader2 className="animate-spin" size={20} /> : <Send size={18} />}
              {isSubmitting ? "Processing..." : "Konfirmasi & Bayar"}
            </button>
            <div className={`mt-3 text-center text-[9px] font-black uppercase tracking-widest ${validation.ok ? 'text-emerald-600' : 'text-rose-600'}`}>
              {validation.msg}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
