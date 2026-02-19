import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import ChannelPricingPage from './page';

vi.mock('next/link', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('lucide-react', () => ({
  ChevronLeft: () => <div />,
  Search: () => <div />,
  Save: () => <div />,
  Tag: () => <div />,
}));

vi.mock('firebase/firestore', () => {
  const products = [
    {
      id: 'p1',
      data: () => ({
        Nama: 'Produk Satu',
        Ecer: 10000,
        channelPricing: {
          offline: { price: 9000 },
        },
      }),
    },
  ];

  return {
    collection: vi.fn(),
    orderBy: vi.fn(),
    query: vi.fn(),
    getDocs: vi.fn(() =>
      Promise.resolve({
        docs: products,
      }),
    ),
    doc: vi.fn((_db, _col, id: string) => ({ id })),
    updateDoc: vi.fn(),
  };
});

vi.mock('@/lib/firebase', () => ({
  db: {},
}));

vi.mock('react-hot-toast', () => ({
  Toaster: () => <div />,
}));

vi.mock('@/lib/notify', () => ({
  default: {
    admin: {
      loading: vi.fn(() => 'toast-id'),
      success: vi.fn(),
      error: vi.fn(),
    },
  },
}));

describe('ChannelPricingPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('harus menampilkan daftar produk dengan harga dasar', async () => {
    render(<ChannelPricingPage />);

    await waitFor(() => {
      expect(screen.getByText('Harga per Channel')).toBeInTheDocument();
      expect(screen.getByText('Produk Satu')).toBeInTheDocument();
      expect(screen.getByText(/Harga dasar: Rp 10.000/)).toBeInTheDocument();
    });
  });

  it('harus mengubah dan menyimpan harga channel Shopee', async () => {
    const { default: notify } = await import('@/lib/notify');
    const { updateDoc } = await import('firebase/firestore');

    render(<ChannelPricingPage />);

    await waitFor(() => {
      expect(screen.getByText('Produk Satu')).toBeInTheDocument();
    });

    const inputs = screen.getAllByRole('spinbutton');
    const shopeeInput = inputs[2];

    fireEvent.change(shopeeInput, { target: { value: '12000' } });

    const saveButton = screen.getByText('Simpan');
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect((notify as typeof import('@/lib/notify').default).admin.success).toHaveBeenCalled();
      expect(updateDoc).toHaveBeenCalled();
    });
  });
});
