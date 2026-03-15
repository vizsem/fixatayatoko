'use client';

import { useState, useEffect } from 'react';
import { 
  Upload, 
  FileText, 
  CheckCircle2, 
  AlertCircle, 
  ArrowRight, 
  ArrowLeft,
  Search,
  RefreshCw
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { collection, query, where, getDocs, doc, updateDoc, writeBatch, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import notify from '@/lib/notify';

// Types
type BankMutation = {
  id: string; // generated
  date: string; // YYYY-MM-DD
  description: string;
  amount: number;
  type: 'CR' | 'DB';
  matched?: boolean;
  matchId?: string;
};

type Payout = {
  id: string;
  amount: number;
  date: any;
  storeName?: string;
  accountId?: string;
  status?: 'pending' | 'reconciled';
};

export default function BankReconciliationWizard() {
  const [step, setStep] = useState(1);
  const [file, setFile] = useState<File | null>(null);
  const [bankFormat, setBankFormat] = useState<'GENERIC' | 'BCA' | 'MANDIRI' | 'BRI'>('GENERIC');
  const [mutations, setMutations] = useState<BankMutation[]>([]);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);

  // Load Payouts (Marketplace Withdrawals that are not reconciled)
  useEffect(() => {
    const fetchPayouts = async () => {
      try {
        const q = query(
          collection(db, 'marketplace_transactions'),
          where('type', '==', 'WITHDRAWAL')
          // where('status', '!=', 'reconciled') // Requires index, filtering in JS for now
        );
        const snap = await getDocs(q);
        const list: Payout[] = snap.docs.map(d => ({
          id: d.id,
          ...d.data()
        } as Payout));
        
        // Client-side filter for unreconciled
        const pending = list.filter(p => p.status !== 'reconciled');
        setPayouts(pending);
      } catch (err) {
        console.error('Error fetching payouts:', err);
      }
    };
    fetchPayouts();
  }, []);

  // Handle File Upload & Parse
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = e.target.files?.[0];
    if (!uploadedFile) return;
    setFile(uploadedFile);
  };

  const processFile = async () => {
    if (!file) return;
    setLoading(true);
    
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 });
        
        const parsed: BankMutation[] = [];
        
        (jsonData as any[]).forEach((row, idx) => {
           // Skip empty rows
           if (!row || row.length < 3) return;

           let dateStr = '';
           let desc = '';
           let amount = 0;
           let type: 'CR' | 'DB' | null = null;

           // Helper to clean amount strings
           const parseAmount = (val: any) => {
             if (typeof val === 'number') return val;
             if (!val) return 0;
             // Remove currency symbols, thousand separators (comma or dot depending on locale)
             // This is basic, might need to be tweaked based on exact CSV locale
             const cleanStr = String(val).replace(/[^0-9.-]+/g, "");
             return parseFloat(cleanStr);
           };

           if (bankFormat === 'BCA') {
             // Typical BCA format: Tanggal, Keterangan, Cabang, Jumlah, Mutasi (CR/DB), Saldo
             // Assuming header is around row 0 or 1, we skip rows that don't look like data
             dateStr = String(row[0] || '');
             desc = String(row[1] || '');
             amount = parseAmount(row[3]);
             const mutasi = String(row[4] || '').toUpperCase();
             if (mutasi.includes('CR')) type = 'CR';
             else if (mutasi.includes('DB')) type = 'DB';

           } else if (bankFormat === 'MANDIRI') {
             // Typical Mandiri: Date, Keterangan, Ref, Debit, Kredit, Saldo
             dateStr = String(row[0] || '');
             desc = String(row[1] || '');
             const debit = parseAmount(row[3]);
             const kredit = parseAmount(row[4]);
             if (kredit > 0) { amount = kredit; type = 'CR'; }
             else if (debit > 0) { amount = debit; type = 'DB'; }

           } else if (bankFormat === 'BRI') {
             // Typical BRI: Date, Transaksi, Keterangan, Debet, Kredit, Saldo
             dateStr = String(row[0] || '');
             // Combine Transaksi and Keterangan
             desc = String(row[1] || '') + ' - ' + String(row[2] || '');
             const debit = parseAmount(row[3]);
             const kredit = parseAmount(row[4]);
             if (kredit > 0) { amount = kredit; type = 'CR'; }
             else if (debit > 0) { amount = debit; type = 'DB'; }

           } else {
             // GENERIC: Col 0: Date, Col 1: Desc, Col 2: Amount, Col 3: Type (CR/DB)
             dateStr = String(row[0] || '');
             desc = String(row[1] || '');
             amount = parseAmount(row[2]);
             const mutasi = String(row[3] || '').toUpperCase();
             if (mutasi.includes('DB')) type = 'DB';
             else type = 'CR'; // default to CR for generic if not DB
           }

           // Only add if it's a valid mutation row (has valid amount and type)
           // and the date string doesn't look like a header (e.g. "Tanggal", "Date")
           const isHeader = dateStr.toLowerCase().includes('tanggal') || dateStr.toLowerCase().includes('date');
           
           if (!isHeader && amount > 0 && type) {
             parsed.push({
               id: `mutation-${idx}`,
               date: dateStr,
               description: desc,
               amount: Math.abs(amount),
               type: type as 'CR' | 'DB'
             });
           }
        });

        setMutations(parsed);
        setStep(2);
      } catch (err) {
        console.error(err);
        notify.admin.error('Gagal memproses file CSV/Excel');
      } finally {
        setLoading(false);
      }
    };
    reader.readAsBinaryString(file);
  };

  // Step 2: Auto-Match
  const autoMatch = () => {
    // Simple matching logic: Amount matches exactly
    const newMutations = [...mutations];
    const newPayouts = [...payouts];
    
    newMutations.forEach(mut => {
      if (mut.type === 'CR') { // Payout is money IN (Credit in Bank)
        // Find matching payout
        const matchIndex = newPayouts.findIndex(p => 
          Math.abs(p.amount - mut.amount) < 100 // Allow small diff? No, exact match for now
          && !p.status // Ensure not already matched in this session? 
          // Note: p.status is from DB, we need local tracking
        );

        if (matchIndex !== -1) {
          mut.matched = true;
          mut.matchId = newPayouts[matchIndex].id;
          // Remove from pool to prevent double matching
          newPayouts.splice(matchIndex, 1); 
        }
      }
    });
    setMutations(newMutations);
    setStep(3);
  };

  // Step 3: Confirm
  const handleConfirm = async () => {
    setProcessing(true);
    try {
      const batch = writeBatch(db);
      
      // Update matched payouts to 'reconciled'
      const matchedMutations = mutations.filter(m => m.matched && m.matchId);
      
      for (const m of matchedMutations) {
        if (m.matchId) {
          const payoutRef = doc(db, 'marketplace_transactions', m.matchId);
          batch.update(payoutRef, { 
            status: 'reconciled',
            reconciledAt: serverTimestamp(),
            reconciledWith: m.description
          });
        }
      }
      
      await batch.commit();
      notify.admin.success(`Berhasil merekonsiliasi ${matchedMutations.length} transaksi.`);
      setStep(4); // Success/Summary
    } catch (err) {
      console.error(err);
      notify.admin.error('Gagal menyimpan rekonsiliasi.');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="w-full">
      {/* Stepper */}
      <div className="flex items-center justify-between px-8 py-6 border-b border-gray-100 bg-gray-50/50">
        {[1, 2, 3, 4].map((s) => (
          <div key={s} className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm
              ${step >= s ? 'bg-purple-600 text-white' : 'bg-gray-200 text-gray-500'}`}>
              {s}
            </div>
            <span className={`text-sm font-medium ${step >= s ? 'text-purple-900' : 'text-gray-400'}`}>
              {s === 1 ? 'Upload' : s === 2 ? 'Preview' : s === 3 ? 'Match' : 'Selesai'}
            </span>
            {s < 4 && <div className="w-12 h-0.5 bg-gray-200 mx-2" />}
          </div>
        ))}
      </div>

      <div className="p-8">
        {/* STEP 1: UPLOAD */}
        {step === 1 && (
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
              <label className="block text-sm font-bold text-slate-700 mb-2">Format Bank</label>
              <select 
                value={bankFormat}
                onChange={(e) => setBankFormat(e.target.value as any)}
                className="w-full md:w-1/2 p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 outline-none focus:ring-2 focus:ring-purple-200 font-medium"
              >
                <option value="GENERIC">Umum (Generic CSV)</option>
                <option value="BCA">BCA (Mutasi Rekening)</option>
                <option value="MANDIRI">Mandiri (Mutasi Rekening)</option>
                <option value="BRI">BRI (Mutasi Rekening)</option>
              </select>
              <p className="text-xs text-slate-500 mt-2">
                Pilih format bank untuk memastikan kolom Debit/Kredit terbaca dengan benar.
              </p>
            </div>

            <div className="flex flex-col items-center justify-center py-12 border-2 border-dashed border-gray-300 rounded-2xl bg-gray-50 hover:bg-purple-50 hover:border-purple-300 transition-colors cursor-pointer relative">
              <input 
                type="file" 
                accept=".csv, .xlsx, .xls" 
                onChange={handleFileUpload}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <div className="p-4 bg-white rounded-full shadow-sm mb-4">
                <Upload className="text-purple-600" size={32} />
              </div>
              <h3 className="text-lg font-bold text-slate-800">Upload Mutasi Bank (CSV/Excel)</h3>
              <p className="text-slate-500 text-sm mt-1">Klik atau tarik file ke sini</p>
              {file && (
                <div className="mt-4 px-4 py-2 bg-purple-100 text-purple-700 rounded-lg text-sm font-bold flex items-center gap-2">
                  <FileText size={16} />
                  {file.name}
                </div>
              )}
              
              <button 
                onClick={processFile}
                disabled={!file || loading}
                className="mt-8 px-8 py-3 bg-purple-600 text-white font-bold rounded-xl hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 relative z-10"
              >
                {loading ? 'Memproses...' : 'Lanjut ke Preview'}
                <ArrowRight size={18} />
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: PREVIEW */}
        {step === 2 && (
          <div>
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-slate-800">Preview Data ({mutations.length} Baris)</h3>
              <button onClick={autoMatch} className="px-6 py-2 bg-purple-600 text-white font-bold rounded-xl flex items-center gap-2">
                <RefreshCw size={18} /> Auto-Match
              </button>
            </div>
            <div className="overflow-x-auto border rounded-xl">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="p-4 font-bold text-slate-600">Tanggal</th>
                    <th className="p-4 font-bold text-slate-600">Keterangan</th>
                    <th className="p-4 font-bold text-slate-600 text-right">Jumlah</th>
                    <th className="p-4 font-bold text-slate-600 text-center">Tipe</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {mutations.slice(0, 10).map((m) => (
                    <tr key={m.id} className="hover:bg-gray-50">
                      <td className="p-4 text-slate-700">{m.date}</td>
                      <td className="p-4 text-slate-700 max-w-xs truncate">{m.description}</td>
                      <td className="p-4 text-slate-900 font-mono text-right">{m.amount.toLocaleString()}</td>
                      <td className="p-4 text-center">
                        <span className={`px-2 py-1 rounded text-xs font-bold ${m.type === 'CR' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                          {m.type}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {mutations.length > 10 && (
                <div className="p-4 text-center text-slate-500 text-sm bg-gray-50 border-t">
                  ... dan {mutations.length - 10} baris lainnya
                </div>
              )}
            </div>
          </div>
        )}

        {/* STEP 3: MATCHING */}
        {step === 3 && (
          <div>
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-slate-800">Hasil Pencocokan</h3>
              <button 
                onClick={handleConfirm}
                disabled={processing}
                className="px-6 py-2 bg-emerald-600 text-white font-bold rounded-xl flex items-center gap-2 hover:bg-emerald-700"
              >
                {processing ? 'Menyimpan...' : 'Konfirmasi Rekonsiliasi'}
                <CheckCircle2 size={18} />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* MATCHED */}
              <div className="space-y-4">
                <h4 className="font-bold text-emerald-700 flex items-center gap-2">
                  <CheckCircle2 size={18} /> Cocok ({mutations.filter(m => m.matched).length})
                </h4>
                <div className="space-y-3">
                  {mutations.filter(m => m.matched).map(m => (
                    <div key={m.id} className="p-4 bg-emerald-50 border border-emerald-100 rounded-xl">
                      <div className="flex justify-between font-bold text-emerald-900">
                        <span>{m.date}</span>
                        <span>{m.amount.toLocaleString()}</span>
                      </div>
                      <div className="text-xs text-emerald-600 mt-1 truncate">{m.description}</div>
                      <div className="mt-2 pt-2 border-t border-emerald-100 text-xs text-emerald-800 flex justify-between">
                        <span>Matched with Payout ID:</span>
                        <span className="font-mono">{m.matchId?.slice(0, 8)}...</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* UNMATCHED */}
              <div className="space-y-4">
                <h4 className="font-bold text-amber-700 flex items-center gap-2">
                  <AlertCircle size={18} /> Tidak Cocok ({mutations.filter(m => !m.matched && m.type === 'CR').length})
                </h4>
                <div className="space-y-3">
                  {mutations.filter(m => !m.matched && m.type === 'CR').map(m => (
                    <div key={m.id} className="p-4 bg-amber-50 border border-amber-100 rounded-xl opacity-75">
                      <div className="flex justify-between font-bold text-amber-900">
                        <span>{m.date}</span>
                        <span>{m.amount.toLocaleString()}</span>
                      </div>
                      <div className="text-xs text-amber-600 mt-1 truncate">{m.description}</div>
                      <div className="mt-2 text-xs text-amber-500 italic">
                        Belum ada Payout yang sesuai (Pending)
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STEP 4: SUCCESS */}
        {step === 4 && (
          <div className="text-center py-16">
            <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 size={40} />
            </div>
            <h2 className="text-2xl font-black text-slate-800">Rekonsiliasi Selesai!</h2>
            <p className="text-slate-500 mt-2 max-w-md mx-auto">
              Data transaksi telah diperbarui. Payout yang cocok kini berstatus "Reconciled".
            </p>
            <button 
              onClick={() => window.location.reload()}
              className="mt-8 px-8 py-3 bg-gray-100 text-slate-600 font-bold rounded-xl hover:bg-gray-200"
            >
              Kembali ke Awal
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
