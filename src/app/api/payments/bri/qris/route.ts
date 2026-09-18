import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { briDeriveExternalId, briSnapRequest } from '@/lib/briSnap';

const addMinutesJakartaIso = (minutes: number) => {
  const now = Date.now();
  const target = new Date(now + minutes * 60 * 1000);
  const ms = target.getTime() + 7 * 60 * 60 * 1000;
  const j = new Date(ms);
  const pad2 = (n: number) => String(n).padStart(2, '0');
  const yyyy = j.getUTCFullYear();
  const mm = pad2(j.getUTCMonth() + 1);
  const dd = pad2(j.getUTCDate());
  const hh = pad2(j.getUTCHours());
  const min = pad2(j.getUTCMinutes());
  const ss = pad2(j.getUTCSeconds());
  return `${yyyy}-${mm}-${dd}T${hh}:${min}:${ss}+07:00`;
};

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const orderId = String(body?.orderId || '');
    if (!orderId) return NextResponse.json({ error: 'orderId wajib' }, { status: 400 });

    const { data: orders, error: findError } = await supabase
      .from('orders')
      .select('*')
      .or(`order_id.eq.${orderId},id.eq.${orderId}`)
      .limit(1);

    if (findError || !orders || orders.length === 0) {
      return NextResponse.json({ error: 'Order tidak ditemukan' }, { status: 404 });
    }

    const orderDoc = orders[0];
    const orderData = orderDoc.raw_data || {};
    const amountValue = Number(orderDoc.total ?? orderData.total ?? 0);
    if (!Number.isFinite(amountValue) || amountValue <= 0) {
      return NextResponse.json({ error: 'Total order tidak valid' }, { status: 400 });
    }

    const externalId = briDeriveExternalId(orderId);

    const path = process.env.BRI_QRIS_GENERATE_PATH || '/snap/v1.0/qr/qr-mpm-generate';
    const callbackUrl =
      process.env.BRI_SNAP_CALLBACK_URL ||
      (process.env.NEXT_PUBLIC_APP_URL ? `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/bri/qris` : '');

    const payload: any = {
      merchantId: process.env.BRI_SNAP_MERCHANT_ID,
      terminalId: process.env.BRI_SNAP_TERMINAL_ID,
      partnerReferenceNo: orderId,
      amount: { value: amountValue.toFixed(2), currency: 'IDR' },
      feeAmount: { value: '0.00', currency: 'IDR' },
      validityPeriod: addMinutesJakartaIso(15),
      additionalInfo: callbackUrl ? { callback: callbackUrl } : {},
    };

    const resp = await briSnapRequest({
      method: 'POST',
      path,
      body: payload,
      externalId,
    });

    const now = new Date().toISOString();

    if (!resp.ok) {
      const msg = String((resp.data as any)?.responseMessage || (resp.data as any)?.error || 'Gagal generate QRIS');
      await supabase.from('orders').update({
        raw_data: {
          ...orderData,
          payment: {
            ...(orderData.payment || {}),
            bri: {
              provider: 'BRI_SNAP',
              partnerReferenceNo: orderId,
              externalId,
              lastError: { message: msg, data: resp.data, at: now },
            },
          },
          updatedAt: now,
        },
        updated_at: now,
      }).eq('id', orderDoc.id);

      return NextResponse.json({ error: msg, data: resp.data }, { status: 502 });
    }

    const qrContent = String((resp.data as any)?.qrContent || (resp.data as any)?.qrString || '');
    const referenceNo = String((resp.data as any)?.referenceNo || (resp.data as any)?.qrReferenceNo || '');

    await supabase.from('orders').update({
      raw_data: {
        ...orderData,
        status: orderData.status || 'PENDING',
        paymentStatus: orderData.paymentStatus || 'UNPAID',
        payment: {
          ...(orderData.payment || {}),
          method: (orderData.payment?.method || orderData.paymentMethod || 'QRIS_BRI') as string,
          bri: {
            provider: 'BRI_SNAP',
            partnerReferenceNo: orderId,
            externalId,
            referenceNo,
            qrContent,
            generatedAt: now,
          },
        },
        updatedAt: now,
      },
      updated_at: now,
    }).eq('id', orderDoc.id);

    return NextResponse.json({ orderId, qrContent, referenceNo });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 });
  }
}
