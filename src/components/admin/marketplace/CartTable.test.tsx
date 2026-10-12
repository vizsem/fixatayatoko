import { render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, expect, it, vi } from 'vitest';
import { CartTable } from './CartTable';

describe('CartTable unit display', () => {
  it('shows configured non-carton units and uses their configured conversion', () => {
    render(
      <CartTable
        cart={[
          {
            id: 'product-1',
            name: 'PRODUK TEST',
            price: 8000,
            quantity: 2,
            unit: 'RTG',
            stock: 120,
            units: [
              { code: 'PCS', contains: 1, price: 800 },
              { code: 'RTG', contains: 10, price: 8000 },
              { code: 'CTN', contains: 120, price: 96000 },
            ],
          },
        ]}
        onUpdateQty={vi.fn()}
        onSetQty={vi.fn()}
        onUpdatePrice={vi.fn()}
        onUpdateUnit={vi.fn()}
        onRemove={vi.fn()}
      />,
    );

    const unitSelector = screen.getByRole('combobox');
    expect(within(unitSelector).getAllByRole('option').map((option) => option.textContent)).toEqual([
      'PCS',
      'RTG',
      'CTN',
    ]);
    expect(screen.getByText('1 RTG = 10 PCS')).toBeInTheDocument();
    expect(screen.getByText((_, element) => element?.textContent === 'Stok: 12 RTG (120 PCS)')).toBeInTheDocument();
    expect(screen.getByText('20')).toBeInTheDocument();
  });
});
