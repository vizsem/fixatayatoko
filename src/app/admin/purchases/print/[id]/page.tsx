'use client';

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Printer, FileText, Receipt, CheckCircle2, Clock } from 'lucide-react';
import { supabase, supabaseAdmin } from '@/lib/supabase';
import { getUserAndRole } from '@/lib/supabase-helpers';
import { getPurchaseOrderById } from '@/lib/actions/purchase.actions';

type POItem = {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  totalPrice: number;
};

type PODetail = {
  id: string;
  poNumber: string;
  status: string;
  warehouseName: string;
  totalAmount: number;
  notes: string | null;
  createdAt: Date | string;
  paymentStatus: string;
  paymentMethod: string;
  dueDate?: string | null;
  supplier: {
    name: string;
    phone?: string;
    address?: string;
    contactPerson?: string;
  };
  items: POItem[];
};

type StoreSettings = {
  name: string;
  address: string;
  phone: string;
  footerMsg?: string;
};

export default function PrintPurchasePage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const resolvedParams = use(params);
  const id = resolvedParams.id;

  const [po, setPo] = useState<PODetail | null>(null);
  const [storeSettings, setStoreSettings] = useState<StoreSettings>({
    name: 'ATAYATOKO',
    address: 'Jl. Pandan 98, Semen, Kediri',
    phone: '0858-5316-1174',
    footerMsg: 'Bukti Pembelian & Penerimaan Barang Resmi'
  });
  const [printMode, setPrintMode] = useState<'A4' | '58mm' | '80mm'>('A4');
  const [loading, setLoading] = useState(true);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/admin/login'); return; }
      const { isStaff } = await getUserAndRole();
      if (!isStaff) {
        router.push('/profil'); return;
      }
      setAuthChecked(true);
    };
    checkAuth();
  }, [router]);

  useEffect(() => {
    if (!authChecked || !id) return;
    const fetchData = async () => {
      try {
        const poData = await getPurchaseOrderById(id);
        if (poData) {
          const raw = poData.raw_data || {};
          let supplierInfo = {
            name: poData.supplier?.name || raw.supplierName || 'Supplier Umum',
            phone: raw.supplierPhone || raw.supplier?.phone,
            address: raw.supplierAddress || raw.supplier?.address,
            contactPerson: raw.supplierContact || raw.supplier?.contactPerson,
          };

          // Jika ada supplierId dan belum lengkap, fetch data supplier
          if (raw.supplierId && (!supplierInfo.phone || !supplierInfo.address)) {
            const { data: sRow } = await supabaseAdmin
              .from('suppliers')
              .select('*')
              .eq('id', raw.supplierId)
              .maybeSingle();
            if (sRow) {
              const sRaw = sRow.raw_data || {};
              supplierInfo = {
                name: sRow.name || sRaw.name || supplierInfo.name,
                phone: sRaw.phone || sRow.phone || supplierInfo.phone,
                address: sRaw.address || sRow.address || supplierInfo.address,
                contactPerson: sRaw.contactPerson || sRow.contact || supplierInfo.contactPerson,
              };
            }
          }

          setPo({
            id: poData.id,
            poNumber: poData.poNumber,
            status: poData.status,
            warehouseName: poData.warehouseName || raw.warehouseName || 'Gudang Utama',
            totalAmount: poData.totalAmount,
            notes: poData.notes || raw.notes || null,
            createdAt: poData.createdAt || raw.createdAt || new Date(),
            paymentStatus: raw.paymentStatus || (poData as any).paymentStatus || 'LUNAS',
            paymentMethod: raw.paymentMethod || (poData as any).paymentMethod || 'CASH',
            dueDate: raw.dueDate || null,
            supplier: supplierInfo,
            items: poData.items.map((i: any) => ({
              id: i.id,
              name: i.product?.name || i.name,
              quantity: i.quantity,
              unit: i.product?.unit || i.unit || 'PCS',
              unitPrice: i.unitPrice,
              totalPrice: i.totalPrice,
            })),
          });

          setTimeout(() => {
            if (typeof window !== 'undefined') {
              window.print();
            }
          }, 600);
        }

        // Ambil info toko
        const { data: settingsRow } = await supabaseAdmin
          .from('settings')
          .select('*')
          .eq('key', 'system')
          .maybeSingle();
        if (settingsRow?.value) {
          const s = settingsRow.value;
          setStoreSettings(prev => ({
            name: (s.name || prev.name).toUpperCase(),
            address: s.address || prev.address,
            phone: s.phone || prev.phone,
            footerMsg: s.footerMsg || prev.footerMsg,
          }));
        }
      } catch (err) {
        console.error('Error fetching purchase for print:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id, authChecked]);

  if (loading || !authChecked) {
    return (
      <div className="p-10 text-center font-bold text-gray-500 animate-pulse tracking-wide">
        Memuat Dokumen Transaksi Pembelian...
      </div>
    );
  }

  if (!po) {
    return (
      <div className="p-10 text-center font-black text-rose-500 uppercase">
        Data Purchase Order Tidak Ditemukan
      </div>
    );
  }

  const dateStr = po.createdAt
    ? new Date(po.createdAt).toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '-';

  const dueDateStr = po.dueDate
    ? new Date(po.dueDate).toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : '-';

  return (
    <div className="min-h-screen bg-neutral-100 print:bg-white text-black py-4 print:py-0 print:p-0 flex flex-col items-center">
      {/* TOOLBAR CONTROLS (LAYAR SAJA - TIDAK TERCETAK) */}
      <div className="w-full max-w-4xl mx-auto px-4 mb-4 no-print">
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.back()}
              className="p-2.5 bg-slate-100 rounded-xl hover:bg-slate-200 transition-all text-slate-700"
              title="Kembali"
            >
              <ArrowLeft size={18} />
            </button>
            <div>
              <h1 className="text-sm font-black uppercase tracking-tight text-slate-900">
                Cetak Transaksi Pembelian (PO)
              </h1>
              <p className="text-[11px] text-slate-500">
                Pilih format cetak: Dokumen Faktur Resmi (A4) atau Struk Thermal
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex bg-slate-100 p-1 rounded-xl text-xs font-bold">
              <button
                type="button"
                onClick={() => setPrintMode('A4')}
                className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all ${
                  printMode === 'A4' ? 'bg-black text-white shadow-sm' : 'text-slate-600 hover:text-black'
                }`}
              >
                <FileText size={14} /> Faktur A4
              </button>
              <button
                type="button"
                onClick={() => setPrintMode('58mm')}
                className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all ${
                  printMode === '58mm' ? 'bg-black text-white shadow-sm' : 'text-slate-600 hover:text-black'
                }`}
              >
                <Receipt size={14} /> 58mm
              </button>
              <button
                type="button"
                onClick={() => setPrintMode('80mm')}
                className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all ${
                  printMode === '80mm' ? 'bg-black text-white shadow-sm' : 'text-slate-600 hover:text-black'
                }`}
              >
                <Receipt size={14} /> 80mm
              </button>
            </div>

            <button
              onClick={() => typeof window !== 'undefined' && window.print()}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition-all shadow-sm"
            >
              <Printer size={15} /> Cetak Sekarang
            </button>
          </div>
        </div>
      </div>

      {/* TAMPILAN FORMAT 1: FAKTUR PO RESMI (A4 STANDAR) */}
      {printMode === 'A4' && (
        <div className="print-sheet-a4 w-full max-w-4xl bg-white p-8 md:p-12 rounded-2xl shadow-md print:shadow-none border border-slate-200 print:border-none print:m-0 print:p-6 text-gray-900">
          {/* Header Faktur */}
          <div className="flex justify-between items-start border-b-2 border-gray-900 pb-5 mb-6">
            <div>
              <h2 className="text-2xl font-black tracking-tight text-gray-900 uppercase">{storeSettings.name}</h2>
              <p className="text-xs text-gray-600 max-w-sm mt-1 leading-relaxed">{storeSettings.address}</p>
              <p className="text-xs text-gray-600 font-medium mt-0.5">Telepon/WhatsApp: {storeSettings.phone}</p>
            </div>
            <div className="text-right">
              <span className="inline-block px-3 py-1 bg-gray-900 text-white text-xs font-black tracking-widest uppercase rounded">
                PURCHASE ORDER (PO)
              </span>
              <p className="font-mono font-bold text-base mt-2 text-gray-900">{po.poNumber}</p>
              <p className="text-xs text-gray-500 mt-0.5">{dateStr}</p>
            </div>
          </div>

          {/* Info Supplier & PO Meta */}
          <div className="grid grid-cols-2 gap-6 p-4 bg-gray-50 rounded-xl border border-gray-200 mb-6 text-xs">
            <div>
              <p className="font-bold text-gray-500 uppercase tracking-wider text-[10px] mb-1">Kepada Supplier:</p>
              <p className="font-black text-sm text-gray-900 uppercase">{po.supplier.name}</p>
              {po.supplier.contactPerson && (
                <p className="text-gray-600 mt-0.5">PIC: <span className="font-semibold">{po.supplier.contactPerson}</span></p>
              )}
              {po.supplier.phone && (
                <p className="text-gray-600">Telp: <span className="font-semibold">{po.supplier.phone}</span></p>
              )}
              {po.supplier.address && (
                <p className="text-gray-600 mt-0.5 leading-tight">{po.supplier.address}</p>
              )}
            </div>
            <div className="space-y-1.5 text-right sm:text-left sm:pl-6 border-l border-gray-200">
              <div className="flex justify-between">
                <span className="text-gray-500 font-bold uppercase text-[10px]">Gudang Tujuan:</span>
                <span className="font-bold text-gray-800 uppercase">{po.warehouseName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500 font-bold uppercase text-[10px]">Status PO:</span>
                <span className="font-black uppercase text-emerald-700">{po.status}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500 font-bold uppercase text-[10px]">Metode Pembayaran:</span>
                <span className="font-bold uppercase text-gray-900">{po.paymentMethod}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500 font-bold uppercase text-[10px]">Status Pembayaran:</span>
                <span className={`font-black uppercase ${po.paymentStatus === 'HUTANG' ? 'text-red-600' : 'text-emerald-600'}`}>
                  {po.paymentStatus}
                </span>
              </div>
              {po.dueDate && po.paymentStatus === 'HUTANG' && (
                <div className="flex justify-between">
                  <span className="text-red-500 font-bold uppercase text-[10px]">Jatuh Tempo:</span>
                  <span className="font-black text-red-600">{dueDateStr}</span>
                </div>
              )}
            </div>
          </div>

          {/* Tabel Barang */}
          <div className="overflow-x-auto mb-6">
            <table className="w-full text-xs border border-gray-300">
              <thead>
                <tr className="bg-gray-100 border-b border-gray-300 text-gray-700 font-bold uppercase tracking-wider text-[11px]">
                  <th className="py-2.5 px-3 text-center w-12 border-r border-gray-300">No</th>
                  <th className="py-2.5 px-3 text-left border-r border-gray-300">Nama Produk / Barang</th>
                  <th className="py-2.5 px-3 text-center w-24 border-r border-gray-300">Jumlah</th>
                  <th className="py-2.5 px-3 text-right w-32 border-r border-gray-300">Harga Satuan</th>
                  <th className="py-2.5 px-3 text-right w-36">Subtotal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {po.items.map((item, idx) => (
                  <tr key={idx} className="hover:bg-gray-50/50">
                    <td className="py-2 px-3 text-center border-r border-gray-200 font-mono text-gray-500">{idx + 1}</td>
                    <td className="py-2 px-3 border-r border-gray-200 font-bold text-gray-900">{item.name}</td>
                    <td className="py-2 px-3 text-center border-r border-gray-200 font-semibold text-gray-800">
                      {item.quantity} {item.unit}
                    </td>
                    <td className="py-2 px-3 text-right border-r border-gray-200 text-gray-700">
                      Rp{item.unitPrice.toLocaleString('id-ID')}
                    </td>
                    <td className="py-2 px-3 text-right font-bold text-gray-900">
                      Rp{item.totalPrice.toLocaleString('id-ID')}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-gray-50 border-t-2 border-gray-900 font-black text-sm">
                  <td colSpan={4} className="py-3 px-4 text-right uppercase tracking-wider text-gray-800 border-r border-gray-200">
                    Total Transaksi Pembelian:
                  </td>
                  <td className="py-3 px-3 text-right text-emerald-800 font-black text-base">
                    Rp{po.totalAmount.toLocaleString('id-ID')}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Catatan PO */}
          {po.notes && (
            <div className="p-3 bg-gray-50 rounded-lg border border-gray-200 mb-8 text-xs">
              <span className="font-bold text-gray-600 uppercase text-[10px] block mb-0.5">Catatan Tambahan:</span>
              <p className="text-gray-800">{po.notes}</p>
            </div>
          )}

          {/* Kolom Tanda Tangan */}
          <div className="grid grid-cols-3 gap-6 pt-6 text-center text-xs border-t border-gray-200 mt-10">
            <div>
              <p className="font-bold text-gray-600 uppercase text-[11px] mb-16">Supplier / Pengirim</p>
              <div className="border-t border-gray-400 mx-6 pt-1">
                <p className="font-bold uppercase text-gray-800">({po.supplier.name})</p>
              </div>
            </div>
            <div>
              <p className="font-bold text-gray-600 uppercase text-[11px] mb-16">Penerima Gudang</p>
              <div className="border-t border-gray-400 mx-6 pt-1">
                <p className="font-bold uppercase text-gray-800">({po.warehouseName})</p>
              </div>
            </div>
            <div>
              <p className="font-bold text-gray-600 uppercase text-[11px] mb-16">Bagian Purchasing / Admin</p>
              <div className="border-t border-gray-400 mx-6 pt-1">
                <p className="font-bold uppercase text-gray-800">( {storeSettings.name} )</p>
              </div>
            </div>
          </div>

          <div className="mt-8 text-center text-[10px] text-gray-400 border-t border-gray-100 pt-3">
            {storeSettings.footerMsg || 'Dicetak otomatis oleh Sistem Operasional AtayaToko'}
          </div>
        </div>
      )}

      {/* TAMPILAN FORMAT 2: STRUK THERMAL (58mm / 80mm) */}
      {(printMode === '58mm' || printMode === '80mm') && (
        <div
          className={`thermal-receipt bg-white text-black mx-auto border border-dashed border-slate-300 print:border-none shadow-md print:shadow-none ${
            printMode === '58mm' ? 'w-[58mm] max-w-[58mm]' : 'w-[80mm] max-w-[80mm]'
          }`}
          style={{
            fontFamily: "'Courier New', Courier, monospace",
            padding: printMode === '58mm' ? '4px 3px' : '6px 6px',
            fontSize: printMode === '58mm' ? '11px' : '12px',
            lineHeight: '1.25'
          }}
        >
          {/* Header Toko */}
          <div className="text-center pb-1">
            <div className="font-black text-sm uppercase tracking-tight">{storeSettings.name}</div>
            <div className="text-[10px] text-neutral-700">{storeSettings.address}</div>
            <div className="text-[10px] text-neutral-700">Telp: {storeSettings.phone}</div>
            <div className="border-b border-black border-dashed my-1.5" />
            <div className="font-bold text-xs uppercase tracking-wider">BUKTI PEMBELIAN (PO)</div>
            <div className="border-b border-black border-dashed my-1.5" />
          </div>

          {/* Info PO */}
          <div className="space-y-0.5 text-[10.5px]">
            <div className="flex justify-between">
              <span>Tgl:</span>
              <span>{dateStr}</span>
            </div>
            <div className="flex justify-between">
              <span>No PO:</span>
              <span className="font-bold">{po.poNumber}</span>
            </div>
            <div className="flex justify-between">
              <span>Supplier:</span>
              <span className="font-bold uppercase truncate max-w-[140px] text-right">
                {po.supplier.name}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Gudang:</span>
              <span className="font-bold uppercase">{po.warehouseName}</span>
            </div>
          </div>

          <div className="border-b border-black border-dashed my-1.5" />

          {/* Daftar Barang */}
          <div className="space-y-1.5">
            {po.items.map((item, idx) => (
              <div key={idx} className="leading-tight">
                <div className="font-bold uppercase text-[11px] break-words">{item.name}</div>
                <div className="flex justify-between text-[10.5px]">
                  <span>
                    {item.quantity} {item.unit} x {item.unitPrice.toLocaleString('id-ID')}
                  </span>
                  <span className="font-semibold">
                    {item.totalPrice.toLocaleString('id-ID')}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div className="border-b border-black border-dashed my-1.5" />

          {/* Total */}
          <div className="space-y-0.5 text-[10.5px]">
            <div className="flex justify-between font-black text-xs pt-1 border-t border-black border-dotted mt-1">
              <span>TOTAL PO</span>
              <span>Rp{po.totalAmount.toLocaleString('id-ID')}</span>
            </div>
          </div>

          <div className="border-b border-black border-dashed my-1.5" />

          {/* Status Bayar & Metode */}
          <div className="space-y-0.5 text-[10px]">
            <div className="flex justify-between">
              <span>Metode Bayar:</span>
              <span className="font-bold uppercase">{po.paymentMethod}</span>
            </div>
            <div className="flex justify-between">
              <span>Status Bayar:</span>
              <span className="font-bold uppercase">{po.paymentStatus}</span>
            </div>
            {po.dueDate && po.paymentStatus === 'HUTANG' && (
              <div className="mt-1 border border-black p-1 text-center font-black uppercase text-[10px]">
                HUTANG / TEMPO
                <div className="text-[9px] font-normal">
                  Jatuh Tempo: {dueDateStr}
                </div>
              </div>
            )}
          </div>

          {po.notes && (
            <div className="mt-1.5 pt-1 border-t border-black border-dotted text-[9.5px]">
              <span className="font-bold">Catatan:</span>
              <p className="leading-tight uppercase break-words">{po.notes}</p>
            </div>
          )}

          {/* Footer Struk */}
          <div className="text-center mt-3 pt-1 border-t border-black border-dashed space-y-0.5">
            <div className="font-black uppercase text-[11px] tracking-tight">Dokumen Pembelian Sah</div>
            <div className="text-[9px] text-neutral-600 leading-tight">
              {storeSettings.footerMsg || 'Barang diterima sesuai rincian di atas'}
            </div>
          </div>
        </div>
      )}

      {/* GLOBAL PRINT STYLES */}
      <style jsx global>{`
        @media print {
          @page {
            size: ${printMode === 'A4' ? 'A4 portrait' : `${printMode} auto`};
            margin: ${printMode === 'A4' ? '10mm' : '0mm'} !important;
          }
          html, body {
            background: #ffffff !important;
            margin: 0 !important;
            padding: 0 !important;
            width: ${printMode === 'A4' ? '100%' : printMode} !important;
          }
          .no-print {
            display: none !important;
          }
          .print-sheet-a4 {
            border: none !important;
            box-shadow: none !important;
            max-width: 100% !important;
            width: 100% !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          .thermal-receipt {
            border: none !important;
            box-shadow: none !important;
            width: ${printMode} !important;
            max-width: ${printMode} !important;
            margin: 0 !important;
            padding: ${printMode === '58mm' ? '2mm 1mm' : '3mm 2mm'} !important;
            page-break-after: avoid !important;
            page-break-inside: avoid !important;
          }
        }
      `}</style>
    </div>
  );
}
