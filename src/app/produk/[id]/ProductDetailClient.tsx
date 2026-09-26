'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { 
  ArrowLeft, Heart, ShoppingCart, Plus, Minus, Loader2, Sparkles, Info, ShieldCheck, Truck,
  Star, MessageSquare, ChevronRight, Zap
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
    contains: number; // conversion factor, e.g., 12 for 1 DOZ
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
  
  const [loading, setLoading] = useState(!initialProduct); // Only load if no initial data
  const [inWishlist, setInWishlist] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [selectedUnit, setSelectedUnit] = useState<string>(product?.unit || 'pcs');
  const [userId, setUserId] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);

  useEffect(() => {
    if (product?.unit) setSelectedUnit(product.unit);
  }, [product?.unit]);
  
  // Review States
  const [userRating, setUserRating] = useState(0);
  const [userComment, setUserComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);

  // ✅ PROXY GAMBAR Agar Gambar Supplier Muncul
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
      if (hasToDate(input)) {
        return new Date(input.toDate()).toLocaleDateString('id-ID');
      }
      if (input && input.seconds) {
         return new Date(input.seconds * 1000).toLocaleDateString('id-ID');
      }
      if (input && input instanceof Date) {
        return input.toLocaleDateString('id-ID');
      }
      if (typeof input === 'string') {
        return new Date(input).toLocaleDateString('id-ID');
      }
    } catch {}
    return 'Baru saja';
  };

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      const id = u?.uid || localStorage.getItem('temp_user_id') || '';
      if (!id) return;
      try {
        localStorage.setItem('temp_user_id', id);
      } catch {}
      setUserId(id);
    });

    if (product) {
        const wishlist = getWishlist();
        setInWishlist(wishlist.includes(product.id));
    }
    
    setLoading(false);
    return () => unsub();
  }, [product]);

  const syncToFirebaseCart = async (p: Product, q: number, redirectToCart = false) => {
    if (p.stock <= 0) {
      toast.error("Maaf, stok barang sedang habis");
      return false;
    }

    setIsAdding(true);
    const localCart = JSON.parse(localStorage.getItem('cart') || '[]') as CartItem[];
    const idToMatch = p.id;
    
    // Determine current price and unit
    const hasWholesale = p.wholesalePrice > 0 && p.wholesalePrice < p.price;
    const isWholesale = hasWholesale && q >= p.minWholesale;
    let finalPrice = isWholesale ? p.wholesalePrice : p.price;
    let unitCode = p.unit;
    let conversionFactor = 1;

    // Check if a different unit is selected
    if (p.units && selectedUnit !== p.unit) {
        const targetUnit = p.units.find(u => u.code === selectedUnit);
        if (targetUnit) {
            finalPrice = targetUnit.price;
            unitCode = targetUnit.code;
            conversionFactor = targetUnit.contains;
            
            // Check wholesale for custom unit
            if (targetUnit.wholesalePrice > 0 && targetUnit.wholesalePrice < targetUnit.price && q >= targetUnit.minWholesale) {
                finalPrice = targetUnit.wholesalePrice;
            }
        }
    }

    // Check existing quantity in cart
    const localIdx = localCart.findIndex((item) => (item.productId === idToMatch && item.unit === unitCode));
    
    // Calculate total stock needed in base unit
    let totalRequestedBaseQty = q * conversionFactor;
    
    if (totalRequestedBaseQty > p.stock) {
      toast.error(`Stok tidak mencukupi! Sisa stok: ${p.stock} ${p.unit}`);
      setIsAdding(false);
      return false;
    }

    if (localIdx > -1) {
      localCart[localIdx].quantity += q;
      localCart[localIdx].price = finalPrice;
    } else {
      localCart.push({ 
        productId: idToMatch, id: idToMatch, name: p.name, price: finalPrice, 
        image: p.image, unit: unitCode, quantity: q,
        wholesalePrice: p.wholesalePrice, minWholesale: p.minWholesale
      });
    }

    localStorage.setItem('cart', JSON.stringify(localCart));
    window.dispatchEvent(new Event('cart-updated'));

    if (userId) {
      try {
        const cartRef = doc(db, 'carts', userId);
        const cartSnap = await getDoc(cartRef);
        const cloudItems = (cartSnap.exists() ? (cartSnap.data().items as CartItem[]) : []) ?? [];
        
        // Find item with same product ID AND unit
        const existingIndex = cloudItems.findIndex((item) => item.productId === idToMatch && item.unit === unitCode);
        
        if (existingIndex > -1) {
          cloudItems[existingIndex].quantity += q;
          cloudItems[existingIndex].price = finalPrice;
        } else {
          cloudItems.push({
            productId: idToMatch, id: idToMatch, name: p.name, price: finalPrice, 
            image: p.image, unit: unitCode, quantity: q, addedAt: new Date().toISOString()
          });
        }
        await setDoc(cartRef, { userId, items: cloudItems, updatedAt: new Date().toISOString() }, { merge: true });
      } catch (error) { 
        console.error(error); 
      }
    }

    setIsAdding(false);
    if (redirectToCart) {
      router.push('/cart');
    } else {
      toast.success(`${p.name} (${q} ${unitCode}) ditambah ke keranjang`);
    }
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
        rating: userRating,
        comment: userComment,
        createdAt: new Date().toISOString()
      });
      toast.success('Terima kasih! Ulasan berhasil dikirim.');
      setUserComment('');
      setUserRating(0);
      
      // Refresh reviews
      const reviewsQ = query(collection(db, 'products', product.id, 'reviews'), orderBy('createdAt', 'desc'));
      const reviewSnap = await getDocs(reviewsQ);
      setReviews(reviewSnap.docs.map(d => ({ id: d.id, ...d.data() } as Review)));
    } catch (error) {
      console.error(error);
      toast.error('Gagal mengirim ulasan');
    } finally {
      setSubmittingReview(false);
    }
  };

  const handleQuantity = (type: 'plus' | 'minus') => {
    if (type === 'plus') setQuantity(prev => prev + 1);
    if (type === 'minus' && quantity > 1) setQuantity(prev => prev - 1);
  };

  if (loading || !product) return <ProductSkeleton />;

  const isOutOfStock = product.stock <= 0;
  
  // Calculate price based on selected unit
  let currentPrice = product.price;
  let currentWholesalePrice = product.wholesalePrice;
  let currentMinWholesale = product.minWholesale;
  let currentUnit = product.unit;

  if (product.units && selectedUnit !== product.unit) {
    const targetUnit = product.units.find(u => u.code === selectedUnit);
    if (targetUnit) {
      currentPrice = targetUnit.price;
      currentWholesalePrice = targetUnit.wholesalePrice;
      currentMinWholesale = targetUnit.minWholesale;
      currentUnit = targetUnit.code;
    }
  }

  const isWholesaleEligible = currentWholesalePrice > 0 && quantity >= currentMinWholesale;
  const displayPrice = isWholesaleEligible ? currentWholesalePrice : currentPrice;

  return (
    <div className="min-h-screen bg-white pb-40">
      <Toaster position="top-center" />
      
      <header className="bg-white/80 backdrop-blur-md sticky top-0 z-50 border-b border-gray-100 px-4 py-3.5 flex items-center justify-between">
          <button onClick={() => router.back()} className="p-2.5 bg-gray-50 hover:bg-gray-100 rounded-2xl active:scale-90 transition-all text-gray-700">
            <ArrowLeft size={20}/>
          </button>
          <div className="flex flex-col items-center">
            <Link href="/" className="leading-none mb-1">
              <span className="text-[10px] font-black uppercase tracking-[0.25em] text-gray-400 hover:text-green-600 transition-colors cursor-pointer">ATAYAMARKET</span>
            </Link>
            <span className="text-[10px] font-bold text-green-700 uppercase tracking-wider">Detail Produk</span>
          </div>
          <Link href="/cart" className="p-2.5 bg-green-50 hover:bg-green-100 text-green-700 rounded-2xl relative transition-all">
            <ShoppingCart size={20} />
          </Link>
      </header>

      <div className="max-w-5xl mx-auto px-4 pt-4">
        {/* BREADCRUMB */}
        <nav className="flex items-center gap-1.5 text-[11px] font-semibold text-gray-400 mb-5 overflow-x-auto whitespace-nowrap pb-1 no-scrollbar">
          <Link href="/" className="hover:text-green-700 transition-colors">Beranda</Link>
          <ChevronRight size={13} className="text-gray-300 shrink-0" />
          <Link href={`/kategori?name=${encodeURIComponent(product.category)}`} className="hover:text-green-700 transition-colors">
            {product.category}
          </Link>
          <ChevronRight size={13} className="text-gray-300 shrink-0" />
          <span className="text-gray-800 font-bold truncate max-w-[200px] md:max-w-md">{product.name}</span>
        </nav>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
          <div className="relative">
            <div className="aspect-square rounded-[2.5rem] md:rounded-[3.5rem] overflow-hidden bg-gray-50 border border-gray-100 shadow-xl relative">
              <img 
                src={getProxiedImage(product.image)} 
                alt={product.name} 
                className={`w-full h-full object-cover ${isOutOfStock ? 'grayscale opacity-50' : ''}`}
                onError={(e) => {
                  const target = e.currentTarget as HTMLImageElement;
                  if (target.src !== product.image && product.image && !target.dataset.fallbackTried) {
                    target.dataset.fallbackTried = 'true';
                    target.src = product.image;
                  } else {
                    target.src = '/logo-atayatoko.png';
                  }
                }}
              />
              {isOutOfStock && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/30 backdrop-blur-[2px]">
                  <span className="bg-red-600 text-white px-6 py-2.5 rounded-full font-black uppercase text-xs tracking-wider shadow-lg">Stok Habis</span>
                </div>
              )}
            </div>
            <button 
              onClick={() => { addToWishlist(product.id); setInWishlist(!inWishlist); }} 
              className="absolute top-5 right-5 p-3.5 bg-white/95 backdrop-blur shadow-xl rounded-full active:scale-75 transition-all border border-gray-100"
              title="Tambah ke Wishlist"
            >
              <Heart size={20} className={inWishlist ? 'fill-red-500 text-red-500' : 'text-gray-400 hover:text-red-400'} />
            </button>
          </div>

          <div className="flex flex-col">
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-3 flex-wrap">
                <span className="text-[10px] font-black text-green-700 uppercase tracking-widest bg-green-50 px-3 py-1.5 rounded-lg inline-block border border-green-100">
                  {product.category}
                </span>
                <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg inline-block ${
                  isOutOfStock ? 'bg-red-50 text-red-600 border border-red-100' : 'bg-blue-50 text-blue-700 border border-blue-100'
                }`}>
                  Stok: {product.stock} {product.unit}
                </span>
              </div>
              <h1 className="text-3xl md:text-4xl lg:text-5xl font-black text-gray-900 uppercase tracking-tight leading-[1.05] mb-2">{product.name}</h1>
              <p className="text-gray-400 text-[10px] font-bold uppercase tracking-widest flex items-center gap-2">
                HARGA PER {currentUnit} {isOutOfStock && <span className="text-red-500 font-black">• SEDANG KOSONG</span>}
              </p>
            </div>

            <div className={`rounded-[2.5rem] p-7 md:p-8 mb-8 border transition-all duration-500 ${isWholesaleEligible ? 'bg-orange-600 text-white border-orange-700 shadow-xl scale-[1.01]' : 'bg-gray-50/80 border-gray-200/70 shadow-sm'}`}>
              {/* Unit Selection */}
              {product.units && product.units.length > 0 && product.units.some(u => u.code !== product.unit) && (
                <div className="mb-6 flex gap-2 overflow-x-auto pb-2 no-scrollbar">
                  <button
                    onClick={() => setSelectedUnit(product.unit)}
                    className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${selectedUnit === product.unit ? 'bg-green-600 text-white shadow-md' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-100'}`}
                  >
                    {product.unit} (Utama)
                  </button>
                  {product.units.filter(u => u.code !== product.unit).map((u) => (
                    <button
                      key={u.code}
                      onClick={() => setSelectedUnit(u.code)}
                      className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${selectedUnit === u.code ? 'bg-green-600 text-white shadow-md' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-100'}`}
                    >
                      {u.code} (@{u.contains} {product.unit})
                    </button>
                  ))}
                </div>
              )}

              <div className="flex flex-col mb-4">
                <span className={`text-[10px] font-black uppercase tracking-widest mb-1 ${isWholesaleEligible ? 'text-orange-100' : 'text-gray-500'}`}>
                  {isWholesaleEligible ? '✨ Harga Grosir Aktif' : 'Harga Terbaik'}
                </span>
                <div className="flex items-end gap-2">
                  <span className="text-4xl md:text-5xl font-black tracking-tighter">
                    Rp{displayPrice.toLocaleString('id-ID')}
                  </span>
                  <span className={`text-base md:text-lg font-bold mb-1.5 ${isWholesaleEligible ? 'text-orange-200' : 'text-gray-400'}`}>/{currentUnit}</span>
                </div>
              </div>

              {/* Tampilkan bagian grosir HANYA jika ada harga grosir yang valid (< harga eceran) */}
              {currentWholesalePrice > 0 && currentWholesalePrice < currentPrice ? (
                <div className={`pt-4 border-t border-dashed ${isWholesaleEligible ? 'border-orange-400' : 'border-gray-200'}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col">
                      <span className={`text-[11px] font-black uppercase italic ${isWholesaleEligible ? 'text-white' : 'text-blue-700'}`}>Harga Grosir</span>
                      <span className={`text-[10px] ${isWholesaleEligible ? 'text-orange-100' : 'text-gray-500'}`}>Min. Beli {currentMinWholesale} {currentUnit}</span>
                    </div>
                    <div className="text-right">
                      <span className={`text-xl font-black ${isWholesaleEligible ? 'text-white' : 'text-gray-900'}`}>
                        Rp{currentWholesalePrice.toLocaleString('id-ID')}
                      </span>
                    </div>
                  </div>
                  
                  {!isWholesaleEligible && (
                    <div className="mt-4">
                      <div className="bg-gray-200 h-2 rounded-full overflow-hidden p-0.5">
                        <div 
                          className="bg-blue-600 h-full rounded-full transition-all duration-700 shadow-[0_0_10px_rgba(37,99,235,0.3)]" 
                          style={{ width: `${Math.min((quantity / (currentMinWholesale || 12)) * 100, 100)}%` }}
                        ></div>
                      </div>
                      <p className="mt-2 text-[9px] font-black text-blue-700 uppercase flex items-center gap-1">
                        <Sparkles size={11} /> Tambah {Math.max(0, (currentMinWholesale || 12) - quantity)} lagi untuk aktifkan grosir!
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="pt-3 border-t border-dashed border-gray-200 flex items-center gap-2 text-gray-500 text-[11px] font-semibold">
                  <ShieldCheck size={16} className="text-green-600 shrink-0" />
                  <span>Jaminan 100% Produk Asli & Harga Hemat Langsung Distributor</span>
                </div>
              )}

              {/* ACTION BUTTONS UNTUK DESKTOP */}
              <div className="hidden md:flex flex-col mt-7 pt-6 border-t border-gray-200/60">
                <div className="flex items-center gap-4 mb-4">
                  <span className="text-xs font-bold text-gray-600 uppercase tracking-widest">Jumlah:</span>
                  <div className="flex items-center bg-white rounded-2xl p-1 border border-gray-200 shadow-sm">
                    <button onClick={() => handleQuantity('minus')} className="p-2.5 text-gray-600 hover:bg-gray-100 rounded-xl transition-all"><Minus size={16}/></button>
                    <span className="w-12 text-center font-black text-base">{quantity}</span>
                    <button onClick={() => handleQuantity('plus')} className="p-2.5 text-gray-600 hover:bg-gray-100 rounded-xl transition-all"><Plus size={16}/></button>
                  </div>
                </div>
                <div className="flex gap-2.5">
                  <button 
                    onClick={() => syncToFirebaseCart(product, quantity, false)} 
                    disabled={isOutOfStock || isAdding}
                    className={`flex-1 py-3.5 rounded-2xl font-black uppercase tracking-widest text-xs transition-all flex items-center justify-center gap-2 shadow-md hover:-translate-y-0.5 ${
                      isOutOfStock ? 'bg-gray-200 text-gray-400 cursor-not-allowed shadow-none' : 
                      isAdding ? 'bg-gray-800 text-white opacity-80' : 'bg-gray-900 text-white hover:bg-gray-800'
                    }`}
                  >
                    {isAdding ? <Loader2 size={18} className="animate-spin" /> : <ShoppingCart size={18} />}
                    {isOutOfStock ? 'STOK HABIS' : '+ KERANJANG'}
                  </button>

                  <button 
                    onClick={() => syncToFirebaseCart(product, quantity, true)} 
                    disabled={isOutOfStock || isAdding}
                    className={`flex-1 py-3.5 rounded-2xl font-black uppercase tracking-widest text-xs transition-all flex items-center justify-center gap-2 shadow-lg hover:-translate-y-0.5 ${
                      isOutOfStock ? 'bg-gray-100 text-gray-400 cursor-not-allowed shadow-none' : 
                      'bg-green-600 text-white hover:bg-green-700 shadow-green-600/20'
                    }`}
                  >
                    <Zap size={18} className="fill-current" />
                    BELI LANGSUNG
                  </button>

                  <button 
                    onClick={() => { addToWishlist(product.id); setInWishlist(!inWishlist); }}
                    className={`p-3.5 rounded-2xl border transition-all flex items-center justify-center hover:-translate-y-0.5 ${
                      inWishlist ? 'border-red-200 bg-red-50 text-red-500' : 'border-gray-200 bg-white text-gray-400 hover:border-red-200 hover:text-red-500'
                    }`}
                    title="Favorit"
                  >
                    <Heart size={20} className={inWishlist ? 'fill-current' : ''} />
                  </button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-6 mb-10">
              <div className="bg-white rounded-[2rem] border border-gray-100 p-6 shadow-sm">
                <h3 className="text-[11px] font-black uppercase tracking-widest text-gray-400 mb-4 flex items-center gap-2">
                  <Info size={14} className="text-green-600" /> Deskripsi
                </h3>
                <p className="text-xs font-bold text-gray-600 leading-relaxed uppercase">
                  {product.description || `Produk ${product.name} kualitas terbaik untuk kebutuhan Anda. Melayani pembelian ecer dan partai besar (grosir) dengan harga kompetitif.`}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: 'Satuan', val: currentUnit || 'PCS', icon: ShieldCheck },
                    { label: 'Minimal Grosir', val: `${currentMinWholesale || 12} ${currentUnit || 'PCS'}`, icon: Sparkles },
                    { label: 'Pengiriman', val: 'Kediri Kota', icon: Truck },
                    { label: 'Kondisi', val: 'Baru / Segel', icon: Info },
                  ].map((item, idx) => (
                    <div key={idx} className="bg-gray-50 p-4 rounded-2xl border border-gray-100 flex items-center gap-3">
                      <item.icon size={16} className="text-gray-300" />
                      <div>
                        <span className="text-[8px] font-black text-gray-400 uppercase block leading-none mb-1">{item.label}</span>
                        <span className="text-[10px] font-black text-gray-800 uppercase leading-none">{item.val}</span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* 4 Jaminan Layanan Pelanggan */}
                <CustomerGuarantees variant="compact" className="mt-3" />
            </div>

            {/* Review Section */}
            <div className="mb-10">
              <h3 className="text-[11px] font-black uppercase tracking-widest text-gray-400 mb-6 flex items-center gap-2">
                <MessageSquare size={14} className="text-orange-500" /> Ulasan & Rating ({reviews.length})
              </h3>
              
              {/* Form Input Ulasan */}
              <div className="bg-white rounded-[2rem] border border-gray-100 p-6 shadow-sm mb-6">
                <h4 className="text-xs font-bold text-gray-800 uppercase mb-3">Tulis Ulasan Anda</h4>
                <div className="flex gap-2 mb-4">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button key={star} onClick={() => setUserRating(star)} className="focus:outline-none transition-transform active:scale-90">
                       <Star size={24} className={star <= userRating ? "fill-yellow-400 text-yellow-400" : "text-gray-300"} />
                    </button>
                  ))}
                </div>
                <textarea 
                  value={userComment}
                  onChange={(e) => setUserComment(e.target.value)}
                  placeholder="Bagikan pengalaman Anda tentang produk ini..."
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-xs outline-none focus:border-green-500 mb-3 h-24 resize-none"
                />
                <button 
                  onClick={handleSubmitReview} 
                  disabled={submittingReview}
                  className="bg-gray-900 text-white px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-green-600 transition-colors disabled:bg-gray-300"
                >
                  {submittingReview ? 'Mengirim...' : 'Kirim Ulasan'}
                </button>
              </div>

              {/* List Ulasan */}
              <div className="space-y-4">
                {reviews.length === 0 ? (
                  <div className="text-center py-8 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                    <p className="text-[10px] text-gray-400 font-bold uppercase">Belum ada ulasan</p>
                  </div>
                ) : (
                  reviews.map((rev) => (
                    <div key={rev.id} className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <span className="text-[10px] font-black text-gray-800 uppercase block">{rev.userName}</span>
                          <span className="text-[9px] text-gray-400">{formatReviewDate(rev.createdAt)}</span>
                        </div>
                        <div className="flex gap-0.5">
                          {[...Array(5)].map((_, i) => (
                            <Star key={i} size={10} className={i < rev.rating ? "fill-yellow-400 text-yellow-400" : "text-gray-200"} />
                          ))}
                        </div>
                      </div>
                      <p className="text-[11px] text-gray-600 leading-relaxed">{rev.comment}</p>
                    </div>
                  ))
                )}
              </div>
            </div>

          </div>
        </div>

        {relatedProducts.length > 0 && (
          <div className="mt-20">
            <h2 className="text-xs font-black uppercase tracking-[0.2em] text-gray-900 mb-6 px-2 flex items-center gap-2">
              <Sparkles size={16} className="text-amber-500" /> Pilihan Lainnya
            </h2>
            <div className="flex overflow-x-auto gap-4 pb-10 no-scrollbar snap-x px-2">
              {relatedProducts.map((item) => (
                <div key={item.id} className="min-w-[160px] md:min-w-[180px] snap-start group cursor-pointer">
                  <Link href={`/produk/${item.id}`}>
                    <div className="aspect-square rounded-[2rem] overflow-hidden bg-white border border-gray-100 shadow-sm group-hover:shadow-xl group-hover:-translate-y-1 transition-all duration-300 mb-3 relative">
                      <img src={getProxiedImage(item.image)} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" />
                    </div>
                    <div className="px-1">
                      <h3 className="text-[11px] font-black uppercase text-gray-800 line-clamp-2 leading-tight group-hover:text-green-600 transition-colors">{item.name}</h3>
                      <p className="text-xs font-black text-green-600 mt-1.5">Rp{item.price.toLocaleString('id-ID')}</p>
                    </div>
                  </Link>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* FLOATING BOTTOM ACTION BAR (MOBILE) */}
      <div className="md:hidden fixed bottom-4 left-0 right-0 z-[90] px-3 pointer-events-none">
        <div className="max-w-lg mx-auto pointer-events-auto">
          <div className="bg-white/95 backdrop-blur-xl border border-gray-200/80 p-2.5 rounded-[2rem] shadow-[0_8px_30px_rgba(0,0,0,0.12)] flex items-center gap-2">
            <div className="flex items-center bg-gray-100/90 rounded-2xl p-1 shrink-0">
               <button onClick={() => handleQuantity('minus')} className="p-2 text-gray-600 active:scale-75 transition-all"><Minus size={15}/></button>
               <span className="w-7 text-center font-black text-xs">{quantity}</span>
               <button onClick={() => handleQuantity('plus')} className="p-2 text-gray-600 active:scale-75 transition-all"><Plus size={15}/></button>
            </div>

            <button 
              onClick={() => syncToFirebaseCart(product, quantity, false)}
              disabled={isAdding || isOutOfStock}
              className="flex-1 bg-gray-900 text-white py-3 rounded-2xl font-black text-[10px] uppercase tracking-wider flex items-center justify-center gap-1.5 active:scale-95 transition-all shadow-sm disabled:bg-gray-200 disabled:text-gray-400"
            >
              {isAdding ? <Loader2 className="animate-spin" size={14} /> : <><ShoppingCart size={14} /> + Keranjang</>}
            </button>

            <button 
              onClick={() => syncToFirebaseCart(product, quantity, true)}
              disabled={isAdding || isOutOfStock}
              className="flex-1 bg-green-600 text-white py-3 rounded-2xl font-black text-[10px] uppercase tracking-wider flex items-center justify-center gap-1.5 active:scale-95 transition-all shadow-md shadow-green-600/20 disabled:bg-gray-200 disabled:text-gray-400"
            >
              <Zap size={14} className="fill-current" /> Beli Langsung
            </button>
          </div>
        </div>
      </div>

    </div>
  );
}
