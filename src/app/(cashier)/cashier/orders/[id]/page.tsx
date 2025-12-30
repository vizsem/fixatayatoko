// src/app/(admin)/orders/[id]/page.tsx atau cashier
import OrderMap from '@/components/OrderMap';

// Di dalam komponen
{order.deliveryLocation && (
  <div className="mt-6">
    <h3 className="text-lg font-semibold text-black mb-3">Lokasi Pengiriman</h3>
    <OrderMap 
      lat={order.deliveryLocation.lat} 
      lng={order.deliveryLocation.lng}
      address={order.deliveryAddress}
    />
  </div>
)}