'use client';
import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { Ticket, Save, Info, ArrowRightLeft, Coins } from 'lucide-react';

export default function PointSettings() {
  const [config, setConfig] = useState({ earningRate: 0, redemptionValue: 0, minRedeem: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchConfig = async () => {
      const snap = await getDoc(doc(db, 'settings', 'points'));
      if (snap.exists()) setConfig(snap.data() as any);
      setLoading(false);
    };
    fetchConfig();
  }, []);

  const handleSave = async () => {
    await updateDoc(doc(db, 'settings', 'points'), config);
    alert("Pengaturan point disimpan!");
  };

  return (
    <div className="p-10 bg-[#FBFBFE] min-h-screen">
      <div className="max-w-2xl">
        <h1 className="text-3xl font-black text-gray-800 uppercase tracking-tighter flex items-center gap-3 mb-10">
          <Coins className="text-orange-500" size={32} /> Point System
        </h1>

        <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm space-y-8">
          {/* Perolehan Point */}
          <div className="space-y-4">
            <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest flex items-center gap-2">
              <Ticket size={14} /> Perolehan Point (Earning)
            </label>
            <div className="flex items-center gap-4 bg-gray-50 p-6 rounded-3xl">
              <div className="flex-1">
                <p className="text-[9px] font-bold text-gray-400 uppercase mb-1">Setiap Belanja</p>
                <input 
                  type="number" 
                  className="bg-transparent text-xl font-black outline-none w-full"
                  value={config.earningRate}
                  onChange={(e) => setConfig({...config, earningRate: Number(e.target.value)})}
                />
              </div>
              <ArrowRightLeft className="text-gray-300" />
              <div className="flex-1 text-right">
                <p className="text-[9px] font-bold text-gray-400 uppercase mb-1">Dapat Point</p>
                <p className="text-xl font-black text-orange-500">1 POINT</p>
              </div>
            </div>
          </div>

          {/* Penukaran Point */}
          <div className="space-y-4">
            <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest flex items-center gap-2">
              <ArrowRightLeft size={14} /> Nilai Tukar (Redemption)
            </label>
            <div className="flex items-center gap-4 bg-gray-50 p-6 rounded-3xl">
              <div className="flex-1">
                <p className="text-[9px] font-bold text-gray-400 uppercase mb-1">1 Point Sama Dengan</p>
                <div className="flex items-center gap-2">
                   <span className="text-xl font-black text-orange-500">Rp</span>
                   <input 
                    type="number" 
                    className="bg-transparent text-xl font-black outline-none w-full"
                    value={config.redemptionValue}
                    onChange={(e) => setConfig({...config, redemptionValue: Number(e.target.value)})}
                  />
                </div>
              </div>
            </div>
          </div>

          <button 
            onClick={handleSave}
            className="w-full bg-black text-white py-6 rounded-3xl text-[10px] font-black uppercase tracking-[0.2em] shadow-xl hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2"
          >
            <Save size={18} /> Simpan Konfigurasi
          </button>
        </div>

        <div className="mt-8 p-6 bg-orange-50 rounded-3xl border border-orange-100 flex gap-4 items-start">
          <Info className="text-orange-500 flex-shrink-0" />
          <p className="text-[10px] font-bold text-orange-800 uppercase leading-relaxed tracking-wide">
            Tips: Biasanya rasio earning ke redemption adalah 10:1. Misal belanja 10rb dapat 1 point, dan 1 point bernilai 100 rupiah (diskon 1%).
          </p>
        </div>
      </div>
    </div>
  );
}