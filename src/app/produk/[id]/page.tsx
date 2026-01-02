'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { 
  ArrowLeft, Heart, ShoppingCart, Plus, Minus, Loader2 
} from 'lucide-react';
import Link from 'next/link';
import { doc, getDoc, collection, getDocs, query, where, limit, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { addToWishlist, getWishlist } from '@/lib/wishlist';
import toast, { Toaster } from 'react-hot-toast';

export default function ProductDetailPage() {
  const router = useRouter();
  const params = useParams();
  const productId = params?.id as string;

  const [product, setProduct] = useState<any | null>(null);
  const [relatedProducts, setRelatedProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [inWishlist, setInWishlist] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [userId, setUserId] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);

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
          setProduct({ id: docSnap.id, ...data });

          const q = query(collection(db, 'products'), where('category', '==', data.category), limit(8));
          const relatedSnap = await getDocs(q);
          setRelatedProducts(relatedSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter(p => p.id !== productId));

          const wishlist = getWishlist();
          setInWishlist(wishlist.includes(productId));
        }
      } catch (error) { console.error(error); } finally { setLoading(false); }
    };
    fetchData();
  }, [productId]);

  // --- FUNGSI SINKRONISASI DIPERBAIKI ---
  const syncToFirebaseCart = async (p: any, q: number) => {
    setIsAdding(true);
    
    // 1. Simpan ke Local Storage (Gunakan Key 'cart' & properti 'productId')
    const localCart = JSON.parse(localStorage.getItem('cart') || '[]');
    const idToMatch = p.id || p.productId;
    const localIdx = localCart.findIndex((item: any) => (item.productId === idToMatch || item.id === idToMatch));
    
    const minGrosir = p.minWholesale || p.minGrosir || 10;
    const finalPrice = (p.wholesalePrice && q >= minGrosir) ? p.wholesalePrice : p.price;

    if (localIdx > -1) {
      localCart[localIdx].quantity += q;
      localCart[localIdx].price = finalPrice;
    } else {
      localCart.push({ 
        productId: idToMatch, 
        id: idToMatch, 
        name: p.name, 
        price: finalPrice, 
        image: p.image, 
        unit: p.unit, 
        quantity: q,
        wholesalePrice: p.wholesalePrice,
        minWholesale: minGrosir
      });
    }

    localStorage.setItem('cart', JSON.stringify(localCart));
    
    // Trigger event agar badge keranjang di Navbar langsung update
    window.dispatchEvent(new Event('cart-updated'));
    window.dispatchEvent(new Event('storage'));

    // 2. Sinkronkan ke Firebase Cloud
    if (userId) {
      try {
        const cartRef = doc(db, 'carts', userId);
        const cartSnap = await getDoc(cartRef);
        let cloudItems = cartSnap.exists() ? cartSnap.data().items : [];
        
        const existingIndex = cloudItems.findIndex((item: any) => item.productId === idToMatch);
        if (existingIndex > -1) {
          cloudItems[existingIndex].quantity += q;
          cloudItems[existingIndex].price = finalPrice;
        } else {
          cloudItems.push({
            productId: idToMatch,
            name: p.name,
            price: finalPrice,
            image: p.image,
            unit: p.unit,
            quantity: q,
            addedAt: new Date().toISOString()
          });
        }

        await setDoc(cartRef, { userId, items: cloudItems, updatedAt: new Date().toISOString() }, { merge: true });
        toast.success(`${p.name} ditambah`, {
          icon: '✅',
          style: { borderRadius: '15px', background: '#1a1a1a', color: '#fff', fontSize: '11px', fontWeight: 'bold' }
        });
      } catch (error) {
        console.error("Cloud sync error:", error);
      } finally {
        setIsAdding(false);
      }
    } else {
      setIsAdding(false);
      toast.success("Tersimpan di perangkat");
    }
  };

  const handleQuantity = (type: 'plus' | 'minus') => {
    if (type === 'plus') setQuantity(prev => prev + 1);
    if (type === 'minus' && quantity > 1) setQuantity(prev => prev - 1);
  };

  if (loading || !product) return <div className="min-h-screen flex items-center justify-center font-black text-gray-300 animate-pulse">MEMUAT PRODUK...</div>;

  const isWholesaleEligible = product.wholesalePrice && quantity >= (product.minWholesale || 10);
  const currentPrice = isWholesaleEligible ? product.wholesalePrice! : product.price;

  return (
    <div className="min-h-screen bg-white pb-32">
      <Toaster position="top-center" />
      
      <header className="bg-white/80 backdrop-blur-md sticky top-0 z-50 border-b border-gray-50 px-4 py-4 flex items-center justify-between">
          <button onClick={() => router.back()} className="p-2 hover:bg-gray-100 rounded-full transition-colors"><ArrowLeft size={20}/></button>
          <div className="flex flex-col items-center">
            <h1 className="text-[9px] font-black uppercase tracking-[0.3em] text-gray-400">Atayatoko</h1>
            <span className="text-[10px] font-bold text-green-600 uppercase">Product Gallery</span>
          </div>
          <Link href="/cart" className="p-2 hover:bg-gray-100 rounded-full transition-colors"><ShoppingCart size={20} className="text-gray-700" /></Link>
      </header>

      <div className="max-w-5xl mx-auto px-4 pt-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
          <div className="relative">
            <div className="aspect-square rounded-[3rem] overflow-hidden bg-gray-50 border border-gray-100 shadow-2xl relative">
              <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
            </div>
            <button onClick={() => { addToWishlist(product.id); setInWishlist(!inWishlist); }} className="absolute top-6 right-6 p-4 bg-white/90 backdrop-blur shadow-2xl rounded-full active:scale-90 transition-all">
              <Heart size={20} className={inWishlist ? 'fill-red-500 text-red-500' : 'text-gray-300'} />
            </button>
          </div>

          <div className="flex flex-col">
            <div className="mb-6">
              <span className="text-[9px] font-black text-green-600 uppercase tracking-widest bg-green-50 px-3 py-1.5 rounded-lg mb-4 inline-block">{product.category}</span>
              <h1 className="text-4xl font-black text-gray-900 uppercase tracking-tighter leading-[0.85] mb-2">{product.name}</h1>
              <p className="text-gray-400 text-[10px] font-bold uppercase">Harga Per {product.unit}</p>
            </div>

            <div className={`rounded-[2.5rem] p-8 mb-8 border transition-all duration-500 ${isWholesaleEligible ? 'bg-orange-50 border-orange-200 shadow-inner' : 'bg-gray-50 border-gray-100'}`}>
              <div className="flex items-end gap-2">
                <span className={`text-5xl font-black tracking-tighter ${isWholesaleEligible ? 'text-orange-600' : 'text-gray-900'}`}>
                  Rp{currentPrice.toLocaleString('id-ID')}
                </span>
                <span className="text-lg font-bold text-gray-400 mb-2">/{product.unit}</span>
              </div>
              {product.wholesalePrice && (
                <div className="mt-4 p-3 bg-white/50 rounded-xl border border-dashed border-gray-300 text-[9px] font-bold text-gray-600 uppercase">
                  MIN. <span className="text-orange-600">{product.minWholesale || 10}</span> {product.unit} UNTUK HARGA GROSIR
                </div>
              )}
            </div>

            <div className="flex items-center gap-4 mb-8">
              <div className="flex items-center bg-white border-2 border-gray-100 rounded-2xl p-1 shadow-sm">
                <button onClick={() => handleQuantity('minus')} className="p-3 hover:text-red-500 transition-colors"><Minus size={18}/></button>
                <span className="w-10 text-center font-black text-xl">{quantity}</span>
                <button onClick={() => handleQuantity('plus')} className="p-3 hover:text-green-600 transition-colors"><Plus size={18}/></button>
              </div>
              <button 
                onClick={() => syncToFirebaseCart(product, quantity)} 
                disabled={isAdding}
                className="flex-1 bg-gray-900 text-white py-5 rounded-[1.5rem] font-black uppercase text-[11px] tracking-widest hover:bg-green-600 disabled:bg-gray-400 shadow-xl transition-all flex items-center justify-center gap-2"
              >
                {isAdding ? <Loader2 className="animate-spin" size={18} /> : 'Add To Cart'}
              </button>
            </div>
          </div>
        </div>

        {/* PRODUK SERUPA */}
        <div className="mt-16">
          <h2 className="text-[11px] font-black uppercase tracking-[0.3em] mb-6">Mungkin Anda Butuh</h2>
          <div className="flex overflow-x-auto gap-4 pb-6 no-scrollbar snap-x">
            {relatedProducts.map((item) => (
              <div key={item.id} className="min-w-[160px] snap-start relative group">
                <Link href={`/produk/${item.id}`}>
                  <div className="aspect-square rounded-[2rem] overflow-hidden bg-gray-50 border border-gray-100 mb-3 group-hover:shadow-lg transition-all">
                    <img src={item.image} alt={item.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                  </div>
                  <h3 className="text-[10px] font-black uppercase text-gray-800 truncate pr-10">{item.name}</h3>
                  <p className="text-[11px] font-bold text-green-600 mt-1">Rp{item.price.toLocaleString('id-ID')}</p>
                </Link>
                <button 
                  onClick={() => syncToFirebaseCart(item, 1)}
                  className="absolute bottom-6 right-2 p-2.5 bg-green-600 text-white rounded-xl shadow-lg active:scale-90 transition-transform"
                >
                  <ShoppingCart size={14} strokeWidth={3} />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* MOBILE ACTION BAR */}
      <div className="md:hidden fixed bottom-6 left-4 right-4 z-[100] flex gap-2">
        <div className="bg-gray-900 p-2 rounded-2xl flex items-center text-white shadow-2xl">
           <button onClick={() => handleQuantity('minus')} className="p-2"><Minus size={16}/></button>
           <span className="w-8 text-center font-black">{quantity}</span>
           <button onClick={() => handleQuantity('plus')} className="p-2"><Plus size={16}/></button>
        </div>
        <button 
          onClick={() => syncToFirebaseCart(product, quantity)} 
          disabled={isAdding}
          className="flex-1 bg-green-500 text-white py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2"
        >
          {isAdding ? <Loader2 className="animate-spin" size={16} /> : 'Masuk Keranjang'}
        </button>
      </div>
    </div>
  );
}