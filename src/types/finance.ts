
export interface CapitalTransaction {
  id: string;
  date: string | Date;
  type: 'INJECTION' | 'WITHDRAWAL'; // Tambah Modal / Tarik Modal
  amount: number;
  description: string;
  recordedBy: string; // Admin ID
}

export interface LoanRecord {
  id: string;
  lenderName: string; // Nama Bank / Perorangan
  amount: number; // Total Pinjaman Awal
  remainingAmount: number; // Sisa Hutang
  interestRate?: number; // Bunga (%)
  interestPeriod?: 'MONTHLY' | 'YEARLY'; // Periode Bunga
  loanType?: 'STANDARD' | 'REKENING_KORAN'; // Tipe Pinjaman
  startDate: string | Date;
  dueDate?: string | Date;
  status: 'ACTIVE' | 'PAID';
  description?: string;
}

export interface AssetSummary {
  totalStockValue: number; // Nilai Aset Stok (Modal)
  totalReceivables: number; // Piutang (Uang di luar)
  estimatedCash: number; // Kas (Estimasi)
  totalCapitalInjected: number; // Total Modal Disetor
  totalLiabilities: number; // Total Hutang (Liabilitas)
}
