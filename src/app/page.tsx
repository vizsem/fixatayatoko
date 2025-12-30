// src/app/page.tsx
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  Search, ShoppingCart, User, Heart, Menu, X, Star, Truck, 
  Shield, RotateCcw, Award, Package, Store, 
  ShieldCheck, Printer, AlertTriangle, Barcode
} from 'lucide-react';
import { 
  collection, 
  getDocs,
  query,
  where
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { getWishlist, addToWishlist, removeFromWishlist } from '@/lib/wishlist';

// Tipe produk lokal
type Product = {
  id: string;
  name: string;
  price: number;
  wholesalePrice: number;
  purchasePrice: number;
  stock: number;
  stockByWarehouse?: Record<string, number>;
  category: string;
  unit: string;
  barcode?: string;
  image: string;
  expiredDate?: string;
};

type Category = {
  id: string;
  name: string;
  slug: string;
};

export default function Home() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [cartCount, setCartCount] = useState(0);
  const [wishlist, setWishlist] = useState<string[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  // Load data dari Firestore
  useEffect(() => {
    const fetchData = async () => {
      try {
        const productsSnapshot = await getDocs(collection(db, 'products'));
        const productList = productsSnapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            name: data.name || 'Produk Tanpa Nama',
            price: data.price || 0,
            wholesalePrice: data.wholesalePrice || data.price || 0,
            purchasePrice: data.purchasePrice || 0,
            stock: data.stock || 0,
            stockByWarehouse: data.stockByWarehouse || {},
            category: data.category || 'Lainnya',
            unit: data.unit || 'pcs',
            barcode: data.barcode || '',
            image: data.image || '/logo-atayatoko.png',
            expiredDate: data.expiredDate
          };
        }) as Product[];
        
        const categorySet = new Set(
          productList
            .map(p => p.category || 'Lainnya')
            .filter(name => name && name.trim() !== '')
            .map(name => name.trim())
        );
        
        const categoryList = Array.from(categorySet).map((name, index) => ({
          id: `cat-${index}`,
          name: name || 'Lainnya',
          slug: (name || 'lainnya').toLowerCase().replace(/[^a-z0-9]+/g, '-')
        }));
        
        setProducts(productList);
        setCategories(categoryList);
        
        const savedCart = localStorage.getItem('atayatoko-cart');
        if (savedCart) {
          try {
            const cart = JSON.parse(savedCart);
            setCartCount(cart.reduce((sum: number, item: any) => sum + item.quantity, 0));
          } catch (e) {
            setCartCount(0);
          }
        }
        
        const wl = JSON.parse(localStorage.getItem('atayatoko-wishlist') || '[]');
        setWishlist(wl);
      } catch (error) {
        console.error('Gagal memuat data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const addToCart = (product: Product) => {
    const savedCart = localStorage.getItem('atayatoko-cart');
    let cart: any[] = [];
    
    if (savedCart) {
      try {
        cart = JSON.parse(savedCart);
      } catch (e) {
        cart = [];
      }
    }

    const existingIndex = cart.findIndex((item: any) => item.id === product.id);
    if (existingIndex >= 0) {
      cart[existingIndex].quantity += 1;
    } else {
      cart.push({ ...product, quantity: 1 });
    }

    localStorage.setItem('atayatoko-cart', JSON.stringify(cart));
    setCartCount(cart.reduce((sum, item) => sum + item.quantity, 0));
  };

  const toggleWishlist = (productId: string) => {
    const newWishlist = wishlist.includes(productId)
      ? wishlist.filter(id => id !== productId)
      : [...wishlist, productId];
    
    setWishlist(newWishlist);
    localStorage.setItem('atayatoko-wishlist', JSON.stringify(newWishlist));
  };

  const filteredProducts = products.filter(product =>
    (product.name?.toLowerCase().includes(searchQuery.toLowerCase()) || false) ||
    (product.category?.toLowerCase().includes(searchQuery.toLowerCase()) || false) ||
    (product.barcode?.includes(searchQuery) || false)
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
          <p className="mt-4 text-black">Memuat produk...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="flex items-center space-x-2">
                  {/* ✅ LOGO BARU DARI FILE ANDA */}
                  <img 
                    src="/logo-atayatoko.png" 
                    alt="ATAYATOKO" 
                    className="h-8 w-auto"
                  />
                  <div>
                    <h1 className="text-xl font-bold text-green-600">ATAYATOKO</h1>
                    <p className="text-xs text-gray-600">Ecer & Grosir</p>
                  </div>
                </div>
              </div>
            </div>

            <nav className="hidden md:flex items-center space-x-6">
              <Link href="/" className="text-gray-700 hover:text-green-600 font-medium">Beranda</Link>
              <Link href="/semua-kategori" className="text-gray-700 hover:text-green-600 font-medium">Kategori</Link>
              <Link href="/promo" className="text-gray-700 hover:text-green-600 font-medium">Promo</Link>
              <Link href="/tentang" className="text-gray-700 hover:text-green-600 font-medium">Tentang</Link>
              <Link href="/kontak" className="text-gray-700 hover:text-green-600 font-medium">Kontak</Link>
            </nav>

            <div className="hidden md:flex flex-1 max-w-lg mx-8">
              <div className="relative w-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                <Barcode className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                <input
                  type="text"
                  placeholder="Cari produk, kategori, atau barcode..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                />
              </div>
            </div>

            <div className="flex items-center space-x-4">
              <Link href="/wishlist" className="p-2 text-gray-600 hover:text-red-500 relative">
                <Heart 
                  size={24} 
                  className={wishlist.length > 0 ? 'fill-red-500 text-red-500' : ''}
                />
                {wishlist.length > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] rounded-full h-4 w-4 flex items-center justify-center">
                    {wishlist.length}
                  </span>
                )}
              </Link>
              <Link href="/cart" className="p-2 text-gray-600 hover:text-green-600 relative">
                <ShoppingCart size={24} />
                {cartCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-green-600 text-white text-[10px] rounded-full h-4 w-4 flex items-center justify-center">
                    {cartCount}
                  </span>
                )}
              </Link>
              <Link href="/profil" className="p-2 text-gray-600 hover:text-green-600">
                <User size={24} />
              </Link>
              <button 
                className="md:hidden p-2 text-gray-600"
                onClick={() => setIsMenuOpen(!isMenuOpen)}
              >
                {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
              </button>
            </div>
          </div>

          <div className="md:hidden mt-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
              <Barcode className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="text"
                placeholder="Cari produk, kategori, atau barcode..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
              />
            </div>
          </div>
        </div>

        {isMenuOpen && (
          <div className="md:hidden bg-white border-t">
            <div className="px-4 py-2 space-y-2">
              <Link href="/" className="block py-2 text-gray-700 hover:text-green-600">Beranda</Link>
              <Link href="/semua-kategori" className="block py-2 text-gray-700 hover:text-green-600">Kategori</Link>
              <Link href="/promo" className="block py-2 text-gray-700 hover:text-green-600">Promo</Link>
              <Link href="/tentang" className="block py-2 text-gray-700 hover:text-green-600">Tentang</Link>
              <Link href="/kontak" className="block py-2 text-gray-700 hover:text-green-600">Kontak</Link>
              <Link href="/profil" className="block py-2 text-gray-700 hover:text-green-600">Profil</Link>
            </div>
          </div>
        )}
      </header>

      {/* Hero Section */}
      <section className="bg-gradient-to-r from-green-600 to-emerald-600 text-white py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="flex items-center justify-center mb-4">
            <img 
              src="/logo-atayatoko.png" 
              alt="ATAYATOKO" 
              className="h-12 w-auto mr-3"
            />
            <h1 className="text-3xl md:text-4xl font-bold">ATAYATOKO</h1>
          </div>
          <h2 className="text-2xl md:text-3xl font-bold mb-6">Satu Toko untuk Semua Kebutuhan!</h2>
          <div className="bg-white bg-opacity-20 rounded-lg p-6 max-w-2xl mx-auto mb-8 text-black">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left">
              <div className="flex items-start">
                <div className="bg-white text-green-600 rounded-full p-2 mr-3 mt-1">
                  <Package size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-lg mb-1">Harga Ecer Terjangkau</h3>
                  <p className="text-sm opacity-90">Beli satuan pun tetap hemat!</p>
                </div>
              </div>
              <div className="flex items-start">
                <div className="bg-white text-green-600 rounded-full p-2 mr-3 mt-1">
                  <Package size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-lg mb-1">Harga Grosir Super Hemat</h3>
                  <p className="text-sm opacity-90">Beli banyak, lebih murah!</p>
                </div>
              </div>
            </div>
          </div>
          <div className="flex items-center justify-center bg-white bg-opacity-20 rounded-lg p-3 mb-8 text-black">
            <Truck size={24} className="mr-2" />
            <span className="font-semibold">Pesan dari rumah – kami antar sampai pintu!</span>
          </div>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/semua-kategori" className="bg-white text-green-600 px-8 py-3 rounded-lg font-semibold hover:bg-gray-100 transition-colors">
              Belanja Sekarang
            </Link>
            <Link href="/promo" className="border-2 border-white text-white px-8 py-3 rounded-lg font-semibold hover:bg-white hover:text-green-600 transition-colors">
              Lihat Promo
            </Link>
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Kategori Produk</h2>
            <p className="text-gray-600 max-w-2xl mx-auto">Temukan semua kebutuhan sembako Anda di sini</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6">
            {categories.map((category) => (
              <Link key={category.id} href={`/kategori/${category.slug}`} className="text-center group cursor-pointer">
                <div className="bg-gray-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3 group-hover:bg-green-100 transition-colors">
                  <Package size={24} className="text-gray-600" />
                </div>
                <h3 className="font-medium text-gray-900 group-hover:text-green-600 transition-colors text-sm">
                  {category.name}
                </h3>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Featured Products */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Produk Unggulan</h2>
            <p className="text-gray-600 max-w-2xl mx-auto">Produk sembako terbaik dengan harga ecer dan grosir</p>
          </div>
          {filteredProducts.length === 0 ? (
            <div className="col-span-full text-center py-12">
              <Package className="mx-auto text-gray-400 mb-4" size={48} />
              <p className="text-gray-600">Produk "{searchQuery}" tidak ditemukan.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
              {filteredProducts.map((product) => (
                <div key={product.id} className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow overflow-hidden">
                  <Link href={`/produk/${product.id}`}>
                    <img 
                      src={product.image} 
                      alt={product.name} 
                      className="w-full h-64 object-cover" 
                    />
                  </Link>
                  <div className="p-6">
                    <div className="flex items-center mb-2">
                      <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded">
                        {product.category}
                      </span>
                      {product.stock <= 10 && (
                        <AlertTriangle className="text-red-500 ml-2" size={16} />
                      )}
                    </div>
                    <Link href={`/produk/${product.id}`}>
                      <h3 className="font-semibold text-gray-900 mb-2 line-clamp-2">{product.name}</h3>
                    </Link>
                    <p className="text-sm text-gray-600 mb-2">{product.unit}</p>
                    <div className="flex items-center mb-3">
                      <div>
                        <span className="text-lg font-bold text-green-600">
                          Rp{product.wholesalePrice.toLocaleString('id-ID')}
                        </span>
                        <span className="text-gray-500 text-sm ml-1">/grosir</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-gray-900">
                        Rp{product.price.toLocaleString('id-ID')} /ecer
                      </span>
                    </div>
                    <div className="flex items-center justify-between mt-4">
                      <div className="flex space-x-2">
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            toggleWishlist(product.id);
                          }}
                          className="p-1.5 text-gray-500 hover:text-red-500"
                        >
                          <Heart 
                            size={18} 
                            className={wishlist.includes(product.id) ? 'fill-red-500 text-red-500' : ''}
                          />
                        </button>
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            addToCart(product);
                          }}
                          className="bg-green-600 text-white px-3 py-1.5 rounded text-sm hover:bg-green-700"
                        >
                          Tambah
                        </button>
                      </div>
                      {product.barcode && (
                        <span className="text-xs text-gray-500">#{product.barcode}</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Features */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="bg-green-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <Package size={32} className="text-green-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Ecer & Grosir</h3>
              <p className="text-gray-600">Satu toko untuk semua kebutuhan</p>
            </div>
            <div className="text-center">
              <div className="bg-blue-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <Truck size={32} className="text-blue-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Antar ke Rumah</h3>
              <p className="text-gray-600">Pesan dari rumah, kami antar</p>
            </div>
            <div className="text-center">
              <div className="bg-orange-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <Shield size={32} className="text-orange-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Harga Terbaik</h3>
              <p className="text-gray-600">Hemat untuk setiap pembelian</p>
            </div>
            <div className="text-center">
              <div className="bg-purple-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <RotateCcw size={32} className="text-purple-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Stok Lengkap</h3>
              <p className="text-gray-600">Semua kebutuhan sembako tersedia</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 bg-green-600 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <img 
            src="/logo-atayatoko.png" 
            alt="ATAYATOKO" 
            className="h-16 w-auto mx-auto mb-6"
          />
          <h2 className="text-3xl font-bold mb-4">Siap Belanja Sembako?</h2>
          <p className="text-green-100 mb-8 max-w-2xl mx-auto">
            Nikmati kemudahan belanja dengan harga ecer terjangkau dan harga grosir super hemat. Pesan sekarang dan kami antar sampai ke pintu rumah Anda!
          </p>
          <Link
            href="/semua-kategori"
            className="bg-white text-green-600 px-8 py-4 rounded-lg font-bold text-lg hover:bg-gray-100 transition-colors"
          >
            Mulai Belanja Sekarang
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center space-x-2 mb-4">
                <img 
                  src="/logo-atayatoko.png" 
                  alt="ATAYATOKO" 
                  className="h-8 w-auto"
                />
              </div>
              <p className="text-gray-400 mb-2">Ecer & Grosir</p>
              <p className="text-gray-400">Satu toko untuk semua kebutuhan!</p>
              <div className="mt-4 space-y-2 text-gray-400">
                <p>✅ Harga ecer terjangkau</p>
                <p>✅ Harga grosir super hemat</p>
                <p>🚚 Pesan dari rumah – kami antar sampai pintu!</p>
              </div>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Navigasi</h4>
              <ul className="space-y-2 text-gray-400">
                <li><Link href="/" className="hover:text-white transition-colors">Beranda</Link></li>
                <li><Link href="/cart" className="hover:text-white transition-colors">Keranjang</Link></li>
                <li><Link href="/wishlist" className="hover:text-white transition-colors">Wishlist</Link></li>
                <li><Link href="/semua-kategori" className="hover:text-white transition-colors">Kategori</Link></li>
                <li><Link href="/kontak" className="hover:text-white transition-colors">Kontak</Link></li>
                <li><Link href="/profil" className="hover:text-white transition-colors">Profil</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Kategori</h4>
              <ul className="space-y-2 text-gray-400">
                {categories.slice(0, 6).map((category) => (
                  <li key={category.id}>
                    <Link href={`/kategori/${category.slug}`} className="hover:text-white transition-colors">
                      {category.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Kontak</h4>
              <div className="space-y-2 text-gray-400">
                <p>📍 Jl. Pandan 98, Semen, Kediri</p>
                <p>📱 WhatsApp: 0858-5316-1174</p>
                <p>✉️ info@atayatoko.com</p>
                <p>🕒 Buka: Senin-Minggu, 08.00-20.00</p>
                
                {/* Akses Staff */}
                <div className="mt-6 pt-4 border-t border-gray-800">
                  <h4 className="font-semibold mb-3">Akses Staff</h4>
                  <div className="flex space-x-4">
                    <Link 
                      href="/profil/login" 
                      className="text-gray-400 hover:text-white transition-colors group"
                      title="Login Admin"
                    >
                      <ShieldCheck size={20} className="group-hover:text-green-400" />
                    </Link>
                    <Link 
                      href="/cashier" 
                      className="text-gray-400 hover:text-white transition-colors group"
                      title="Login Kasir"
                    >
                      <Printer size={20} className="group-hover:text-green-400" />
                    </Link>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    Staff toko? Login di sini
                  </p>
                </div>
              </div>
            </div>
          </div>
          <div className="border-t border-gray-800 mt-8 pt-8 text-center text-gray-400">
            <p>&copy; 2025 ATAYATOKO. Ecer & Grosir - Satu Toko untuk Semua Kebutuhan!</p>
          </div>
        </div>
      </footer>

      {/* Floating Cart Button */}
      {cartCount > 0 && (
        <Link 
          href="/cart"
          className="fixed bottom-6 right-6 bg-green-600 text-white p-4 rounded-full shadow-lg hover:bg-green-700 transition-all z-40"
        >
          <div className="relative">
            <ShoppingCart size={24} />
            <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
              {cartCount}
            </span>
          </div>
        </Link>
      )}
    </div>
  );
}