import NextImage from 'next/image';
import { Package, Sparkles } from 'lucide-react';

interface PromoProps {
  product: any;
  onTake: () => void;
}

export function CartPromoBanner({ product, onTake }: PromoProps) {
  if (!product) return null;

  return (
    <div className="bg-gradient-to-br from-orange-500 via-red-600 to-rose-700 rounded-[2.5rem] p-8 text-white shadow-2xl relative overflow-hidden mb-8 group">
       <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="flex-1 text-center md:text-left">
            <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-md px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest mb-4">
               <Sparkles size={14} className="text-yellow-300 animate-pulse" /> Limited Opportunity
            </div>
            <h3 className="text-3xl font-black uppercase tracking-tighter leading-none mb-3">
              Tebus Murah <span className="text-yellow-300">Rp 10.000</span>
            </h3>
            <p className="text-sm font-bold opacity-90 mb-6 max-w-md">
              Dapatkan <span className="underline decoration-2 underline-offset-4">{product.Nama || product.name}</span> seharga 10rb saja karena belanjaanmu sudah mencapai target!
            </p>
            <button 
              onClick={onTake}
              className="bg-white text-rose-600 px-10 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl hover:scale-105 active:scale-95 transition-all"
            >
              Klaim Sekarang
            </button>
          </div>
          
          <div className="relative w-40 h-40 md:w-56 md:h-56">
             <div className="absolute inset-0 bg-white/10 rounded-full blur-3xl animate-pulse" />
             <div className="relative w-full h-full bg-white rounded-[2.5rem] p-3 shadow-2xl rotate-6 group-hover:rotate-0 transition-transform duration-500">
                <NextImage 
                  src={product.Link_Foto || product.image || '/logo-atayatoko.png'} 
                  alt="Promo" 
                  fill
                  className="object-cover rounded-[1.5rem]" 
                />
             </div>
          </div>
       </div>

       {/* Decorative Background Elements */}
       <div className="absolute top-0 right-0 p-10 opacity-10 -rotate-12 translate-x-1/4">
         <Package size={300} />
       </div>
       <div className="absolute bottom-0 left-0 p-10 opacity-10 rotate-45 -translate-x-1/4">
         <Sparkles size={200} />
       </div>
    </div>
  );
}
