'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Package, Gift } from 'lucide-react';
import { Promotion } from '@/lib/types';

interface Banner {
  id?: string;
  title: string;
  subtitle: string;
  buttonText: string;
  gradient: string;
  imageUrl?: string;
  linkUrl?: string;
  isActive: boolean;
}

interface HomeBannersProps {
  banners: Banner[];
  activePromos: Promotion[];
}

export const HomeBanners = ({ banners, activePromos }: HomeBannersProps) => {
  return (
    <section className="px-4 py-4 max-w-7xl mx-auto">
      <div className="flex overflow-x-auto snap-x snap-mandatory gap-4 scrollbar-hide pb-2">
        {/* Main Welcome Banner */}
        <div className="min-w-[92%] md:min-w-full snap-center rounded-[2.5rem] bg-gradient-to-br from-green-600 to-emerald-800 text-white p-8 relative overflow-hidden shadow-lg">
          <div className="relative z-10">
            <h2 className="text-2xl md:text-3xl font-black mb-1 uppercase tracking-tighter">Pusat Grosir Satu Toko Semua Kebutuhan</h2>
            <p className="text-green-100 text-[11px] mb-6 max-w-[200px] leading-relaxed italic">Belanja eceran rasa grosir, dikirim langsung ke pintu.</p>
            <Link href="/search" className="inline-block bg-white text-green-700 px-5 py-2 rounded-xl font-black text-[10px] uppercase shadow-xl tap-active">Mulai Belanja</Link>
          </div>
          <Package size={160} className="absolute -right-10 -bottom-10 opacity-10 rotate-12" />
        </div>

        {/* Dynamic Banners */}
        {banners.map((bn) => (
          <div key={bn.id} className={`min-w-[92%] md:min-w-full snap-center rounded-[2.5rem] bg-gradient-to-r ${bn.gradient} text-white p-8 relative overflow-hidden shadow-lg`}>
            <div className="relative z-10">
              <span className="bg-white/20 text-[8px] font-black px-2 py-0.5 rounded-full uppercase mb-2 inline-block">Pengumuman</span>
              <h2 className="text-2xl md:text-3xl font-black mb-1 uppercase tracking-tighter">{bn.title}</h2>
              <p className="text-white/90 text-[11px] mb-6">{bn.subtitle}</p>
              <Link href={bn.linkUrl || '/search'} className="inline-block bg-white text-black px-5 py-2 rounded-xl font-black text-[10px] uppercase shadow-xl tap-active">
                {bn.buttonText || 'Lihat'}
              </Link>
            </div>
            {bn.imageUrl ? (
              <div className="absolute -right-6 -bottom-6 w-40 h-40 opacity-20 rotate-12">
                <Image 
                  src={bn.imageUrl} 
                  alt="Banner" 
                  fill
                  priority
                  className="object-cover rounded-2xl" 
                />
              </div>
            ) : null}
          </div>
        ))}

        {/* Promo Banners */}
        {activePromos.map(p => (
          <div key={p.id} className="min-w-[92%] md:min-w-full snap-center rounded-[2.5rem] bg-gradient-to-br from-orange-500 to-red-600 text-white p-8 relative overflow-hidden shadow-lg">
            <div className="relative z-10">
              <span className="bg-white/20 text-[8px] font-black px-2 py-0.5 rounded-full uppercase mb-2 inline-block">Flash Sale Aktif</span>
              <h2 className="text-2xl md:text-3xl font-black mb-1 uppercase tracking-tighter">{p.name}</h2>
              <p className="text-orange-50 text-[11px] mb-6">Diskon hingga {p.discountValue.toLocaleString()} {p.discountType === 'percentage' ? '%' : 'Rp'}</p>
              <Link href="/search" className="inline-block bg-white text-orange-600 px-5 py-2 rounded-xl font-black text-[10px] uppercase shadow-xl tap-active">Lihat Promo</Link>
            </div>
            <Gift size={160} className="absolute -right-10 -bottom-10 opacity-10 rotate-12" />
          </div>
        ))}
      </div>
    </section>
  );
};
