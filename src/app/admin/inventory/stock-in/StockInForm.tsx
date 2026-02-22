// src/app/admin/inventory/stock-in/StockInForm.tsx
'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import StockInFormInner from './StockInFormInner';

function StockInFormContent() {
  const searchParams = useSearchParams();
  const productId = searchParams.get('productId');
  
  return <StockInFormInner productId={productId || ''} />;
}

export default function StockInForm() {
  return (
    <Suspense fallback={<div>Loading form...</div>}>
      <StockInFormContent />
    </Suspense>
  );
}