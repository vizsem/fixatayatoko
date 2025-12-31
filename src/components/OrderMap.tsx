'use client';

import { useEffect, useRef } from 'react';
import { MapPin } from 'lucide-react';

export default function OrderMap({ 
  lat, 
  lng, 
  address 
}: { 
  lat: number; 
  lng: number; 
  address: string; 
}) {
  const mapRef = useRef<HTMLDivElement>(null);
  const googleMapRef = useRef<any>(null); // Menyimpan instance peta agar bisa di-update

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      console.warn('Google Maps API key tidak ditemukan. Peta tidak dapat dimuat.');
      return;
    }

    const scriptId = 'google-maps-script';

    // Fungsi Inisialisasi Peta
    const initMap = () => {
      if (!mapRef.current || !(window as any).google?.maps) return;

      const position = { lat: Number(lat), lng: Number(lng) };

      // Jika peta sudah pernah dibuat, cukup pindahkan pusatnya (lebih efisien)
      if (googleMapRef.current) {
        googleMapRef.current.setCenter(position);
        return;
      }

      // Buat instance peta baru
      const map = new (window as any).google.maps.Map(mapRef.current, {
        zoom: 15,
        center: position,
        mapId: "DEMO_MAP_ID", // Opsional: Untuk fitur advanced map
        disableDefaultUI: false,
        zoomControl: true,
      });

      // Tambahkan Marker
      new (window as any).google.maps.Marker({
        position: position,
        map: map,
        title: address,
        animation: (window as any).google.maps.Animation.DROP
      });

      googleMapRef.current = map;
    };

    // Logika Pemuatan Script
    if (!(window as any).google?.maps) {
      if (!document.getElementById(scriptId)) {
        const script = document.createElement('script');
        script.id = scriptId;
        script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}`;
        script.async = true;
        script.defer = true;
        script.onload = initMap;
        document.head.appendChild(script);
      } else {
        // Jika script sedang dimuat oleh komponen lain, tunggu sebentar
        const check = setInterval(() => {
          if ((window as any).google?.maps) {
            clearInterval(check);
            initMap();
          }
        }, 100);
      }
    } else {
      initMap();
    }
  }, [lat, lng, address]);

  return (
    <div className="border border-gray-200 rounded-[2rem] overflow-hidden shadow-sm bg-white no-print">
      <div ref={mapRef} className="h-72 w-full bg-gray-50" />
      <div className="p-4 bg-white border-t border-gray-100">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-red-50 rounded-xl">
            <MapPin className="text-red-500 flex-shrink-0" size={18} />
          </div>
          <div>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-0.5">Alamat Pengiriman</p>
            <p className="text-xs font-bold text-gray-900 leading-relaxed uppercase">{address || 'Alamat tidak tersedia'}</p>
            <p className="text-[9px] text-gray-400 font-medium mt-1">
              Koordinat: {lat}, {lng}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}