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
          const mappedProduct = {
            id: docSnap.id,
            ...data,
            name: data.Nama || data.name || "Produk",
            price: Number(data.Ecer || data.price) || 0,
            wholesalePrice: Number(data.Grosir || data.wholesalePrice) || 0,
            minWholesale: Number(data.Min_Stok_Grosir || data.Min_Grosir || data.minWholesale) || 1,
            stock: Number(data.Stok || data.stock) || 0,
            unit: data.Satuan || data.unit || 'pcs',
            category: data.Kategori || data.category || 'Umum',
            image: data.Link_Foto || data.image || '/logo-atayatoko.png',
          };
          setProduct(mappedProduct);

          const q = query(collection(db, 'products'), where('category', '==', mappedProduct.category), limit(8));
          const relatedSnap = await getDocs(q);
          setRelatedProducts(relatedSnap.docs.map(d => {
            const rData = d.data();
            return { 
              id: d.id, 
              name: rData.Nama || rData.name,
              price: Number(rData.Ecer || rData.price) || 0,
              image: rData.Link_Foto || rData.image
            };
          }).filter(p => p.id !== productId));

          const wishlist = getWishlist();
          setInWishlist(wishlist.includes(productId));
        }
      } catch (error) { console.error(error); } finally { setLoading(false); }
    };
    fetchData();
  }, [productId]);

  const syncToFirebaseCart = async (p: any, q: number) => {
    if (p.stock <= 0) {
      toast.error("Maaf, stok barang sedang habis");
      return;
    }
    setIsAdding(true);
    const localCart = JSON.parse(localStorage.getItem('cart') || '[]');
    const idToMatch = p.id;
    const isWholesale = p.wholesalePrice > 0 && q >= p.minWholesale;
    const finalPrice = isWholesale ? p.wholesalePrice : p.price;

    const localIdx = localCart.findIndex((item: any) => (item.productId === idToMatch || item.id === idToMatch));
    if (localIdx > -1) {
      localCart[localIdx].quantity += q;
      const totalQ = localCart[localIdx].quantity;
      localCart[localIdx].price = (p.wholesalePrice > 0 && totalQ >= p.minWholesale) ? p.wholesalePrice : p.price;
    } else {
      localCart.push({ 
        productId: idToMatch, id: idToMatch, name: p.name, price: finalPrice, 
        image: p.image, unit: p.unit, quantity: q,
        wholesalePrice: p.wholesalePrice, minWholesale: p.minWholesale
      });
    }

    localStorage.setItem('cart', JSON.stringify(localCart));
    window.dispatchEvent(new Event('cart-updated'));
    window.dispatchEvent(new Event('storage'));

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
            productId: idToMatch, name: p.name, price: finalPrice, 
            image: p.image, unit: p.unit, quantity: q, addedAt: new Date().toISOString()
          });
        }
        await setDoc(cartRef, { userId, items: cloudItems, updatedAt: new Date().toISOString() }, { merge: true });
        toast.success(`${p.name} ditambah`, {
          icon: '✅',
          style: { borderRadius: '15px', background: '#1a1a1a', color: '#fff', fontSize: '11px', fontWeight: 'bold' }
        });
      } catch (error) { console.error(error); } finally { setIsAdding(false); }
    } else {
      setIsAdding(false);
      toast.success("Tersimpan di perangkat");
    }
  };

  const handleQuantity = (type: 'plus' | 'minus') => {
    if (type === 'plus') setQuantity(prev => prev + 1);
    if (type === 'minus' && quantity > 1) setQuantity(prev => prev - 1);
  };

  if (loading || !product) return <div className="min-h-screen flex items-center justify-center font-black text-gray-300 animate-pulse uppercase tracking-widest">Memuat Produk...</div>;

  const isOutOfStock = product.stock <= 0;
  const isWholesaleEligible = product.wholesalePrice > 0 && quantity >= product.minWholesale;
  const currentPrice = isWholesaleEligible ? product.wholesalePrice : product.price;

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
              <img src={product.image} alt={product.name} className={`w-full h-full object-cover ${isOutOfStock ? 'grayscale opacity-50' : ''}`} />
              {isOutOfStock && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                  <span className="bg-white text-black px-6 py-2 rounded-full font-black uppercase text-xs shadow-xl">Stok Habis</span>
                </div>
              )}
            </div>
            <button onClick={() => { addToWishlist(product.id); setInWishlist(!inWishlist); }} className="absolute top-6 right-6 p-4 bg-white/90 backdrop-blur shadow-2xl rounded-full active:scale-90 transition-all">
              <Heart size={20} className={inWishlist ? 'fill-red-500 text-red-500' : 'text-gray-300'} />
            </button>
          </div>

          <div className="flex flex-col">
            <div className="mb-6">
              <span className="text-[9px] font-black text-green-600 uppercase tracking-widest bg-green-50 px-3 py-1.5 rounded-lg mb-4 inline-block">{product.category}</span>
              <h1 className="text-4xl font-black text-gray-900 uppercase tracking-tighter leading-[0.85] mb-2">{product.name}</h1>
              <p className="text-gray-400 text-[10px] font-bold uppercase tracking-widest">
                Harga Per {product.unit} {isOutOfStock && <span className="text-red-500 ml-2">• Kosong</span>}
              </p>
            </div>

            {/* BOX HARGA DENGAN INFO GROSIR */}
            <div className={`rounded-[2.5rem] p-8 mb-8 border transition-all duration-500 ${isWholesaleEligible ? 'bg-orange-50 border-orange-200 shadow-inner' : 'bg-gray-50 border-gray-100'}`}>
              <div className="flex flex-col mb-4">
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">
                  {isWholesaleEligible ? 'Harga Grosir Aktif' : 'Harga Eceran'}
                </span>
                <div className="flex items-end gap-2">
                  <span className={`text-5xl font-black tracking-tighter transition-colors ${isWholesaleEligible ? 'text-orange-600' : 'text-gray-900'}`}>
                    Rp{currentPrice.toLocaleString('id-ID')}
                  </span>
                  <span className="text-lg font-bold text-gray-400 mb-2">/{product.unit}</span>
                </div>
              </div>

              {product.wholesalePrice > 0 && (
                <div className="pt-4 border-t border-dashed border-gray-300">
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col">
                      <span className="text-[11px] font-black text-blue-600 uppercase italic">Promo Grosir</span>
                      <p className="text-[10px] text-gray-500 font-bold uppercase">
                        Min. <span className="text-gray-900">{product.minWholesale} {product.unit}</span>
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-xl font-black text-gray-900">
                        Rp{product.wholesalePrice.toLocaleString('id-ID')}
                      </span>
                      <span className="text-[10px] font-bold text-gray-400 ml-1">/{product.unit}</span>
                    </div>
                  </div>
                  
                  {!isWholesaleEligible && (
                    <div className="mt-3">
                      <div className="bg-gray-200 h-1.5 rounded-full overflow-hidden">
                        <div 
                          className="bg-blue-500 h-full transition-all duration-500" 
                          style={{ width: `${Math.min((quantity / product.minWholesale) * 100, 100)}%` }}
                        ></div>
                      </div>
                      <p className="mt-1.5 text-[9px] font-bold text-blue-500 uppercase animate-pulse">
                        Tambah {product.minWholesale - quantity} lagi untuk harga grosir!
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center gap-4 mb-8">
              <div className="flex items-center bg-white border-2 border-gray-100 rounded-2xl p-1 shadow-sm">
                <button onClick={() => handleQuantity('minus')} disabled={isOutOfStock} className="p-3 hover:text-red-500 disabled:opacity-30"><Minus size={18}/></button>
                <span className="w-10 text-center font-black text-xl">{quantity}</span>
                <button onClick={() => handleQuantity('plus')} disabled={isOutOfStock} className="p-3 hover:text-green-600 disabled:opacity-30"><Plus size={18}/></button>
              </div>
              <button 
                onClick={() => syncToFirebaseCart(product, quantity)} 
                disabled={isAdding || isOutOfStock}
                className={`flex-1 py-5 rounded-[1.5rem] font-black uppercase text-[11px] tracking-widest shadow-xl transition-all flex items-center justify-center gap-2
                  ${isOutOfStock ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-gray-900 text-white hover:bg-green-600 active:scale-95'}`}
              >
                {isAdding ? <Loader2 className="animate-spin" size={18} /> : (isOutOfStock ? 'Stok Habis' : 'Add To Cart')}
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

      <div className="md:hidden fixed bottom-6 left-4 right-4 z-[100] flex gap-2">
        <div className="bg-gray-900 p-2 rounded-2xl flex items-center text-white shadow-2xl">
           <button onClick={() => handleQuantity('minus')} disabled={isOutOfStock} className="p-2"><Minus size={16}/></button>
           <span className="w-8 text-center font-black">{quantity}</span>
           <button onClick={() => handleQuantity('plus')} disabled={isOutOfStock} className="p-2"><Plus size={16}/></button>
        </div>
        <button 
          onClick={() => syncToFirebaseCart(product, quantity)} 
          disabled={isAdding || isOutOfStock}
          className={`flex-1 py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2
            ${isOutOfStock ? 'bg-gray-300 text-gray-500' : 'bg-green-500 text-white'}`}
        >
          {isAdding ? <Loader2 className="animate-spin" size={16} /> : (isOutOfStock ? 'Habis' : 'Masuk Keranjang')}
        </button>
      </div>
    </div>
  );
}