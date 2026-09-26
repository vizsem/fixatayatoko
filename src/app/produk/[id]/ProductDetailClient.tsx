'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { 
  ArrowLeft, Heart, ShoppingCart, Plus, Minus, Loader2, Sparkles, Info, ShieldCheck, Truck,
  Star, MessageSquare, ChevronRight, Zap, Package, Tag, Clock
} from 'lucide-react';
import Link from 'next/link';
import { addToWishlist, getWishlist } from '@/lib/wishlist';
import toast, { Toaster } from 'react-hot-toast';
import { ProductSkeleton } from '@/components/home/ProductSkeleton';
import CustomerGuarantees from '@/components/common/CustomerGuarantees';
import { supabase } from '@/lib/supabase';

import { addDoc, auth, collection, db, doc, getDoc, getDocs, onAuthStateChanged, orderBy, query, setDoc } from '@/lib/firebase';
export type Review = {
  id: string;
  userId: string;
  userName: string;
  rating: number;
  comment: string;
  createdAt: { toDate?: () => Date; seconds?: number } | Date | null;
};

export type Product = {
  id: string;
  name: string;
  price: number;
  wholesalePrice: number;
  minWholesale: number;
  stock: number;
  unit: string;
  category: string;
  image: string;
  description?: string;
  units?: {
    code: string;
    price: number;
    wholesalePrice: number;
    minWholesale: number;
    contains: number;
  }[];
};

export type RelatedProduct = Pick<Product, 'id' | 'name' | 'price' | 'image'>;

type CartItem = {
  productId: string;
  id: string;
  name: string;
  price: number;
  image?: string;
  unit: string;
  quantity: number;
  wholesalePrice?: number;
  minWholesale?: number;
  addedAt?: string;
};

interface ProductDetailClientProps {
  initialProduct: Product | null;
  initialRelatedProducts: RelatedProduct[];
  initialReviews: Review[];
}

export default function ProductDetailClient({ 
  initialProduct, 
  initialRelatedProducts, 
  initialReviews 
}: ProductDetailClientProps) {
  const router = useRouter();
  const [product] = useState<Product | null>(initialProduct);
  const [relatedProducts] = useState<RelatedProduct[]>(initialRelatedProducts);
  const [reviews, setReviews] = useState<Review[]>(initialReviews);
  const [loading, setLoading] = useState(!initialProduct);
  const [inWishlist, setInWishlist] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [selectedUnit, setSelectedUnit] = useState<string>(product?.unit || 'pcs');
  const [userId, setUserId] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [userRating, setUserRating] = useState(0);
  const [userComment, setUserComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);

  useEffect(() => {
    if (product?.unit) setSelectedUnit(product.unit);
  }, [product?.unit]);

  const getProxiedImage = (url: string) => {
    if (!url || url.includes('firebasestorage.googleapis.com') || url.includes('supabase.co') || url.startsWith('data:') || url.startsWith('/')) {
      return url || '/logo-atayatoko.png';
    }
    return `https://wsrv.nl/?url=${encodeURIComponent(url)}&w=800&output=webp`;
  };

  const hasToDate = (x: any): x is { toDate: () => Date } => {
    return !!x && typeof (x as { toDate?: () => Date }).toDate === 'function';
  };

  const formatReviewDate = (input: any) => {
    try {
      if (hasToDate(input)) return new Date(input.toDate()).toLocaleDateString('id-ID');
      if (input?.seconds) return new Date(input.seconds * 1000).toLocaleDateString('id-ID');
      if (input instanceof Date) return input.toLocaleDateString('id-ID');
      if (typeof input === 'string') return new Date(input).toLocaleDateString('id-ID');
    } catch {}
    return 'Baru saja';
  };

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      const id = u?.uid || localStorage.getItem('temp_user_id') || '';
      if (!id) return;
      try { localStorage.setItem('temp_user_id', id); } catch {}
      setUserId(id);
    });
    if (product) {
      const wl = getWishlist();
      setInWishlist(wl.includes(product.id));
    }
    setLoading(false);
    return () => unsub();
  }, [product]);

  const syncToFirebaseCart = async (p: Product, q: number, redirectToCart = false) => {
    if (p.stock <= 0) { toast.error('Maaf, stok barang sedang habis'); return false; }
    setIsAdding(true);
    const localCart = JSON.parse(localStorage.getItem('cart') || '[]') as CartItem[];
    const idToMatch = p.id;
    const hasWholesale = p.wholesalePrice > 0 && p.wholesalePrice < p.price;
    const isWholesale = hasWholesale && q >= p.minWholesale;
    let finalPrice = isWholesale ? p.wholesalePrice : p.price;
    let unitCode = p.unit;
    let conversionFactor = 1;
    if (p.units && selectedUnit !== p.unit) {
      const targetUnit = p.units.find(u => u.code === selectedUnit);
      if (targetUnit) {
        finalPrice = targetUnit.price;
        unitCode = targetUnit.code;
        conversionFactor = targetUnit.contains;
        if (targetUnit.wholesalePrice > 0 && targetUnit.wholesalePrice < targetUnit.price && q >= targetUnit.minWholesale) {
          finalPrice = targetUnit.wholesalePrice;
        }
      }
    }
    const localIdx = localCart.findIndex(item => item.productId === idToMatch && item.unit === unitCode);
    if (q * conversionFactor > p.stock) {
      toast.error(`Stok tidak mencukupi! Sisa stok: ${p.stock} ${p.unit}`);
      setIsAdding(false);
      return false;
    }
    if (localIdx > -1) {
      localCart[localIdx].quantity += q;
      localCart[localIdx].price = finalPrice;
    } else {
      localCart.push({ productId: idToMatch, id: idToMatch, name: p.name, price: finalPrice, image: p.image, unit: unitCode, quantity: q, wholesalePrice: p.wholesalePrice, minWholesale: p.minWholesale });
    }
    localStorage.setItem('cart', JSON.stringify(localCart));
    window.dispatchEvent(new Event('cart-updated'));
    if (userId) {
      try {
        const cartRef = doc(db, 'carts', userId);
        const cartSnap = await getDoc(cartRef);
        const cloudItems = (cartSnap.exists() ? (cartSnap.data().items as CartItem[]) : []) ?? [];
        const existingIndex = cloudItems.findIndex(item => item.productId === idToMatch && item.unit === unitCode);
        if (existingIndex > -1) { cloudItems[existingIndex].quantity += q; cloudItems[existingIndex].price = finalPrice; }
        else { cloudItems.push({ productId: idToMatch, id: idToMatch, name: p.name, price: finalPrice, image: p.image, unit: unitCode, quantity: q, addedAt: new Date().toISOString() }); }
        await setDoc(doc(db, 'carts', userId), { userId, items: cloudItems, updatedAt: new Date().toISOString() }, { merge: true });
      } catch (err) { console.error(err); }
    }
    setIsAdding(false);
    if (redirectToCart) { router.push('/cart'); } else { toast.success(`${p.name} (${q} ${unitCode}) ditambah ke keranjang`); }
    return true;
  };

  const handleSubmitReview = async () => {
    if (!(await supabase.auth.getUser()).data.user) return toast.error('Silakan login untuk memberikan ulasan');
    if (userRating === 0) return toast.error('Silakan pilih bintang rating');
    if (!userComment.trim()) return toast.error('Silakan tulis ulasan Anda');
    if (!product) return;
    setSubmittingReview(true);
    try {
      const currentUser = (await supabase.auth.getUser()).data.user;
      if (!currentUser) return toast.error('Silakan login terlebih dahulu');
      await addDoc(collection(db, 'products', product.id, 'reviews'), {
        userId: currentUser.id,
        userName: currentUser.user_metadata?.full_name || (currentUser as any).displayName || currentUser.email?.split('@')[0] || 'Pengguna',
        rating: userRating, comment: userComment, createdAt: new Date().toISOString()
      });
      toast.success('Terima kasih! Ulasan berhasil dikirim.');
      setUserComment(''); setUserRating(0);
      const reviewsQ = query(collection(db, 'products', product.id, 'reviews'), orderBy('createdAt', 'desc'));
      const reviewSnap = await getDocs(reviewsQ);
      setReviews(reviewSnap.docs.map(d => ({ id: d.id, ...d.data() } as Review)));
    } catch (err) { console.error(err); toast.error('Gagal mengirim ulasan'); }
    finally { setSubmittingReview(false); }
  };

  const handleQuantity = (type: 'plus' | 'minus') => {
    if (type === 'plus') setQuantity(prev => prev + 1);
    if (type === 'minus' && quantity > 1) setQuantity(prev => prev - 1);
  };

  if (loading || !product) return <ProductSkeleton />;

  const isOutOfStock = product.stock <= 0;
  let currentPrice = product.price;
  let currentWholesalePrice = product.wholesalePrice;
  let currentMinWholesale = product.minWholesale;
  let currentUnit = product.unit;
  if (product.units && selectedUnit !== product.unit) {
    const targetUnit = product.units.find(u => u.code === selectedUnit);
    if (targetUnit) { currentPrice = targetUnit.price; currentWholesalePrice = targetUnit.wholesalePrice; currentMinWholesale = targetUnit.minWholesale; currentUnit = targetUnit.code; }
  }
  const isWholesaleEligible = currentWholesalePrice > 0 && quantity >= currentMinWholesale;
  const displayPrice = isWholesaleEligible ? currentWholesalePrice : currentPrice;
  const wholesaleProgress = Math.min((quantity / (currentMinWholesale || 12)) * 100, 100);
  const ratingLabels = ['', 'Sangat Buruk', 'Buruk', 'Cukup', 'Bagus', 'Sangat Bagus'];

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-40 md:pb-16">
      <Toaster position="top-center" toastOptions={{ style: { fontWeight: 700, fontSize: '13px' } }} />

      {/* HEADER */}
      <header className="bg-white/90 backdrop-blur-md sticky top-0 z-50 border-b border-slate-100 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-3.5 flex items-center justify-between">
          <button onClick={() => router.back()} className="p-2.5 bg-slate-100 hover:bg-slate-200 rounded-2xl active:scale-90 transition-all text-slate-700" aria-label="Kembali">
            <ArrowLeft size={20} />
          </button>
          <div className="flex flex-col items-center">
            <Link href="/" className="leading-none mb-0.5">
              <span className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-900 hover:text-emerald-600 transition-colors">ATAYATOKO</span>
            </Link>
            <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">Detail Produk</span>
          </div>
          <Link href="/cart" className="p-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-2xl transition-all" aria-label="Keranjang">
            <ShoppingCart size={20} />
          </Link>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 pt-5">
        {/* BREADCRUMB */}
        <nav className="flex items-center gap-1.5 text-xs font-medium text-slate-400 mb-6 overflow-x-auto whitespace-nowrap pb-1 scrollbar-hide">
          <Link href="/" className="hover:text-emerald-600 transition-colors shrink-0">Beranda</Link>
          <ChevronRight size={14} className="text-slate-300 shrink-0" />
          <Link href={`/kategori?name=${encodeURIComponent(product.category)}`} className="hover:text-emerald-600 transition-colors shrink-0">{product.category}</Link>
          <ChevronRight size={14} className="text-slate-300 shrink-0" />
          <span className="text-slate-700 font-semibold truncate max-w-[180px] md:max-w-md">{product.name}</span>
        </nav>

        {/* MAIN GRID */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-10">
          {/* LEFT: Product Image */}
          <div className="relative">
            <div className="aspect-square rounded-3xl md:rounded-[2.5rem] overflow-hidden bg-white border border-slate-100 shadow-lg relative">
              <img
                src={getProxiedImage(product.image)}
                alt={product.name}
                className={`w-full h-full object-cover transition-all duration-500 ${isOutOfStock ? 'grayscale opacity-40' : ''}`}
                onError={(e) => {
                  const t = e.currentTarget as HTMLImageElement;
                  if (!t.dataset.fallbackTried) { t.dataset.fallbackTried = 'true'; t.src = product.image; }
                  else { t.src = '/logo-atayatoko.png'; }
                }}
              />
              {isOutOfStock && (
                <div className="absolute inset-0 flex items-center justify-center bg-slate-900/40 backdrop-blur-[2px]">
                  <span className="bg-red-600 text-white px-6 py-2.5 rounded-full font-black uppercase text-xs tracking-wider shadow-lg">Stok Habis</span>
                </div>
              )}
              <div className="absolute top-4 left-4">
                <span className="bg-white/90 backdrop-blur text-emerald-700 text-[11px] font-black uppercase tracking-wider px-3 py-1.5 rounded-xl border border-emerald-100 shadow-sm">{product.category}</span>
              </div>
            </div>
            <button
              onClick={() => { addToWishlist(product.id); setInWishlist(!inWishlist); }}
              className={`absolute top-4 right-4 p-3 backdrop-blur shadow-lg rounded-2xl active:scale-75 transition-all border ${inWishlist ? 'bg-red-50 border-red-200 text-red-500' : 'bg-white/90 border-slate-200 text-slate-400 hover:text-red-400 hover:border-red-200'}`}
              title="Tambah ke Wishlist"
            >
              <Heart size={20} className={inWishlist ? 'fill-current' : ''} />
            </button>
          </div>

          {/* RIGHT: Product Info */}
          <div className="flex flex-col gap-5">
            {/* Name & Stock */}
            <div>
              <div className="flex items-center gap-2 mb-3 flex-wrap">
                <span className={`text-xs font-bold px-3 py-1 rounded-lg border ${isOutOfStock ? 'bg-red-50 text-red-600 border-red-100' : 'bg-emerald-50 text-emerald-700 border-emerald-100'}`}>
                  Stok: {product.stock.toLocaleString('id-ID')} {product.unit}
                </span>
                {!isOutOfStock && <span className="text-xs font-bold bg-blue-50 text-blue-700 border border-blue-100 px-3 py-1 rounded-lg">Tersedia</span>}
              </div>
              <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight leading-tight mb-1">{product.name}</h1>
              <p className="text-sm text-slate-500 font-medium">
                Harga per <span className="font-bold text-slate-700">{currentUnit}</span>
                {isOutOfStock && <span className="text-red-500 font-bold ml-2">• Sedang Kosong</span>}
              </p>
            </div>

            {/* PRICE CARD */}
            <div className={`rounded-3xl p-5 md:p-6 border transition-all duration-500 ${isWholesaleEligible ? 'bg-gradient-to-br from-orange-500 to-orange-600 border-orange-600 shadow-xl shadow-orange-500/20' : 'bg-white border-slate-200 shadow-sm'}`}>
              {/* Unit Selection */}
              {product.units && product.units.length > 0 && product.units.some(u => u.code !== product.unit) && (
                <div className="mb-5 flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                  <button onClick={() => setSelectedUnit(product.unit)} className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wide transition-all whitespace-nowrap ${selectedUnit === product.unit ? 'bg-emerald-600 text-white shadow-md' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                    {product.unit} (Ecer)
                  </button>
                  {product.units.filter(u => u.code !== product.unit).map(u => (
                    <button key={u.code} onClick={() => setSelectedUnit(u.code)} className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wide transition-all whitespace-nowrap ${selectedUnit === u.code ? 'bg-emerald-600 text-white shadow-md' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                      {u.code} <span className="opacity-70">(@{u.contains} {product.unit})</span>
                    </button>
                  ))}
                </div>
              )}

              {/* Price Display */}
              <div className="flex flex-col mb-4">
                <span className={`text-xs font-bold uppercase tracking-wider mb-1 ${isWholesaleEligible ? 'text-orange-100' : 'text-slate-500'}`}>
                  {isWholesaleEligible ? '✨ Harga Grosir Aktif' : 'Harga Eceran'}
                </span>
                <div className="flex items-end gap-2 flex-wrap">
                  <span className={`text-3xl md:text-4xl font-black tracking-tight ${isWholesaleEligible ? 'text-white' : 'text-slate-900'}`}>
                    Rp{displayPrice.toLocaleString('id-ID')}
                  </span>
                  <span className={`text-base font-semibold mb-0.5 ${isWholesaleEligible ? 'text-orange-200' : 'text-slate-400'}`}>/{currentUnit}</span>
                </div>
              </div>

              {/* Wholesale Info */}
              {currentWholesalePrice > 0 && currentWholesalePrice < currentPrice ? (
                <div className={`pt-4 border-t border-dashed ${isWholesaleEligible ? 'border-orange-400' : 'border-slate-200'}`}>
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className={`text-xs font-black uppercase ${isWholesaleEligible ? 'text-white' : 'text-slate-700'}`}>Harga Grosir</p>
                      <p className={`text-xs mt-0.5 ${isWholesaleEligible ? 'text-orange-100' : 'text-slate-500'}`}>Min. beli {currentMinWholesale} {currentUnit}</p>
                    </div>
                    <span className={`text-xl font-black ${isWholesaleEligible ? 'text-white' : 'text-slate-900'}`}>Rp{currentWholesalePrice.toLocaleString('id-ID')}</span>
                  </div>
                  {!isWholesaleEligible && (
                    <div>
                      <div className="bg-slate-200 h-2 rounded-full overflow-hidden">
                        <div className="bg-emerald-500 h-full rounded-full transition-all duration-700" style={{ width: `${wholesaleProgress}%` }} />
                      </div>
                      <p className="mt-2 text-xs font-bold text-emerald-700 flex items-center gap-1">
                        <Sparkles size={12} /> Tambah {Math.max(0, (currentMinWholesale || 12) - quantity)} lagi untuk harga grosir!
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div className={`pt-4 border-t border-dashed ${isWholesaleEligible ? 'border-orange-400' : 'border-slate-200'} flex items-center gap-2 ${isWholesaleEligible ? 'text-orange-100' : 'text-slate-500'} text-xs font-medium`}>
                  <ShieldCheck size={15} className="shrink-0 text-emerald-600" />
                  <span>Jaminan 100% Produk Asli &amp; Harga Langsung Distributor</span>
                </div>
              )}

              {/* Desktop Action Buttons */}
              <div className="hidden md:flex flex-col mt-5 pt-5 border-t border-dashed border-slate-200/60 gap-4">
                <div className="flex items-center gap-4">
                  <span className="text-sm font-bold text-slate-600">Jumlah:</span>
                  <div className="flex items-center bg-slate-100 rounded-2xl p-1 border border-slate-200">
                    <button onClick={() => handleQuantity('minus')} className="p-2.5 text-slate-600 hover:bg-white hover:shadow rounded-xl transition-all" aria-label="Kurangi"><Minus size={16} /></button>
                    <span className="w-12 text-center font-black text-base text-slate-900">{quantity}</span>
                    <button onClick={() => handleQuantity('plus')} className="p-2.5 text-slate-600 hover:bg-white hover:shadow rounded-xl transition-all" aria-label="Tambah"><Plus size={16} /></button>
                  </div>
                  <span className="text-xs text-slate-500 font-medium">= Rp{(displayPrice * quantity).toLocaleString('id-ID')}</span>
                </div>
                <div className="flex gap-2.5">
                  <button onClick={() => syncToFirebaseCart(product, quantity, false)} disabled={isOutOfStock || isAdding} className={`flex-1 py-3.5 rounded-2xl font-black uppercase tracking-wider text-sm transition-all flex items-center justify-center gap-2 shadow-md active:scale-[0.98] ${isOutOfStock ? 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none' : isAdding ? 'bg-slate-800 text-white opacity-80' : 'bg-slate-900 text-white hover:bg-slate-800'}`}>
                    {isAdding ? <Loader2 size={18} className="animate-spin" /> : <ShoppingCart size={18} />}
                    {isOutOfStock ? 'Stok Habis' : '+ Keranjang'}
                  </button>
                  <button onClick={() => syncToFirebaseCart(product, quantity, true)} disabled={isOutOfStock || isAdding} className={`flex-1 py-3.5 rounded-2xl font-black uppercase tracking-wider text-sm transition-all flex items-center justify-center gap-2 active:scale-[0.98] ${isOutOfStock ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-lg shadow-emerald-600/20'}`}>
                    <Zap size={18} className="fill-current" /> Beli Sekarang
                  </button>
                  <button onClick={() => { addToWishlist(product.id); setInWishlist(!inWishlist); }} className={`p-3.5 rounded-2xl border transition-all ${inWishlist ? 'border-red-200 bg-red-50 text-red-500' : 'border-slate-200 bg-white text-slate-400 hover:border-red-200 hover:text-red-500'}`} title="Favorit">
                    <Heart size={20} className={inWishlist ? 'fill-current' : ''} />
                  </button>
                </div>
              </div>
            </div>

            {/* INFO CARDS */}
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Satuan Jual', val: currentUnit || 'PCS', icon: Package, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-100' },
                { label: 'Min. Grosir', val: `${currentMinWholesale || 12} ${currentUnit || 'PCS'}`, icon: Tag, color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-100' },
                { label: 'Pengiriman', val: 'Kediri Kota', icon: Truck, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100' },
                { label: 'Kondisi', val: 'Baru / Segel', icon: ShieldCheck, color: 'text-slate-600', bg: 'bg-slate-50', border: 'border-slate-200' },
              ].map((item, idx) => (
                <div key={idx} className={`${item.bg} ${item.border} border p-4 rounded-2xl flex items-center gap-3`}>
                  <div className="p-2 bg-white rounded-xl shadow-sm shrink-0">
                    <item.icon size={16} className={item.color} />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-500 uppercase block tracking-wider leading-none mb-1">{item.label}</span>
                    <span className="text-xs font-black text-slate-800 uppercase leading-tight">{item.val}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* DESCRIPTION */}
            <div className="bg-white rounded-3xl border border-slate-100 p-5 shadow-sm">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-600 mb-3 flex items-center gap-2">
                <Info size={14} className="text-emerald-600" /> Deskripsi Produk
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                {product.description || `${product.name} kualitas terbaik untuk kebutuhan sehari-hari Anda. Melayani pembelian ecer dan partai besar (grosir) dengan harga kompetitif langsung dari distributor.`}
              </p>
            </div>

            {/* CUSTOMER GUARANTEES */}
            <CustomerGuarantees variant="compact" className="mt-1" />
          </div>
        </div>

        {/* REVIEWS */}
        <div className="mt-12 mb-10">
          <h2 className="text-base font-black uppercase tracking-wider text-slate-800 mb-6 flex items-center gap-2">
            <MessageSquare size={18} className="text-orange-500" />
            Ulasan &amp; Rating
            <span className="text-xs font-bold bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full ml-1">{reviews.length}</span>
          </h2>
          <div className="bg-white rounded-3xl border border-slate-100 p-5 md:p-6 shadow-sm mb-5">
            <h4 className="text-sm font-black text-slate-800 mb-4">Tulis Ulasan Anda</h4>
            <div className="flex items-center gap-2 mb-4">
              {[1, 2, 3, 4, 5].map(star => (
                <button key={star} onClick={() => setUserRating(star)} className="focus:outline-none transition-transform active:scale-90 hover:scale-110">
                  <Star size={28} className={star <= userRating ? 'fill-yellow-400 text-yellow-400' : 'text-slate-200 hover:text-yellow-300'} />
                </button>
              ))}
              {userRating > 0 && <span className="ml-2 text-sm font-bold text-yellow-600">{ratingLabels[userRating]}</span>}
            </div>
            <textarea
              value={userComment}
              onChange={e => setUserComment(e.target.value)}
              placeholder="Bagikan pengalaman Anda tentang produk ini..."
              className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-sm font-medium text-slate-800 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all mb-4 h-28 resize-none leading-relaxed"
            />
            <button onClick={handleSubmitReview} disabled={submittingReview} className="bg-slate-900 text-white px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider hover:bg-emerald-600 transition-colors disabled:bg-slate-300">
              {submittingReview ? 'Mengirim...' : 'Kirim Ulasan'}
            </button>
          </div>
          <div className="space-y-3">
            {reviews.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-3xl border border-dashed border-slate-200">
                <MessageSquare size={32} className="text-slate-300 mx-auto mb-2" />
                <p className="text-sm text-slate-400 font-bold">Belum ada ulasan</p>
                <p className="text-xs text-slate-400 mt-1">Jadilah yang pertama memberikan ulasan</p>
              </div>
            ) : reviews.map(rev => (
              <div key={rev.id} className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
                <div className="mb-3">
                  <span className="text-sm font-black text-slate-800 block">{rev.userName}</span>
                  <div className="flex items-center gap-1.5 mt-1">
                    <div className="flex gap-0.5">{[...Array(5)].map((_, i) => <Star key={i} size={12} className={i < rev.rating ? 'fill-yellow-400 text-yellow-400' : 'text-slate-200'} />)}</div>
                    <span className="text-[11px] text-slate-400 flex items-center gap-1"><Clock size={11} /> {formatReviewDate(rev.createdAt)}</span>
                  </div>
                </div>
                <p className="text-sm text-slate-600 leading-relaxed">{rev.comment}</p>
              </div>
            ))}
          </div>
        </div>

        {/* RELATED PRODUCTS */}
        {relatedProducts.length > 0 && (
          <div className="mt-4 mb-12">
            <h2 className="text-base font-black uppercase tracking-wider text-slate-800 mb-5 px-1 flex items-center gap-2">
              <Sparkles size={18} className="text-amber-500" /> Produk Lainnya
            </h2>
            <div className="flex overflow-x-auto gap-4 pb-6 scrollbar-hide snap-x">
              {relatedProducts.map(item => (
                <div key={item.id} className="min-w-[150px] md:min-w-[180px] snap-start group cursor-pointer">
                  <Link href={`/produk/${item.id}`}>
                    <div className="aspect-square rounded-2xl md:rounded-3xl overflow-hidden bg-white border border-slate-100 shadow-sm group-hover:shadow-lg group-hover:-translate-y-1 transition-all duration-300 mb-3">
                      <img src={getProxiedImage(item.image)} alt={item.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" />
                    </div>
                    <div className="px-1">
                      <h3 className="text-xs font-bold text-slate-800 line-clamp-2 leading-snug group-hover:text-emerald-600 transition-colors mb-1">{item.name}</h3>
                      <p className="text-sm font-black text-emerald-600">Rp{item.price.toLocaleString('id-ID')}</p>
                    </div>
                  </Link>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* MOBILE FLOATING BOTTOM BAR */}
      <div className="md:hidden fixed bottom-4 left-0 right-0 z-[90] px-4 pointer-events-none">
        <div className="max-w-lg mx-auto pointer-events-auto">
          <div className="bg-white/95 backdrop-blur-xl border border-slate-200/80 p-2.5 rounded-3xl shadow-[0_8px_40px_rgba(0,0,0,0.15)] flex items-center gap-2">
            <div className="flex items-center bg-slate-100 rounded-2xl p-1 shrink-0 border border-slate-200">
              <button onClick={() => handleQuantity('minus')} className="w-8 h-8 flex items-center justify-center text-slate-600 active:scale-75 transition-all" aria-label="Kurangi"><Minus size={15} /></button>
              <span className="w-8 text-center font-black text-sm text-slate-900">{quantity}</span>
              <button onClick={() => handleQuantity('plus')} className="w-8 h-8 flex items-center justify-center text-slate-600 active:scale-75 transition-all" aria-label="Tambah"><Plus size={15} /></button>
            </div>
            <button onClick={() => syncToFirebaseCart(product, quantity, false)} disabled={isAdding || isOutOfStock} className="flex-1 bg-slate-900 text-white py-3 rounded-2xl font-black text-xs uppercase tracking-wide flex items-center justify-center gap-1.5 active:scale-95 transition-all shadow-sm disabled:bg-slate-200 disabled:text-slate-400">
              {isAdding ? <Loader2 className="animate-spin" size={14} /> : <><ShoppingCart size={14} /> + Keranjang</>}
            </button>
            <button onClick={() => syncToFirebaseCart(product, quantity, true)} disabled={isAdding || isOutOfStock} className="flex-1 bg-emerald-600 text-white py-3 rounded-2xl font-black text-xs uppercase tracking-wide flex items-center justify-center gap-1.5 active:scale-95 transition-all shadow-md shadow-emerald-600/20 disabled:bg-slate-200 disabled:text-slate-400">
              <Zap size={14} className="fill-current" /> Beli
            </button>
          </div>
        </div>
      </div>

      <style jsx global>{`
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .no-scrollbar::-webkit-scrollbar { display: none; }
      `}</style>
    </div>
  );
}
