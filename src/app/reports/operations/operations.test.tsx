import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import OperationsReport from './page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

vi.mock('firebase/auth', () => ({
  onAuthStateChanged: (_auth: unknown, callback: (user: { uid: string } | null) => void) => {
    callback({ uid: 'admin-user' });
    return () => {};
  },
}));

vi.mock('firebase/firestore', () => {
  const fakeDocData = {
    role: 'admin',
  };

  return {
    collection: vi.fn(),
    doc: vi.fn(),
    getDoc: vi.fn(() =>
      Promise.resolve({
        exists: () => true,
        data: () => fakeDocData,
      }),
    ),
    getDocs: vi.fn((colRef: { _path?: { segments?: string[] } } | string) => {
      const colName =
        typeof colRef === 'string'
          ? colRef
          : colRef?._path?.segments?.[colRef._path.segments.length - 1] ?? '';

      switch (colName) {
        case 'users':
          return Promise.resolve({
            size: 2,
            docs: [
              {
                data: () => ({
                  lastActive: new Date().toISOString(),
                }),
              },
              {
                data: () => ({
                  lastActive: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
                }),
              },
            ],
          });
        case 'warehouses':
          return Promise.resolve({
            docs: [
              { data: () => ({ usedCapacity: 90, capacity: 100 }) },
              { data: () => ({ usedCapacity: 10, capacity: 100 }) },
            ],
          });
        case 'products':
          return Promise.resolve({
            docs: [
              { data: () => ({ stock: 0 }) },
              { data: () => ({ stock: 5 }) },
              { data: () => ({ stock: 20 }) },
            ],
          });
        case 'orders':
          return Promise.resolve({
            docs: [
              {
                data: () => ({
                  status: 'MENUNGGU',
                  createdAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
                  updatedAt: new Date().toISOString(),
                }),
              },
              {
                data: () => ({
                  status: 'SELESAI',
                  createdAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
                  updatedAt: new Date().toISOString(),
                }),
              },
            ],
          });
        case 'inventory_transactions':
          return Promise.resolve({
            docs: [
              { data: () => ({ type: 'STOCK_IN' }) },
              { data: () => ({ type: 'STOCK_OUT' }) },
              { data: () => ({ type: 'TRANSFER' }) },
            ],
          });
        default:
          return Promise.resolve({ size: 0, docs: [] });
      }
    }),
  };
});

vi.mock('@/lib/firebase', () => ({
  auth: {},
  db: {},
}));

vi.mock('react-hot-toast', () => ({
  default: {
    error: vi.fn(),
  },
}));

vi.mock('lucide-react', () => ({
  Download: () => <div data-testid="download-icon">Download</div>,
  Users: () => <div data-testid="users-icon">Users</div>,
  Warehouse: () => <div data-testid="warehouse-icon">Warehouse</div>,
  Package: () => <div data-testid="package-icon">Package</div>,
  Activity: () => <div data-testid="activity-icon">Activity</div>,
  Clock: () => <div data-testid="clock-icon">Clock</div>,
  AlertTriangle: () => <div data-testid="alert-icon">Alert</div>,
  ShoppingCart: () => <div data-testid="shopping-cart-icon">ShoppingCart</div>,
  Database: () => <div data-testid="database-icon">Database</div>,
}));

vi.mock('xlsx', () => ({
  utils: {
    json_to_sheet: vi.fn(),
    book_new: vi.fn(),
    book_append_sheet: vi.fn(),
  },
  writeFile: vi.fn(),
}));

describe('OperationsReport', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render loading state initially', () => {
    render(<OperationsReport />);
    expect(screen.getByText('Memuat laporan operasional...')).toBeInTheDocument();
  });

  it('should render summary cards with calculated metrics', async () => {
    render(<OperationsReport />);

    await waitFor(() => {
      expect(screen.getByText('Laporan Operasional')).toBeInTheDocument();
    });

    const critical = screen.getAllByText('Masalah Kritis');
    const warning = screen.getAllByText('Peringatan');
    const total = screen.getAllByText('Total Metrik');

    expect(critical.length).toBeGreaterThan(0);
    expect(warning.length).toBeGreaterThan(0);
    expect(total.length).toBeGreaterThan(0);
  });

  it('should render metric categories sections', async () => {
    render(<OperationsReport />);

    await waitFor(() => {
      expect(screen.getByText('Laporan Operasional')).toBeInTheDocument();
    });

    expect(screen.getByText('Pengguna')).toBeInTheDocument();
    expect(screen.getByText('Gudang')).toBeInTheDocument();
    expect(screen.getByText('Produk')).toBeInTheDocument();
    expect(screen.getByText('Pesanan')).toBeInTheDocument();
    expect(screen.getByText('Inventaris')).toBeInTheDocument();
  });
});
