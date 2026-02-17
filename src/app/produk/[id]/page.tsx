'use client';

import { useEffect, useState } from 'react';
// 1. Tambahkan usePathname di import next/navigation
import { useRouter, useParams, usePathname } from 'next/navigation'; 
import { auth, db } from '@/lib/firebase';

import { 
  ArrowLeft, Heart, ShoppingCart, Plus, Minus, Loader2, Sparkles, Info, ShieldCheck, Truck,
  LayoutGrid,
  ReceiptText,
  User,
  Home as HomeIcon,
  Star, MessageSquare
} from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { doc, getDoc, collection, getDocs, query, where, limit, setDoc, addDoc, serverTimestamp, orderBy } from 'firebase/firestore';
import { addToWishlist, getWishlist } from '@/lib/wishlist';
import toast, { Toaster } from 'react-hot-toast';

type Review = {
  id: string;
  userId: string;
  userName: string;
  rating: number;
  comment: string;
  createdAt: { toDate?: () => Date } | Date | null;
};

type Product = {
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
};

type RelatedProduct = Pick<Product, 'id' | 'name' | 'price' | 'image'>;

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

// 3. Hapus import Home dari @/app/page karena menyebabkan konflik dan error

export default function ProductDetailPage() {
  const router = useRouter();
  const params = useParams();
  
  // 4. Inisialisasi pathname disini
  const pathname = usePathname(); 

  const productId = params?.id as string;

  const [product, setProduct] = useState<Product | null>(null);
  const [relatedProducts, setRelatedProducts] = useState<RelatedProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [inWishlist, setInWishlist] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [userId, setUserId] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  
  // Review States
  const [reviews, setReviews] = useState<Review[]>([]);
  const [userRating, setUserRating] = useState(0);
  const [userComment, setUserComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);

  // ✅ PROXY GAMBAR Agar Gambar Supplier Muncul
  const getProxiedImage = (url: string) => {
    if (!url || url.includes('firebasestorage.googleapis.com') || url.startsWith('data:')) {
      return url || '/logo-atayatoko.png';
    }
    return `https://wsrv.nl/?url=${encodeURIComponent(url)}&w=800&output=webp`;
  };

  const hasToDate = (x: unknown): x is { toDate: () => Date } => {
    return !!x && typeof (x as { toDate?: () => Date }).toDate === 'function';
  };

  const formatReviewDate = (input: Review['createdAt']) => {
    try {
      if (hasToDate(input)) {
        const d = input.toDate();
        return new Date(d).toLocaleDateString('id-ID');
      }
      if (input && input instanceof Date) {
        return input.toLocaleDateString('id-ID');
      }
    } catch {}
    return 'Baru saja';
  };

  useEffect(() => {
    let tempId = localStorage.getItem('temp_user_id');
    if (!tempId) {
      tempId = 'user_' + Math.random().toString(36).substr(2, 9);
      localStorage.setItem('temp_user_id', tempId);
    }
    setUserId(tempId);

    const fetchData = async () => {
      if (!productId) return;
      try {
        const docRef = doc(db, 'products', productId);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          const data = docSnap.data();
          const mappedProduct: Product = {
            id: docSnap.id,
            name: data.Nama || data.name || "Produk",
            price: Number(data.Ecer || data.price) || 0,
            wholesalePrice: Number(data.Grosir || data.wholesalePrice) || 0,
            minWholesale: Number(data.Min_Stok_Grosir || data.Min_Grosir || data.minWholesale) || 12,
            stock: Number(data.Stok || data.stock) || 0,
            unit: data.Satuan || data.unit || 'pcs',
            category: data.Kategori || data.category || 'Umum',
            image: data.Link_Foto || data.image || '/logo-atayatoko.png',
            description: data.Deskripsi || data.description || ""
          };
          setProduct(mappedProduct);

          const q = query(collection(db, 'products'), where('Kategori', '==', mappedProduct.category), limit(8));
          const relatedSnap = await getDocs(q);
          setRelatedProducts(relatedSnap.docs.map(d => {
            const rData = d.data();
            return { 
              id: d.id,
              name: rData.Nama || rData.name || "Produk",
              price: Number(rData.Ecer || rData.price) || 0,
              image: rData.Link_Foto || rData.image || '/logo-atayatoko.png'
            };
          }).filter(p => p.id !== productId));

          const wishlist = getWishlist();
          setInWishlist(wishlist.includes(productId));

          // Fetch Reviews
          try {
            const reviewsQ = query(collection(db, 'products', productId, 'reviews'), orderBy('createdAt', 'desc'));
            const reviewSnap = await getDocs(reviewsQ);
            setReviews(reviewSnap.docs.map(d => ({ id: d.id, ...d.data() } as Review)));
          } catch {
            console.log("No reviews yet or error fetching reviews");
          }
        }
      } catch (error) { console.error(error); } finally { setLoading(false); }
    };
    fetchData();
  }, [productId]);

  const syncToFirebaseCart = async (p: Product, q: number) => {
    if (p.stock <= 0) {
      toast.error("Maaf, stok barang sedang habis");
      return;
    }
    setIsAdding(true);
    const localCart = JSON.parse(localStorage.getItem('cart') || '[]') as CartItem[];
    const idToMatch = p.id;
    const isWholesale = p.wholesalePrice > 0 && q >= p.minWholesale;
    const finalPrice = isWholesale ? p.wholesalePrice : p.price;

    const localIdx = localCart.findIndex((item) => (item.productId === idToMatch || item.id === idToMatch));
    if (localIdx > -1) {
      localCart[localIdx].quantity += q;
      const totalQ = localCart[localIdx].quantity;
      localCart[localIdx].price = (p.wholesalePrice > 0 && totalQ >= p.minWholesale) ? p.wholesalePrice : p.price;
    } else {
      localCart.push({ 
        productId: idToMatch, id: idToMatch, name: p.name, price: finalPrice, 
        image: p.image, unit: p.unit || 'pcs', quantity: q,
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
        const existingIndex = cloudItems.findIndex((item) => item.productId === idToMatch);
        if (existingIndex > -1) {
          cloudItems[existingIndex].quantity += q;
          cloudItems[existingIndex].price = finalPrice;
        } else {
          cloudItems.push({
            productId: idToMatch, id: idToMatch, name: p.name, price: finalPrice, 
            image: p.image, unit: p.unit || 'pcs', quantity: q, addedAt: new Date().toISOString()
          });
        }
        await setDoc(cartRef, { userId, items: cloudItems, updatedAt: new Date().toISOString() }, { merge: true });
        toast.success(`${p.name} ditambah ke keranjang`);
      } catch (error) { console.error(error); } finally { setIsAdding(false); }
    } else {
      setIsAdding(false);
    }
  };

  const handleSubmitReview = async () => {
    if (!auth.currentUser) return toast.error('Silakan login untuk memberikan ulasan');
    if (userRating === 0) return toast.error('Silakan pilih bintang rating');
    if (!userComment.trim()) return toast.error('Silakan tulis ulasan Anda');
    
    setSubmittingReview(true);
    try {
      await addDoc(collection(db, 'products', productId, 'reviews'), {
        userId: auth.currentUser.uid,
        userName: auth.currentUser.displayName || auth.currentUser.email?.split('@')[0] || 'Pengguna',
        rating: userRating,
        comment: userComment,
        createdAt: serverTimestamp()
      });
      toast.success('Terima kasih! Ulasan berhasil dikirim.');
      setUserComment('');
      setUserRating(0);
      
      const reviewsQ = query(collection(db, 'products', productId, 'reviews'), orderBy('createdAt', 'desc'));
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

  if (loading || !product) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-white gap-4">
      <Loader2 className="animate-spin text-green-600" size={40} />
      <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Menyiapkan Detail...</span>
    </div>
  );

  const isOutOfStock = product.stock <= 0;
  const isWholesaleEligible = product.wholesalePrice > 0 && quantity >= product.minWholesale;
  const currentPrice = isWholesaleEligible ? product.wholesalePrice : product.price;

  return (
    <div className="min-h-screen bg-white pb-40">
      <Toaster position="top-center" />
      
      <header className="bg-white/80 backdrop-blur-md sticky top-0 z-50 border-b border-gray-50 px-4 py-4 flex items-center justify-between">
          <button onClick={() => router.back()} className="p-2.5 bg-gray-50 rounded-2xl active:scale-90 transition-all"><ArrowLeft size={20}/></button>
          <div className="flex flex-col items-center">
            <Link href="/" className="leading-none mb-1">
              <h1 className="text-[9px] font-black uppercase tracking-[0.3em] text-gray-400 hover:text-green-600 transition-colors cursor-pointer">ATAYAMARKET</h1>
            </Link>
            <span className="text-[10px] font-bold text-green-600 uppercase">Product Details</span>
          </div>
          <Link href="/cart" className="p-2.5 bg-green-50 text-green-600 rounded-2xl relative">
            <ShoppingCart size={20} />
          </Link>
      </header>

      <div className="max-w-5xl mx-auto px-4 pt-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
          <div className="relative">
            <div className="aspect-square rounded-[2.5rem] md:rounded-[4rem] overflow-hidden bg-gray-50 border border-gray-100 shadow-2xl relative">
              <Image 
                src={getProxiedImage(product.image)} 
                alt={product.name} 
                fill 
                className={`object-cover ${isOutOfStock ? 'grayscale opacity-50' : ''}`}
                priority
              />
              {isOutOfStock && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/20 backdrop-blur-[2px]">
                  <span className="bg-white text-black px-6 py-2 rounded-full font-black uppercase text-[10px]">Stok Habis</span>
                </div>
              )}
            </div>
            <button 
              onClick={() => { addToWishlist(product.id); setInWishlist(!inWishlist); }} 
              className="absolute top-6 right-6 p-4 bg-white/90 backdrop-blur shadow-2xl rounded-full active:scale-75 transition-all"
            >
              <Heart size={20} className={inWishlist ? 'fill-red-500 text-red-500' : 'text-gray-300'} />
            </button>
          </div>

          <div className="flex flex-col">
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-[9px] font-black text-green-600 uppercase tracking-widest bg-green-50 px-3 py-1.5 rounded-lg inline-block">{product.category}</span>
                <span className="text-[9px] font-black text-blue-600 uppercase tracking-widest bg-blue-50 px-3 py-1.5 rounded-lg inline-block">Stok: {product.stock} {product.unit}</span>
              </div>
              <h1 className="text-4xl md:text-5xl font-black text-gray-900 uppercase tracking-tighter leading-[0.85] mb-2">{product.name}</h1>
              <p className="text-gray-400 text-[10px] font-bold uppercase tracking-widest flex items-center gap-2">
                HARGA PER {product.unit} {isOutOfStock && <span className="text-red-500 font-black">• KOSONG</span>}
              </p>
            </div>

            <div className={`rounded-[2.5rem] p-8 mb-8 border transition-all duration-500 ${isWholesaleEligible ? 'bg-orange-600 text-white border-orange-700 shadow-xl scale-[1.02]' : 'bg-gray-50 border-gray-100'}`}>
              <div className="flex flex-col mb-4">
                <span className={`text-[10px] font-black uppercase tracking-widest mb-1 ${isWholesaleEligible ? 'text-orange-100' : 'text-gray-400'}`}>
                  {isWholesaleEligible ? '✨ Harga Grosir Aktif' : 'Harga Eceran'}
                </span>
                <div className="flex items-end gap-2">
                  <span className="text-5xl font-black tracking-tighter">
                    Rp{currentPrice.toLocaleString('id-ID')}
                  </span>
                  <span className={`text-lg font-bold mb-2 ${isWholesaleEligible ? 'text-orange-200' : 'text-gray-400'}`}>/{product.unit}</span>
                </div>
              </div>

              <div className={`pt-4 border-t border-dashed ${isWholesaleEligible ? 'border-orange-400' : 'border-gray-300'}`}>
                <div className="flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className={`text-[11px] font-black uppercase italic ${isWholesaleEligible ? 'text-white' : 'text-blue-600'}`}>Target Grosir</span>
                    <p className={`text-[10px] font-bold uppercase ${isWholesaleEligible ? 'text-orange-100' : 'text-gray-500'}`}>
                      Min. {product.minWholesale || 12} {product.unit}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className={`text-xl font-black ${isWholesaleEligible ? 'text-white' : 'text-gray-900'}`}>
                      {product.wholesalePrice > 0 ? `Rp${product.wholesalePrice.toLocaleString('id-ID')}` : 'Tanya Admin'}
                    </span>
                  </div>
                </div>
                
                {!isWholesaleEligible && (
                  <div className="mt-4">
                    <div className="bg-gray-200 h-2 rounded-full overflow-hidden p-0.5">
                      <div 
                        className="bg-blue-600 h-full rounded-full transition-all duration-700 shadow-[0_0_10px_rgba(37,99,235,0.3)]" 
                        style={{ width: `${Math.min((quantity / (product.minWholesale || 12)) * 100, 100)}%` }}
                      ></div>
                    </div>
                    <p className="mt-2 text-[9px] font-black text-blue-600 uppercase flex items-center gap-1 animate-pulse">
                      <Sparkles size={10} /> Tambah {Math.max(0, (product.minWholesale || 12) - quantity)} lagi untuk grosir!
                    </p>
                  </div>
                )}
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
                  { label: 'Satuan', val: product.unit, icon: ShieldCheck },
                  { label: 'Minimal Grosir', val: `${product.minWholesale || 12} ${product.unit}`, icon: Sparkles },
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
            <h2 className="text-[11px] font-black uppercase tracking-[0.4em] text-gray-400 mb-8 px-2">Rekomendasi Serupa</h2>
            <div className="flex overflow-x-auto gap-5 pb-10 no-scrollbar snap-x">
              {relatedProducts.map((item) => (
                <div key={item.id} className="min-w-[170px] snap-start">
                  <Link href={`/produk/${item.id}`}>
                    <div className="aspect-square rounded-[2.5rem] overflow-hidden bg-gray-50 border border-gray-100 mb-3 relative">
                      <Image src={getProxiedImage(item.image)} alt="" fill className="object-cover" sizes="200px" />
                    </div>
                    <h3 className="text-[10px] font-black uppercase text-gray-800 line-clamp-1">{item.name}</h3>
                    <p className="text-[11px] font-black text-green-600 mt-1">Rp{item.price.toLocaleString('id-ID')}</p>
                  </Link>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 1. TOMBOL TAMBAH KERANJANG */}
      <div className="md:hidden fixed bottom-24 left-0 right-0 z-[90] px-4 pointer-events-none">
        <div className="max-w-md mx-auto pointer-events-auto">
          <div className="bg-white/80 backdrop-blur-2xl border border-gray-100 p-3 rounded-[2rem] shadow-[0_10px_40px_rgba(0,0,0,0.1)] flex items-center gap-3">
            <div className="flex items-center bg-gray-100 rounded-2xl p-1">
               <button onClick={() => handleQuantity('minus')} className="p-2.5 text-gray-500"><Minus size={16}/></button>
               <span className="w-8 text-center font-black text-sm">{quantity}</span>
               <button onClick={() => handleQuantity('plus')} className="p-2.5 text-gray-500"><Plus size={16}/></button>
            </div>
            <button 
              onClick={() => syncToFirebaseCart(product, quantity)}
              disabled={isAdding || isOutOfStock}
              className="flex-1 bg-gray-900 text-white py-4 rounded-2xl font-black text-[11px] uppercase tracking-widest flex items-center justify-center gap-2 active:scale-95 transition-all"
            >
              {isAdding ? <Loader2 className="animate-spin" size={16} /> : <><Plus size={16} strokeWidth={3} /> Tambah</>}
            </button>
          </div>
        </div>
      </div>

      {/* 2. BOTTOM NAVIGATION BAR */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-[100] px-4 pb-6 pt-2 bg-gradient-to-t from-white via-white/80 to-transparent">
        <div className="bg-gray-900 rounded-[2.5rem] shadow-2xl border border-white/10 p-2 flex items-center justify-between backdrop-blur-xl">
          {[
            { name: 'Home', icon: HomeIcon, path: '/' }, // Gunakan HomeIcon disini
            { name: 'Kategori', icon: LayoutGrid, path: '/semua-kategori' },
            { name: 'Pesanan', icon: ReceiptText, path: '/orders' },
            { name: 'Profil', icon: User, path: '/profil' },
          ].map((item) => {
            const isActive = pathname === item.path;
            return (
              <Link key={item.name} href={item.path} className={`flex flex-col items-center justify-center py-2 px-5 rounded-full transition-all duration-300 ${isActive ? 'bg-green-600 text-white' : 'text-gray-400 hover:text-white'}`}>
                <item.icon size={20} strokeWidth={isActive ? 3 : 2} />
                <span className={`text-[8px] font-black uppercase mt-1 tracking-widest ${isActive ? 'block' : 'hidden'}`}>{item.name}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
