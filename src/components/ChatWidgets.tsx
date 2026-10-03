'use client';

import dynamic from 'next/dynamic';

const CustomerChatWidget = dynamic(() => import('@/components/CustomerChatWidget'), { ssr: false });
const FloatingChatButton = dynamic(() => import('@/components/FloatingChatButton'), { ssr: false });

export default function ChatWidgets() {
  return (
    <>
      <CustomerChatWidget />
      <FloatingChatButton />
    </>
  );
}
