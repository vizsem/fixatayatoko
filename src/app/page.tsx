// src/app/page.tsx
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  Search, ShoppingCart, User, Heart, Menu, X, Star, Truck, 
  Shield, RotateCcw, Award, Package, Store, 
  ShieldCheck, Printer  // ✅ Impor ikon baru
} from 'lucide-react';
import { 
  PRODUCTS, 
  CATEGORIES, 
  type Product, 
  getWishlist, 
  addToWishlist, 
  removeFromWishlist 
} from '@/lib/products';

const StarRating = ({ rating }: { rating: number }) => {
  return (
    <div className="flex items-center">
      {[...Array(5)].map((_, i) => (
        <Star
          key={i}
          size={16}
          className={i < Math.floor(rating) ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}
        />
      ))}
      <span className="ml-1 text-sm text-gray-600">{rating}</span>
    </div>
  );
};

// Helper: konversi nama kategori ke slug
const categoryToSlug = (name: string): string => {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
};

export default function Home() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [cartCount, setCartCount] = useState(0);
  const [wishlist, setWishlist] = useState<number[]>([]);

  // Load cart & wishlist dari localStorage
  useEffect(() => {
    // Cart
    const savedCart = localStorage.getItem('atayatoko-cart');
    if (savedCart) {
      try {
        const cart = JSON.parse(savedCart);
        const total = cart.reduce((sum: number, item: any) => sum + item.quantity, 0);
        setCartCount(total);
      } catch (e) {
        setCartCount(0);
      }
    }
    
    // Wishlist
    const wl = getWishlist();
    setWishlist(wl);
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

  const toggleWishlist = (productId: number) => {
    if (wishlist.includes(productId)) {
      removeFromWishlist(productId);
      setWishlist(prev => prev.filter(id => id !== productId));
    } else {
      addToWishlist(productId);
      setWishlist(prev => [...prev, productId]);
    }
  };

  // Filter produk berdasarkan pencarian
  const filteredProducts = PRODUCTS.filter(product =>
    product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    product.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Data statis yang tidak perlu dari lib
  const promoBanners = [
    { id: 1, title: 'Harga Ecer Terjangkau', description: 'Beli satuan pun hemat!', image: 'https://placehold.co/800x400/f59e0b/ffffff?text=Harga+Ecer  ' },
    { id: 2, title: 'Harga Grosir Super Hemat', description: 'Beli banyak lebih murah!', image: 'https://placehold.co/800x400/ef4444/ffffff?text=Harga+Grosir  ' },
    { id: 3, title: 'Gratis Ongkir', description: 'Minimal belanja Rp100.000', image: 'https://placehold.co/800x400/10b981/ffffff?text=Gratis+Ongkir  ' }
  ];

  const testimonials = [
    { id: 1, name: 'Ibu Siti', rating: 5, comment: 'Harga grosirnya benar-benar murah! Sekarang belanja bulanan jadi lebih hemat.', avatar: 'https://placehold.co/60x60/6366f1/ffffff?text=IS  ' },
    { id: 2, name: 'Pak Budi', rating: 5, comment: 'Pengiriman cepat dan barang lengkap. Toko sembako favorit keluarga!', avatar: 'https://placehold.co/60x60/8b5cf6/ffffff?text=PB  ' },
    { id: 3, name: 'Bu Rina', rating: 4, comment: 'Bisa beli ecer atau grosir sesuai kebutuhan. Sangat praktis!', avatar: 'https://placehold.co/60x60/06b6d4/ffffff?text=BR  ' }
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="flex items-center space-x-2">
                  <Store className="text-green-600" size={32} />
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
              <a href="#" className="text-gray-700 hover:text-green-600 font-medium">Promo</a>
              <a href="#" className="text-gray-700 hover:text-green-600 font-medium">Tentang</a>
              <Link href="/kontak" className="text-gray-700 hover:text-green-600 font-medium">Kontak</Link>
            </nav>

            <div className="hidden md:flex flex-1 max-w-lg mx-8">
              <div className="relative w-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                <input
                  type="text"
                  placeholder="Cari produk sembako..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
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
              <input
                type="text"
                placeholder="Cari produk sembako..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
              />
            </div>
          </div>
        </div>

        {isMenuOpen && (
          <div className="md:hidden bg-white border-t">
            <div className="px-4 py-2 space-y-2">
              <Link href="/" className="block py-2 text-gray-700 hover:text-green-600">Beranda</Link>
              <Link href="/semua-kategori" className="block py-2 text-gray-700 hover:text-green-600">Kategori</Link>
              <a href="#" className="block py-2 text-gray-700 hover:text-green-600">Promo</a>
              <a href="#" className="block py-2 text-gray-700 hover:text-green-600">Tentang</a>
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
            <Store size={48} className="mr-3" />
            <h1 className="text-3xl md:text-4xl font-bold">ATAYATOKO</h1>
          </div>
          <h2 className="text-2xl md:text-3xl font-bold mb-6">Satu Toko untuk Semua Kebutuhan Sembako!</h2>
          <div className="bg-white bg-opacity-20 rounded-lg p-6 max-w-2xl mx-auto mb-8">
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
          <div className="flex items-center justify-center bg-white bg-opacity-20 rounded-lg p-3 mb-8">
            <Truck size={24} className="mr-2" />
            <span className="font-semibold">🚚 Pesan dari rumah – kami antar sampai pintu!</span>
          </div>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/" className="bg-white text-green-600 px-8 py-3 rounded-lg font-semibold hover:bg-gray-100 transition-colors">
              Belanja Sekarang
            </Link>
            <button className="border-2 border-white text-white px-8 py-3 rounded-lg font-semibold hover:bg-white hover:text-green-600 transition-colors">
              Lihat Promo
            </button>
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
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-6">
            {CATEGORIES.map((category) => (
              <Link key={category.id} href={`/kategori/${category.slug}`} className="text-center group cursor-pointer">
                <div className="bg-gray-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3 group-hover:bg-green-100 transition-colors">
                  <span className="text-2xl">{category.icon}</span>
                </div>
                <h3 className="font-medium text-gray-900 group-hover:text-green-600 transition-colors text-sm">
                  {category.name}
                </h3>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Promo Banners */}
      <section className="py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {promoBanners.map((banner) => (
              <div key={banner.id} className="relative rounded-lg overflow-hidden h-48">
                <img src={banner.image} alt={banner.title} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black bg-opacity-40 flex items-center justify-center">
                  <div className="text-center text-white">
                    <h3 className="text-xl md:text-2xl font-bold mb-2">{banner.title}</h3>
                    <p className="text-base">{banner.description}</p>
                  </div>
                </div>
              </div>
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
                    <img src={product.image.trim()} alt={product.name} className="w-full h-64 object-cover" />
                  </Link>
                  <div className="p-6">
                    <div className="flex items-center mb-2">
                      <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded">
                        {product.category}
                      </span>
                    </div>
                    <Link href={`/produk/${product.id}`}>
                      <h3 className="font-semibold text-gray-900 mb-2 line-clamp-2">{product.name}</h3>
                    </Link>
                    <p className="text-sm text-gray-600 mb-2">{product.unit}</p>
                    <StarRating rating={product.rating} />
                    <div className="flex items-center justify-between mt-4">
                      <div>
                        <span className="text-xl font-bold text-gray-900">
                          Rp{product.price.toLocaleString('id-ID')}
                        </span>
                        {product.originalPrice > product.price && (
                          <span className="text-gray-500 line-through ml-2">
                            Rp{product.originalPrice.toLocaleString('id-ID')}
                          </span>
                        )}
                      </div>
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

      {/* Testimonials */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Ulasan Pelanggan</h2>
            <p className="text-gray-600 max-w-2xl mx-auto">Lihat apa yang dikatakan pelanggan setia kami</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {testimonials.map((testimonial) => (
              <div key={testimonial.id} className="bg-white p-6 rounded-lg shadow-md">
                <div className="flex items-center mb-4">
                  <img src={testimonial.avatar} alt={testimonial.name} className="w-12 h-12 rounded-full mr-4" />
                  <div>
                    <h4 className="font-semibold text-gray-900">{testimonial.name}</h4>
                    <div className="flex">
                      {[...Array(testimonial.rating)].map((_, i) => (
                        <Star key={i} size={16} className="fill-yellow-400 text-yellow-400" />
                      ))}
                    </div>
                  </div>
                </div>
                <p className="text-gray-600 italic">"{testimonial.comment}"</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 bg-green-600 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <Store size={64} className="mx-auto mb-6" />
          <h2 className="text-3xl font-bold mb-4">Siap Belanja Sembako?</h2>
          <p className="text-green-100 mb-8 max-w-2xl mx-auto">
            Nikmati kemudahan belanja sembako dengan harga ecer terjangkau dan harga grosir super hemat. Pesan sekarang dan kami antar sampai ke pintu rumah Anda!
          </p>
          <Link
            href="/"
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
                <Store className="text-green-400" size={28} />
                <h3 className="text-xl font-bold">ATAYATOKO</h3>
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
                {CATEGORIES.slice(0, 6).map((category) => (
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
                <p>📍 Jl. Pandan 98, Semen, kediri</p>
                <p>📱 WhatsApp: 0858-5316-1174</p>
                <p>✉️ info@atayatoko.com</p>
                <p>🕒 Buka: Senin-Minggu, 08.00-20.00</p>
                
                {/* ✅ IKON ADMIN & KASIR KECIL DI FOOTER */}
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
                      href="/profil/login" 
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