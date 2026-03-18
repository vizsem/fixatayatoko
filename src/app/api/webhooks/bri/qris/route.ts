import { NextResponse } from 'next/server';
import { adminDb, FieldValue } from '@/lib/firebaseAdmin';
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
  if (!adminDb || typeof adminDb.collection !== 'function') {
    return NextResponse.json({ error: 'Server Misconfiguration: Database connection failed.' }, { status: 500 });
  }

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

  try {
    let orderQuery: any = adminDb.collection('orders');
    if (partnerReferenceNo) {
      orderQuery = orderQuery.where('orderId', '==', partnerReferenceNo);
    } else if (originalReferenceNo) {
      orderQuery = orderQuery.where('payment.bri.referenceNo', '==', originalReferenceNo);
    } else if (externalId) {
      orderQuery = orderQuery.where('payment.bri.externalId', '==', externalId);
    } else {
      await adminDb.collection('bri_webhook_logs').add({
        type: 'QRIS',
        verified,
        headers: Object.fromEntries(req.headers.entries()),
        body,
        createdAt: FieldValue.serverTimestamp(),
      });
      return NextResponse.json({ ok: true });
    }

    const snap = await orderQuery.limit(1).get();
    if (snap.empty) {
      await adminDb.collection('bri_webhook_logs').add({
        type: 'QRIS',
        verified,
        headers: Object.fromEntries(req.headers.entries()),
        body,
        createdAt: FieldValue.serverTimestamp(),
      });
      return NextResponse.json({ ok: true });
    }

    const orderDoc = snap.docs[0];
    const paid = isPaidStatus(body);
    const patch: Record<string, unknown> = {
      paymentStatus: paid ? 'PAID' : 'UNPAID',
      payment: {
        bri: {
          lastNotification: {
            verified,
            headers: {
              'x-timestamp': timestamp,
              'x-client-key': clientKey,
              'x-signature': signature,
              'x-external-id': externalId,
            },
            body,
            receivedAt: FieldValue.serverTimestamp(),
          },
        },
      },
      updatedAt: FieldValue.serverTimestamp(),
    };
    if (paid) patch.status = 'MENUNGGU';

    await orderDoc.ref.set(
      patch,
      { merge: true },
    );

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Webhook error' }, { status: 500 });
  }
}
