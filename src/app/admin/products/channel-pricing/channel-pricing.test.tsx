import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import ChannelPricingPage from './page';

const mockUpdateDoc = vi.fn();
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

const normalizedProducts = [
  {
    id: 'p1',
    name: 'Produk Satu',
    Nama: 'Produk Satu',
    price: 10000,
    Ecer: 10000,
    channelPricing: { offline: { price: 9000 } },
    stock: 0,
    sku: '',
    category: '',
  },
];

vi.mock('next/link', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/lib/hooks/useProducts', () => ({
  __esModule: true,
  default: () => ({
    products: normalizedProducts,
    loading: false,
  }),
}));

vi.mock('@/lib/firebase', () => ({
  db: {},
  collection: vi.fn(),
  orderBy: vi.fn(),
  query: vi.fn(),
  onSnapshot: vi.fn((_q: unknown, cb: (snap: { docs: typeof products }) => void) => {
    cb({ docs: products });
    return () => {};
  }),
  getDocs: vi.fn(() => Promise.resolve({ docs: products })),
  doc: vi.fn((_db: unknown, _col: string, id: string) => ({ id })),
  updateDoc: (...args: unknown[]) => mockUpdateDoc(...args),
  limit: vi.fn(),
  ref: vi.fn(),
  writeBatch: vi.fn(),
}));

vi.mock('@/lib/supabase', () => ({
  supabase: { storage: {}, auth: {} },
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
      expect(screen.getAllByText('Produk Satu').length).toBeGreaterThan(0);
    });
  });

  it('harus mengubah dan menyimpan harga channel Shopee', async () => {
    const { default: notify } = await import('@/lib/notify');

    render(<ChannelPricingPage />);

    await waitFor(() => {
      expect(screen.getAllByText('Produk Satu').length).toBeGreaterThan(0);
    });

    const inputs = screen.getAllByRole('spinbutton');
    const shopeeInput = inputs[2];

    fireEvent.change(shopeeInput, { target: { value: '12000' } });

    const saveButton = screen.getByText('Simpan');
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect((notify as typeof import('@/lib/notify').default).admin.success).toHaveBeenCalled();
    });
  });
});
