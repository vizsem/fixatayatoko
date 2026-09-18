import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { briVerifyAsymmetricSignature } from '@/lib/briSnap';

const isPaidStatus = (data: any) => {
  const latest = String(data?.latestTransactionStatus || data?.transactionStatus || data?.status || '').toUpperCase();
  if (latest === '00' || latest === 'SUCCESS' || latest === 'PAID' || latest === 'SETTLED') return true;
  const responseCode = String(data?.responseCode || '');
  if (responseCode.startsWith('200')) return true;
  return false;
};

const pickReference = (data: any) => {
  const partnerReferenceNo = String(data?.partnerReferenceNo || data?.partner_reference_no || data?.additionalInfo?.partnerReferenceNo || '');
  const originalReferenceNo = String(data?.originalReferenceNo || data?.original_reference_no || data?.referenceNo || data?.qrReferenceNo || '');
  return { partnerReferenceNo, originalReferenceNo };
};

export async function POST(req: Request) {
  const rawBody = await req.text();
  let body: any = {};
  try {
    body = rawBody ? JSON.parse(rawBody) : {};
  } catch {
    body = {};
  }

  const timestamp = req.headers.get('x-timestamp') || '';
  const clientKey = req.headers.get('x-client-key') || '';
  const signature = req.headers.get('x-signature') || '';

  let verified = false;
  const publicKey = process.env.BRI_SNAP_PUBLIC_KEY ? process.env.BRI_SNAP_PUBLIC_KEY.replace(/\\n/g, '\n') : '';
  if (publicKey && timestamp && clientKey && signature) {
    try {
      verified = briVerifyAsymmetricSignature({
        publicKeyPem: publicKey,
        clientKey,
        timestamp,
        signatureBase64: signature,
      });
    } catch {
      verified = false;
    }
  }

  const { partnerReferenceNo, originalReferenceNo } = pickReference(body);
  const externalId = String(req.headers.get('x-external-id') || '');
  const now = new Date().toISOString();

  try {
    let orderQuery = supabase.from('orders').select('*');
    if (partnerReferenceNo) {
      orderQuery = orderQuery.or(`order_id.eq.${partnerReferenceNo},id.eq.${partnerReferenceNo}`);
    } else if (originalReferenceNo) {
      orderQuery = orderQuery.eq('raw_data->payment->bri->>referenceNo', originalReferenceNo);
    } else if (externalId) {
      orderQuery = orderQuery.eq('raw_data->payment->bri->>externalId', externalId);
    } else {
      await supabase.from('bri_webhook_logs').insert({
        id: `wh_${Date.now()}`,
        raw_data: {
          type: 'QRIS',
          verified,
          headers: Object.fromEntries(req.headers.entries()),
          body,
          createdAt: now,
        },
        created_at: now,
      });
      return NextResponse.json({ ok: true });
    }

    const { data: orders } = await orderQuery.limit(1);
    if (!orders || orders.length === 0) {
      await supabase.from('bri_webhook_logs').insert({
        id: `wh_${Date.now()}`,
        raw_data: {
          type: 'QRIS',
          verified,
          headers: Object.fromEntries(req.headers.entries()),
          body,
          createdAt: now,
        },
        created_at: now,
      });
      return NextResponse.json({ ok: true });
    }

    const orderDoc = orders[0];
    const orderData = orderDoc.raw_data || {};
    const paid = isPaidStatus(body);

    const mergedRaw = {
      ...orderData,
      paymentStatus: paid ? 'PAID' : 'UNPAID',
      status: paid ? 'MENUNGGU' : (orderData.status || 'PENDING'),
      payment: {
        ...(orderData.payment || {}),
        bri: {
          ...(orderData.payment?.bri || {}),
          lastNotification: {
            verified,
            headers: {
              'x-timestamp': timestamp,
              'x-client-key': clientKey,
              'x-signature': signature,
              'x-external-id': externalId,
            },
            body,
            receivedAt: now,
          },
        },
      },
      updatedAt: now,
    };

    await supabase.from('orders').update({
      status: paid ? 'MENUNGGU' : orderDoc.status,
      raw_data: mergedRaw,
      updated_at: now,
    }).eq('id', orderDoc.id);

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Webhook error' }, { status: 500 });
  }
}
