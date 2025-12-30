// src/components/OrderMap.tsx
'use client';

import { useEffect, useRef } from 'react';
import { MapPin } from 'lucide-react'; // ✅ Dipindah ke atas!

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

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // 🔑 Ambil API key dari .env.local
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      console.error('Google Maps API key tidak ditemukan di .env.local');
      return;
    }

    const scriptId = 'google-maps-script';

    // Cegah pemuatan script berulang
    if (document.getElementById(scriptId)) {
      // Tunggu hingga Google Maps siap
      const check = setInterval(() => {
        if ((window as any).google?.maps) {
          clearInterval(check);
          initMap();
        }
      }, 100);
      return;
    }

    // Buat dan muat script Google Maps
    const script = document.createElement('script');
    script.id = scriptId;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}`;
    script.async = true;
    script.onload = initMap;
    document.head.appendChild(script);

    // Fungsi inisialisasi peta
    function initMap() {
      if (!mapRef.current || !(window as any).google?.maps) return;

      const map = new (window as any).google.maps.Map(mapRef.current, {
        zoom: 14,
        center: { lat, lng },
        mapTypeId: (window as any).google.maps.MapTypeId.ROADMAP
      });

      new (window as any).google.maps.Marker({
        position: { lat, lng },
        map: map,
        title: address
      });
    }

    // Cleanup (opsional)
    return () => {
      // Tidak perlu hapus script karena bisa dipakai ulang
    };
  }, [lat, lng, address]);

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <div ref={mapRef} className="h-64 w-full bg-gray-100" />
      <div className="p-3 bg-gray-50 text-sm">
        <div className="flex items-start">
          <MapPin className="text-red-500 mt-0.5 mr-2 flex-shrink-0" size={16} />
          <span className="text-black">{address}</span>
        </div>
        <p className="text-xs text-gray-500 mt-1">
          Koordinat: {lat.toFixed(6)}, {lng.toFixed(6)}
        </p>
      </div>
    </div>
  );
}