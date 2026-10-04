import { NextResponse } from 'next/server';
import { briDeriveExternalId, briSnapRequest } from '@/lib/briSnap';

const addMinutesJakartaIso = (minutes: number) => {
  const now = Date.now();
  const target = new Date(now + minutes * 60 * 1000);
  const ms = target.getTime() + 7 * 60 * 60 * 1000;
  const j = new Date(ms);
  const pad2 = (n: number) => String(n).padStart(2, '0');
  return `${j.getUTCFullYear()}-${pad2(j.getUTCMonth() + 1)}-${pad2(j.getUTCDate())}T${pad2(j.getUTCHours())}:${pad2(j.getUTCMinutes())}:${pad2(j.getUTCSeconds())}+07:00`;
};

/**
 * POST /api/payments/bri/qris/generate
 * Generate QRIS MPM Dinamis langsung dari kasir (tanpa orderId Supabase).
 * Body: { referenceNo: string, amount: number, description?: string }
 * Returns: { qrContent, referenceNo, externalId, expiresAt }
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const referenceNo = String(body?.referenceNo || '');
    const amount = Number(body?.amount);

    if (!referenceNo) {
      return NextResponse.json({ error: 'referenceNo wajib' }, { status: 400 });
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: 'amount harus > 0' }, { status: 400 });
    }

    const externalId = briDeriveExternalId(referenceNo);
    const expiresAt = addMinutesJakartaIso(15);

    const path = process.env.BRI_QRIS_GENERATE_PATH || '/snap/v1.0/qr/qr-mpm-generate';
    const callbackUrl =
      process.env.BRI_SNAP_CALLBACK_URL ||
      (process.env.NEXT_PUBLIC_APP_URL
        ? `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/bri/qris`
        : '');

    const payload = {
      merchantId: process.env.BRI_SNAP_MERCHANT_ID,
      terminalId: process.env.BRI_SNAP_TERMINAL_ID,
      partnerReferenceNo: referenceNo,
      amount: { value: amount.toFixed(2), currency: 'IDR' },
      feeAmount: { value: '0.00', currency: 'IDR' },
      validityPeriod: expiresAt,
      additionalInfo: {
        ...(callbackUrl ? { callback: callbackUrl } : {}),
        ...(body?.description ? { productDetail: [{ name: body.description, quantity: 1, price: amount.toFixed(2) }] } : {}),
      },
    };

    const resp = await briSnapRequest({
      method: 'POST',
      path,
      body: payload,
      externalId,
    });

    if (!resp.ok) {
      const msg = String((resp.data as any)?.responseMessage || (resp.data as any)?.error || 'Gagal generate QRIS');
      return NextResponse.json({ error: msg, raw: resp.data }, { status: 502 });
    }

    const qrContent = String((resp.data as any)?.qrContent || (resp.data as any)?.qrString || '');
    const briReferenceNo = String((resp.data as any)?.referenceNo || (resp.data as any)?.qrReferenceNo || referenceNo);

    return NextResponse.json({
      qrContent,
      referenceNo: briReferenceNo,
      partnerReferenceNo: referenceNo,
      externalId,
      expiresAt,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 });
  }
}
