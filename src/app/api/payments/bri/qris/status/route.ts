import { NextResponse } from 'next/server';
import { briDeriveExternalId, briSnapRequest } from '@/lib/briSnap';

/**
 * GET /api/payments/bri/qris/status?referenceNo=xxx
 * Poll status QRIS MPM Dinamis dari BRI SNAP.
 * Returns: { paid: boolean, status: string, referenceNo: string }
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const referenceNo = searchParams.get('referenceNo') || '';

    if (!referenceNo) {
      return NextResponse.json({ error: 'referenceNo wajib' }, { status: 400 });
    }

    const externalId = briDeriveExternalId(referenceNo);
    const path = process.env.BRI_QRIS_STATUS_PATH || '/snap/v1.0/qr/qr-mpm-query';

    const resp = await briSnapRequest({
      method: 'POST',
      path,
      body: {
        merchantId: process.env.BRI_SNAP_MERCHANT_ID,
        terminalId: process.env.BRI_SNAP_TERMINAL_ID,
        originalReferenceNo: referenceNo,
        serviceCode: '47',
      },
      externalId,
    });

    if (!resp.ok) {
      const msg = String((resp.data as any)?.responseMessage || (resp.data as any)?.error || 'Gagal cek status');
      return NextResponse.json({ error: msg, raw: resp.data }, { status: 502 });
    }

    const d = resp.data as any;
    const latestStatus = String(
      d?.latestTransactionStatus ||
      d?.transactionStatus ||
      d?.responseCode ||
      ''
    ).toUpperCase();

    const paid =
      latestStatus === '00' ||
      latestStatus === 'SUCCESS' ||
      latestStatus === 'PAID' ||
      latestStatus === 'SETTLED' ||
      latestStatus.startsWith('200');

    return NextResponse.json({
      paid,
      status: latestStatus || 'PENDING',
      referenceNo: String(d?.originalReferenceNo || d?.referenceNo || referenceNo),
      amount: d?.amount,
      raw: d,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 });
  }
}
