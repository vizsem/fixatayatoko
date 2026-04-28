import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import StockReconciliationPage from './page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

vi.mock('next/link', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

// Mock useProducts hook
vi.mock('@/lib/hooks/useProducts', () => ({
  __esModule: true,
  default: () => ({
    products: [
      {
        id: 'p1',
        name: 'Produk Test',
        stock: 10,
        unit: 'pcs',
        category: 'Test Category',
        price: 10000,
      },
    ],
    loading: false,
  }),
}));

vi.mock('firebase/firestore', async () => {
  const actual = await vi.importActual('firebase/firestore');
  return {
    ...actual,
    collection: vi.fn((_db: unknown, _path: string) => ({ path: _path })),
    doc: vi.fn((_dbOrCol: unknown, ...args: string[]) => {
      const id = args.length === 2 ? args[1] : args[0];
      return { id, path: id };
    }),
    query: vi.fn(() => ({})),
    orderBy: vi.fn(),
    where: vi.fn(),
    getDoc: vi.fn(async () => ({
      exists: () => true,
      data: () => ({ role: 'admin' }),
    })),
    getDocs: vi.fn(async () => ({
      docs: [],
    })),
    serverTimestamp: vi.fn(),
    updateDoc: vi.fn(async () => {}),
    addDoc: vi.fn(async () => ({ id: 'order-1' })),
    runTransaction: vi.fn(async (_db: unknown, fn: (tx: any) => unknown) => {
      const tx = {
        get: vi.fn(async () => ({
          exists: () => true,
          data: () => ({ stock: 100, stockByWarehouse: {} }),
        })),
        update: vi.fn(async () => {}),
        set: vi.fn(async () => {}),
      };
      return await fn(tx);
    }),
  };
});

vi.mock('@/lib/firebase', () => ({
  auth: {},
  db: {},
}));

vi.mock('firebase/auth', () => ({
  onAuthStateChanged: (_auth: unknown, callback: (user: { uid: string } | null) => void) => {
    setTimeout(() => callback({ uid: 'admin-user' }), 0);
    return () => {};
  },
}));

describe('StockReconciliationPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('harus menampilkan halaman rekonsiliasi stok setelah admin terotorisasi', async () => {
    render(<StockReconciliationPage />);

    await waitFor(() => {
      expect(screen.getByText('Rekonsiliasi Stok')).toBeInTheDocument();
      expect(
        screen.getByText('Cocokkan stok sistem dengan stok fisik'),
      ).toBeInTheDocument();
    });
  });

  it('harus menampilkan statistik produk', async () => {
    render(<StockReconciliationPage />);

    await waitFor(() => {
      expect(screen.getByText('Total Produk')).toBeInTheDocument();
      expect(screen.getByText('Cocok')).toBeInTheDocument();
      expect(screen.getByText('Surplus')).toBeInTheDocument();
      expect(screen.getByText('Defisit')).toBeInTheDocument();
      expect(screen.getByText('Perlu Aksi')).toBeInTheDocument();
    });
  });
});
