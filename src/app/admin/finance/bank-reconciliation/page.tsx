'use client';

import { Suspense } from 'react';
import BankReconciliationWizard from './BankReconciliationWizard';

export default function BankReconciliationPage() {
  return (
    <div className="p-6 md:p-8 min-h-screen bg-gray-50 text-slate-800">
      <div className="max-w-5xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Rekonsiliasi Bank</h1>
          <p className="text-slate-500 mt-2">
            Import mutasi bank dan cocokkan dengan pencairan marketplace (Payout).
          </p>
        </div>

        <div className="bg-white rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden">
          <Suspense fallback={<div className="p-8 text-center">Memuat Wizard...</div>}>
            <BankReconciliationWizard />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
