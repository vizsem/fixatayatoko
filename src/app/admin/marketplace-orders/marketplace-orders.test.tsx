import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import MarketplaceOrdersPage from './page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

vi.mock('next/link', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('lucide-react', () => ({
  ChevronLeft: () => <div />,
  ShoppingBag: () => <div />,
  Search: () => <div />,
  Plus: () => <div />,
  Trash2: () => <div />,
  Save: () => <div />,
  Store: () => <div />,
  CreditCard: () => <div />,
}));

const mockGetDoc = vi.fn();
const mockGetDocs = vi.fn();
const mockUpdateDoc = vi.fn();
const mockAddDoc = vi.fn();

vi.mock('firebase/firestore', () => ({
  collection: vi.fn((_db: unknown, _path: string) => ({ path: _path })),
  doc: vi.fn((_dbOrCol: unknown, _col: string, id: string) => ({ id })),
  query: vi.fn(() => ({})),
  orderBy: vi.fn(),
  getDoc: (...args: unknown[]) => mockGetDoc(...args),
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
  serverTimestamp: vi.fn(),
  updateDoc: (...args: unknown[]) => mockUpdateDoc(...args),
  addDoc: (...args: unknown[]) => mockAddDoc(...args),
}));

vi.mock('@/lib/firebase', () => ({
  auth: {},
  db: {},
}));

vi.mock('firebase/auth', () => ({
  onAuthStateChanged: (_auth: unknown, callback: (user: { uid: string } | null) => void) => {
    callback({ uid: 'admin-user' });
    return () => {};
  },
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

describe('MarketplaceOrdersPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockGetDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({ role: 'admin' }),
    });

    mockGetDocs.mockResolvedValue({
      docs: [
        {
          id: 'p1',
          data: () => ({
            Nama: 'Produk Marketplace',
            Ecer: 10000,
            stock: 10,
            channelPricing: {
              shopee: { price: 12000 },
            },
          }),
        },
      ],
    });

    mockUpdateDoc.mockResolvedValue(undefined);
  });

  it('harus menampilkan halaman order marketplace setelah admin terotorisasi', async () => {
    render(<MarketplaceOrdersPage />);

    await waitFor(() => {
      expect(screen.getByText('Order Marketplace')).toBeInTheDocument();
      expect(
        screen.getByText('Input penjualan dari Shopee dan TikTok Shop'),
      ).toBeInTheDocument();
    });
  });

  it('harus menambah produk ke cart dan submit order', async () => {
    mockAddDoc.mockResolvedValue({ id: 'order-1' });

    render(<MarketplaceOrdersPage />);

    await waitFor(() => {
      expect(screen.getByText('Order Marketplace')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(
      'Cari produk untuk ditambahkan ke order marketplace...',
    );
    fireEvent.change(searchInput, { target: { value: 'Produk' } });

    await waitFor(() => {
      expect(screen.getByText('Produk Marketplace')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Produk Marketplace'));

    await waitFor(() => {
      expect(screen.getByDisplayValue('12000')).toBeInTheDocument();
    });

    const submitButton = screen.getByText('Simpan Order');
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockAddDoc).toHaveBeenCalled();
      expect(mockUpdateDoc).toHaveBeenCalled();
    });
  });
});
