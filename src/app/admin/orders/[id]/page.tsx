import { notFound, redirect } from 'next/navigation';
import { getOrderDetail } from '@/lib/actions/order-admin.actions';
import OrderDetailClient, { Order, StoreSettings } from './OrderDetailClient';

export const dynamic = 'force-dynamic';

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const detail = await getOrderDetail(String(id));
  if (!detail.ok) {
    const err = detail.error?.toLowerCase() || '';
    if (err.includes('auth') || err.includes('login') || err.includes('sesi') || err.includes('unauthenticated')) {
      redirect('/profil/login');
    }
    return (
      <div className="p-20 text-center font-black uppercase text-red-500 tracking-tighter italic">
        {detail.error || 'Gagal memuat pesanan.'}
      </div>
    );
  }

  const data = detail.data;
  if (!data?.order) {
    notFound();
  }

  const order = data.order as unknown as Order;
  const rawSettings = data.settings as any;
  const storeSettings = (rawSettings?.store || rawSettings || null) as StoreSettings | null;

  return (
    <OrderDetailClient
      initialOrder={order}
      initialSettings={storeSettings}
      id={id}
    />
  );
}
