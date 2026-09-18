'use client';

import dynamic from 'next/dynamic';

// FCMManager uses browser-only APIs (firebase/messaging, Notification, ServiceWorker)
// so it must be loaded client-side only via a Client Component wrapper.
const FCMManager = dynamic(() => import('@/components/FCMManager'), { ssr: false });

export default function FCMManagerLoader() {
  return <FCMManager />;
}
