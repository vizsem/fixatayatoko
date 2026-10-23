'use client';

import { useEffect, useState, use, Suspense, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Printer, FileText, Receipt, Download, Loader2, AlertCircle } from 'lucide-react';
import { getOrderForPrint, type PrintOrderData } from '@/lib/actions/order-admin.actions';

type PrintMode = 'a4' | 'thermal';
type PaperWidth = '58mm' | '80mm';

function PrintOrderPageInner({ id }: { id: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [order, setOrder] = useState<PrintOrderData | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [printMode, setPrintMode] = useState<PrintMode>(
    (searchParams.get('mode') as PrintMode) || 'a4'
  );
  const [paperWidth, setPaperWidth] = useState<PaperWidth>('80mm');
  const [loading, setLoading] = useState(true);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [autoPrinted, setAutoPrinted] = useState(false);
  const printTriggeredRef = useRef(false);

  useEffect(() => {
    let isMounted = true;
    async function fetchOrder() {
      setLoading(true);
      setErrorMessage(null);
      try {
        const res = await getOrderForPrint(id);
        if (!isMounted) return;
        if (!res.ok) {
          setErrorMessage(res.error);
          setOrder(null);
        } else {
          setOrder(res.data);

          // Auto-print logic:
          // Jika mode=thermal atau ada query autoprint=true, dan autoprint!=false
          const isThermal = (searchParams.get('mode') as PrintMode) === 'thermal';
          const autoprintParam = searchParams.get('autoprint');
          const shouldAutoPrint = autoprintParam === 'true' || (isThermal && autoprintParam !== 'false');

          if (shouldAutoPrint && !printTriggeredRef.current) {
            printTriggeredRef.current = true;
            setAutoPrinted(true);
            setTimeout(() => {
              window.print();
            }, 550);
          }
        }
      } catch (err) {
        if (!isMounted) return;
        setErrorMessage(err instanceof Error ? err.message : 'Gagal memuat pesanan');
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    if (id) {
      fetchOrder();
    }
    return () => {
      isMounted = false;
    };
  }, [id, searchParams]);

  const handleDownloadPdf = async () => {
    try {
      setDownloadingPdf(true);
      const targetId = printMode === 'a4' ? 'invoice-a4' : 'thermal-receipt-container';
      const el = document.getElementById(targetId);
      if (!el) {
        window.print();
        return;
      }

      const html2canvas = (await import('html2canvas')).default;
      const { jsPDF } = await import('jspdf');

      const canvas = await html2canvas(el, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
      });

      const imgData = canvas.toDataURL('image/png');
      const isA4 = printMode === 'a4';
      const targetWidthMm = isA4 ? 210 : paperWidth === '58mm' ? 58 : 80;
      const targetHeightMm = (canvas.height * targetWidthMm) / canvas.width;

      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: isA4 ? 'a4' : [targetWidthMm, Math.max(80, targetHeightMm)],
      });

      pdf.addImage(imgData, 'PNG', 0, 0, targetWidthMm, targetHeightMm);
      const safeNum = (order?.orderNumber || order?.id || 'dokumen').replace(/[^a-zA-Z0-9_-]/g, '_');
      pdf.save(`${isA4 ? 'Invoice' : 'Struk'}_${safeNum}.pdf`);
    } catch (err) {
      console.error('Gagal generate PDF:', err);
      window.print();
    } finally {
      setDownloadingPdf(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center p-8 bg-white rounded-2xl border border-gray-100 shadow-sm max-w-sm">
          <Loader2 className="w-10 h-10 text-emerald-600 animate-spin mx-auto mb-3" />
          <p className="text-sm font-black text-gray-800 uppercase tracking-wider">Memuat Dokumen Pesanan</p>
          <p className="text-xs text-gray-400 mt-1">Mengambil rincian transaksi & profil toko...</p>
        </div>
      </div>
    );
  }

  if (errorMessage || !order) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="text-center bg-white p-8 rounded-2xl border border-gray-200 shadow-sm max-w-md w-full">
          <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-3">
            <AlertCircle size={24} />
          </div>
          <h2 className="text-lg font-black text-gray-900 mb-1">Data Pesanan Tidak Ditemukan</h2>
          <p className="text-xs text-gray-500 mb-6 leading-relaxed">
            {errorMessage || `Pesanan "${id}" tidak ditemukan dalam database atau Anda belum memiliki izin akses.`}
          </p>
          <button
            onClick={() => router.back()}
            className="w-full py-2.5 bg-gray-900 hover:bg-gray-800 text-white rounded-xl text-xs font-bold transition shadow-xs"
          >
            Kembali ke Daftar Pesanan
          </button>
        </div>
      </div>
    );
  }

  const storeSettings = order.storeSettings;
  const subtotal = order.subtotal ?? order.items?.reduce((s, i) => s + i.price * i.quantity, 0) ?? 0;
  const shippingCost = order.shippingCost ?? 0;
  const discountTotal =
    (order.discount || 0) +
    (order.voucher || 0) +
    (order.pointsUsed || 0) +
    (order.walletUsed || 0);

  const orderNum = order.orderNumber.startsWith('#')
    ? order.orderNumber
    : `#${order.orderNumber}`;

  const dateStr = order.createdAt
    ? new Date(order.createdAt).toLocaleString('id-ID', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '-';

  const shortDate = order.createdAt
    ? new Date(order.createdAt).toLocaleString('id-ID', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '-';

  const isDebt = order.status === 'BELUM_LUNAS';

  return (
    <div className="min-h-screen bg-gray-100 print:bg-white text-gray-900">
      {/* ===== TOOLBAR (Hidden when printed) ===== */}
      <div className="no-print sticky top-0 z-50 bg-white border-b border-gray-200 shadow-xs">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3 flex-wrap">
          <button
            onClick={() => router.back()}
            className="p-2.5 bg-gray-50 border border-gray-200 rounded-xl hover:bg-gray-100 transition text-gray-600"
            title="Kembali"
          >
            <ArrowLeft size={18} />
          </button>

          <div className="flex-1 min-w-[200px]">
            <div className="flex items-center gap-2">
              <p className="text-xs font-black text-gray-900 uppercase tracking-tight truncate">
                {printMode === 'a4' ? 'Invoice A4' : 'Struk Thermal'} — {orderNum}
              </p>
              {order.channel && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-100 uppercase">
                  {order.channel}
                </span>
              )}
            </div>
            <p className="text-xs text-gray-400 truncate">{order.customerName}</p>
          </div>

          {/* Mode Switcher */}
          <div className="flex bg-gray-100 p-1 rounded-xl gap-1">
            <button
              onClick={() => setPrintMode('a4')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                printMode === 'a4'
                  ? 'bg-white text-blue-700 shadow-xs border border-blue-100'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <FileText size={13} /> A4 Invoice
            </button>
            <button
              onClick={() => setPrintMode('thermal')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                printMode === 'thermal'
                  ? 'bg-white text-gray-900 shadow-xs border border-gray-200'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Receipt size={13} /> Thermal
            </button>
          </div>

          {/* Thermal Paper Width Switcher */}
          {printMode === 'thermal' && (
            <div className="flex bg-gray-100 p-1 rounded-xl text-xs font-bold gap-1">
              {(['58mm', '80mm'] as PaperWidth[]).map((w) => (
                <button
                  key={w}
                  onClick={() => setPaperWidth(w)}
                  className={`px-3 py-1.5 rounded-lg transition-all ${
                    paperWidth === w ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-500'
                  }`}
                >
                  {w}
                </button>
              ))}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadPdf}
              disabled={downloadingPdf}
              className="flex items-center gap-1.5 bg-gray-100 hover:bg-gray-200 text-gray-800 px-3.5 py-2 rounded-xl text-xs font-bold transition border border-gray-200"
              title="Unduh file PDF"
            >
              {downloadingPdf ? (
                <Loader2 size={14} className="animate-spin text-gray-600" />
              ) : (
                <Download size={14} />
              )}
              <span className="hidden sm:inline">Unduh PDF</span>
            </button>

            <button
              onClick={() => window.print()}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition shadow-sm active:scale-95"
            >
              <Printer size={15} /> Cetak
            </button>
          </div>
        </div>
      </div>

      {/* ===== A4 INVOICE ===== */}
      {printMode === 'a4' && (
        <div className="max-w-3xl mx-auto my-8 print:my-0 print:max-w-none">
          <div
            id="invoice-a4"
            className="bg-white shadow-xl print:shadow-none"
            style={{ fontFamily: "'Inter', 'Segoe UI', sans-serif" }}
          >
            {/* Header Band */}
            <div className="bg-slate-900 px-10 py-8 print:px-8 print:py-7 text-white">
              <div className="flex justify-between items-start">
                <div>
                  <h1 className="text-3xl font-black tracking-tight">{storeSettings.name}</h1>
                  <p className="text-slate-300 text-sm mt-1 max-w-xs leading-relaxed">
                    {storeSettings.address}
                  </p>
                  <p className="text-slate-300 text-sm mt-0.5">
                    {storeSettings.phone}
                    {storeSettings.email && ` · ${storeSettings.email}`}
                  </p>
                </div>
                <div className="text-right">
                  <div className="inline-block bg-white/15 rounded-2xl px-5 py-3">
                    <p className="text-xs font-bold text-slate-300 uppercase tracking-widest mb-0.5">INVOICE</p>
                    <p className="text-xl font-black tracking-tight">{orderNum}</p>
                  </div>
                  <p className="text-slate-400 text-xs mt-2">{dateStr}</p>
                </div>
              </div>
            </div>

            <div className="px-10 py-8 print:px-8 print:py-6">
              {/* Bill To + Order Info */}
              <div className="grid grid-cols-2 gap-8 mb-8">
                <div>
                  <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3">Kepada</p>
                  <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100">
                    <p className="text-base font-black text-slate-900 uppercase">{order.customerName}</p>
                    {order.customerPhone && (
                      <p className="text-sm text-slate-500 mt-1">{order.customerPhone}</p>
                    )}
                    {order.deliveryAddress && (
                      <p className="text-xs text-slate-400 mt-2 leading-relaxed">{order.deliveryAddress}</p>
                    )}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3">Detail Transaksi</p>
                  <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500 font-medium">Tanggal</span>
                      <span className="font-bold text-slate-800 text-right">{dateStr}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500 font-medium">Metode Bayar</span>
                      <span className="font-black text-slate-800 uppercase">{order.paymentMethod}</span>
                    </div>
                    {order.channel && (
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-500 font-medium">Saluran / Channel</span>
                        <span className="font-bold text-indigo-700 uppercase">{order.channel}</span>
                      </div>
                    )}
                    {order.deliveryMethod && (
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-500 font-medium">Pengiriman</span>
                        <span className="font-bold text-slate-800 uppercase">{order.deliveryMethod.replace('_', ' ')}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500 font-medium">Status</span>
                      <span
                        className={`font-black text-xs px-2.5 py-1 rounded-lg uppercase ${
                          isDebt
                            ? 'bg-orange-100 text-orange-700'
                            : order.status === 'SELESAI' || order.status === 'COMPLETED'
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {isDebt ? 'BELUM LUNAS' : order.status}
                      </span>
                    </div>
                    {isDebt && order.dueDate && (
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-500 font-medium">Jatuh Tempo</span>
                        <span className="font-black text-red-600 text-xs">
                          {new Date(order.dueDate).toLocaleDateString('id-ID', {
                            day: 'numeric',
                            month: 'long',
                            year: 'numeric',
                          })}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Items Table */}
              <div className="mb-8">
                <table className="w-full">
                  <thead>
                    <tr className="bg-slate-900 text-white text-left print:bg-slate-900">
                      <th className="py-3.5 px-4 rounded-l-xl text-xs font-black uppercase tracking-widest">No</th>
                      <th className="py-3.5 px-4 text-xs font-black uppercase tracking-widest">Produk</th>
                      <th className="py-3.5 px-4 text-xs font-black uppercase tracking-widest text-center">Qty</th>
                      <th className="py-3.5 px-4 text-xs font-black uppercase tracking-widest text-right">Harga</th>
                      <th className="py-3.5 px-4 rounded-r-xl text-xs font-black uppercase tracking-widest text-right">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {order.items?.map((item, idx) => (
                      <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'}>
                        <td className="py-3.5 px-4 text-sm text-slate-400 font-bold">{idx + 1}</td>
                        <td className="py-3.5 px-4">
                          <p className="text-sm font-bold text-slate-900">{item.name}</p>
                          {item.unit && <p className="text-xs text-slate-400 mt-0.5">per {item.unit}</p>}
                        </td>
                        <td className="py-3.5 px-4 text-sm font-black text-slate-700 text-center">
                          {item.quantity} <span className="text-slate-400 font-normal text-xs">{item.unit || 'pcs'}</span>
                        </td>
                        <td className="py-3.5 px-4 text-sm font-semibold text-slate-600 text-right">
                          Rp{item.price.toLocaleString('id-ID')}
                        </td>
                        <td className="py-3.5 px-4 text-sm font-black text-slate-900 text-right">
                          Rp{(item.quantity * item.price).toLocaleString('id-ID')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Totals */}
              <div className="flex justify-end mb-8">
                <div className="w-72">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500 font-medium">Subtotal</span>
                      <span className="font-bold text-slate-800">Rp{subtotal.toLocaleString('id-ID')}</span>
                    </div>
                    {shippingCost > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-500 font-medium">Ongkos Kirim</span>
                        <span className="font-bold text-slate-800">Rp{shippingCost.toLocaleString('id-ID')}</span>
                      </div>
                    )}
                    {discountTotal > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-500 font-medium">Diskon/Voucher</span>
                        <span className="font-bold text-emerald-600">−Rp{discountTotal.toLocaleString('id-ID')}</span>
                      </div>
                    )}
                    <div className="border-t-2 border-slate-200 mt-3 pt-3">
                      <div className="flex justify-between items-center">
                        <span className="text-base font-black text-slate-900 uppercase tracking-wide">Total</span>
                        <span className="text-xl font-black text-slate-900">
                          Rp{order.total.toLocaleString('id-ID')}
                        </span>
                      </div>
                    </div>
                    {isDebt && (
                      <div className="mt-2 bg-orange-50 border border-orange-200 rounded-xl p-3 text-center">
                        <p className="text-xs font-black text-orange-700 uppercase tracking-wider">⚠ BELUM LUNAS — TEMPO</p>
                        {order.dueDate && (
                          <p className="text-xs text-orange-600 mt-0.5">
                            Harap bayar sebelum{' '}
                            {new Date(order.dueDate).toLocaleDateString('id-ID', {
                              day: 'numeric',
                              month: 'long',
                              year: 'numeric',
                            })}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Notes */}
              {order.notes && (
                <div className="mb-8 bg-amber-50 border border-amber-100 rounded-2xl p-5">
                  <p className="text-xs font-black text-amber-600 uppercase tracking-widest mb-1">Catatan</p>
                  <p className="text-sm text-slate-700">{order.notes}</p>
                </div>
              )}

              {/* Footer */}
              <div className="border-t border-slate-100 pt-6 flex justify-between items-end">
                <div>
                  <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Tanda Tangan Penerima</p>
                  <div className="w-36 border-b-2 border-slate-300 mt-10 mb-1" />
                  <p className="text-xs text-slate-400">(________________________)</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-slate-400 mb-1 max-w-xs leading-relaxed">
                    {storeSettings.footerMsg || 'Barang yang sudah dibeli tidak dapat ditukar/dikembalikan'}
                  </p>
                  <p className="text-xs font-black text-slate-600 uppercase tracking-wider mt-3">
                    {storeSettings.name}
                  </p>
                  <p className="text-xs text-slate-400">{storeSettings.phone}</p>
                </div>
              </div>
            </div>

            {/* Bottom accent bar */}
            <div className="h-2 bg-slate-900 print:block" />
          </div>
        </div>
      )}

      {/* ===== THERMAL RECEIPT ===== */}
      {printMode === 'thermal' && (
        <div className="flex justify-center py-8 print:py-0">
          <div
            id="thermal-receipt-container"
            className={`thermal-receipt bg-white border border-dashed border-slate-300 print:border-none shadow-md print:shadow-none mx-auto ${
              paperWidth === '58mm' ? 'w-[58mm] max-w-[58mm]' : 'w-[80mm] max-w-[80mm]'
            }`}
            style={{
              fontFamily: "'Courier New', Courier, monospace",
              padding: paperWidth === '58mm' ? '5px 4px' : '8px 8px',
              fontSize: paperWidth === '58mm' ? '11px' : '12px',
              lineHeight: '1.25',
              color: '#000000',
            }}
          >
            <div className="text-center pb-1">
              <div className="font-black text-sm uppercase tracking-tight">{storeSettings.name}</div>
              <div className="text-[10px] text-neutral-700">{storeSettings.address}</div>
              <div className="text-[10px] text-neutral-700">Telp: {storeSettings.phone}</div>
              {order.channel && (
                <div className="text-[9.5px] font-bold uppercase mt-0.5 border border-black inline-block px-1.5 py-0.2 rounded-xs">
                  ORDER {order.channel}
                </div>
              )}
              <div className="border-b border-black border-dashed my-1.5" />
            </div>

            <div className="space-y-0.5 text-[10.5px]">
              <div className="flex justify-between">
                <span>Tgl:</span>
                <span>{shortDate}</span>
              </div>
              <div className="flex justify-between">
                <span>No:</span>
                <span className="font-bold break-all text-right">{orderNum}</span>
              </div>
              <div className="flex justify-between">
                <span>Plg:</span>
                <span className="font-bold uppercase truncate max-w-[140px] text-right">
                  {order.customerName || 'Umum'}
                </span>
              </div>
              {order.customerPhone && (
                <div className="flex justify-between">
                  <span>Hp:</span>
                  <span>{order.customerPhone}</span>
                </div>
              )}
            </div>

            <div className="border-b border-black border-dashed my-1.5" />

            <div className="space-y-1.5">
              {order.items?.map((item, idx) => (
                <div key={idx} className="leading-tight">
                  <div className="font-bold uppercase text-[11px] break-words">{item.name}</div>
                  <div className="flex justify-between text-[10.5px]">
                    <span>
                      {item.quantity} {item.unit || 'pcs'} x {item.price.toLocaleString('id-ID')}
                    </span>
                    <span className="font-semibold">{(item.quantity * item.price).toLocaleString('id-ID')}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="border-b border-black border-dashed my-1.5" />

            <div className="space-y-0.5 text-[10.5px]">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span>Rp{subtotal.toLocaleString('id-ID')}</span>
              </div>
              {shippingCost > 0 && (
                <div className="flex justify-between">
                  <span>Ongkir</span>
                  <span>Rp{shippingCost.toLocaleString('id-ID')}</span>
                </div>
              )}
              {discountTotal > 0 && (
                <div className="flex justify-between text-neutral-700">
                  <span>Diskon/Voucher</span>
                  <span>-Rp{discountTotal.toLocaleString('id-ID')}</span>
                </div>
              )}
              <div className="flex justify-between font-black text-xs pt-1 border-t border-black border-dotted mt-1">
                <span>TOTAL</span>
                <span>Rp{order.total.toLocaleString('id-ID')}</span>
              </div>
            </div>

            <div className="border-b border-black border-dashed my-1.5" />

            <div className="space-y-0.5 text-[10px]">
              <div className="flex justify-between">
                <span>Metode Bayar:</span>
                <span className="font-bold uppercase">{order.paymentMethod || 'TUNAI'}</span>
              </div>
              {order.deliveryMethod && (
                <div className="flex justify-between">
                  <span>Kurir:</span>
                  <span className="font-bold uppercase">{order.deliveryMethod.replace('_', ' ')}</span>
                </div>
              )}
              {isDebt && (
                <div className="mt-1 border border-black p-1 text-center font-black uppercase text-[10px]">
                  BELUM LUNAS (TEMPO)
                  {order.dueDate && (
                    <div className="text-[9px] font-normal">
                      Jatuh Tempo: {new Date(order.dueDate).toLocaleDateString('id-ID')}
                    </div>
                  )}
                </div>
              )}
            </div>

            {order.deliveryAddress && (
              <div className="mt-1.5 pt-1 border-t border-black border-dotted text-[9.5px]">
                <span className="font-bold">Alamat Kirim:</span>
                <p className="leading-tight uppercase break-words">{order.deliveryAddress}</p>
              </div>
            )}

            <div className="text-center mt-3 pt-1 border-t border-black border-dashed space-y-0.5">
              <div className="font-black uppercase text-[11px] tracking-tight">Terima Kasih</div>
              <div className="text-[9px] text-neutral-600 leading-tight">
                {storeSettings.footerMsg || 'Barang yang sudah dibeli tidak dapat ditukar/dikembalikan'}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===== PRINT STYLES ===== */}
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');

        @media print {
          .no-print {
            display: none !important;
          }
          html,
          body {
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            color: #000000 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }

        /* A4 Print Styles */
        ${printMode === 'a4'
          ? `
          @media print {
            @page { size: A4 portrait; margin: 10mm 12mm; }
            #invoice-a4 { box-shadow: none !important; }
          }
        `
          : `
          @media print {
            @page {
              size: ${paperWidth} auto;
              margin: 0mm !important;
            }
            html, body {
              width: ${paperWidth} !important;
              max-width: ${paperWidth} !important;
              overflow: visible !important;
            }
            .thermal-receipt {
              border: none !important;
              box-shadow: none !important;
              width: ${paperWidth} !important;
              max-width: ${paperWidth} !important;
              margin: 0 !important;
              padding: ${paperWidth === '58mm' ? '2mm 1mm' : '3mm 2mm'} !important;
            }
          }
        `}
      `}</style>
    </div>
  );
}

export default function PrintOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <PrintOrderPageInner id={resolvedParams.id} />
    </Suspense>
  );
}
