// src/components/OrderMap.tsx
'use client';

import { useEffect, useRef } from 'react';

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

    // Load Google Maps API
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=AIzaSyDV5Oz_zphv8UatLlZssdLkrbHSIZ8fOZI`;
    script.async = true;
    script.onload = () => {
      if (!mapRef.current) return;
      
      const map = new (window as any).google.maps.Map(mapRef.current, {
        zoom: 14,
        center: { lat, lng },
        mapTypeId: (window as any).google.maps.MapTypeId.ROADMAP
      });

      // Tambahkan marker
      new (window as any).google.maps.Marker({
        position: { lat, lng },
        map: map,
        title: address
      });
    };
    document.head.appendChild(script);

    return () => {
      if (document.head.contains(script)) {
        document.head.removeChild(script);
      }
    };
  }, [lat, lng, address]);

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <div ref={mapRef} className="h-64 w-full" />
      <div className="p-3 bg-gray-50 text-sm">
        <div className="flex items-start">
          <MapPin className="text-red-500 mt-0.5 mr-2 flex-shrink-0" size={16} />
          <span>{address}</span>
        </div>
        <p className="text-xs text-gray-500 mt-1">
          Koordinat: {lat.toFixed(6)}, {lng.toFixed(6)}
        </p>
      </div>
    </div>
  );
}

import { MapPin } from 'lucide-react';