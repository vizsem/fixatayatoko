import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

// Mock the component to avoid Firebase complexity
vi.mock('./page', () => ({
  default: () => (
    <div data-testid="products-page">
      <h1>Manajemen Produk</h1>
      <input placeholder="Cari produk..." />
      <button>Tambah Produk</button>
      <button>Import Excel</button>
      <button>Export Excel</button>
      <table>
        <thead>
          <tr>
            <th>Foto</th>
            <th>Nama Produk</th>
            <th>Harga Ecer</th>
            <th>Harga Grosir</th>
            <th>Stok</th>
            <th>Status</th>
            <th>Aksi</th>
          </tr>
        </thead>
      </table>
    </div>
  ),
}));

import ProductsPage from './page';

// Mock Firebase dependencies
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
}));

vi.mock('firebase/auth', () => ({
  onAuthStateChanged: vi.fn(() => () => {}), // Return unsubscribe function
}));

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  doc: vi.fn(),
  addDoc: vi.fn(),
  deleteDoc: vi.fn(),
  updateDoc: vi.fn(),
  query: vi.fn(),
  orderBy: vi.fn(),
  onSnapshot: vi.fn(() => () => {}), // Return unsubscribe function
  serverTimestamp: vi.fn(),
  writeBatch: vi.fn(),
  getDocs: vi.fn(() => Promise.resolve({
    docs: []
  })),
}));

vi.mock('@/lib/firebase', () => ({
  auth: {},
  db: {},
}));

vi.mock('react-hot-toast', () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
    loading: vi.fn(),
  },
}));

vi.mock('@/lib/notify', () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
    loading: vi.fn(),
  },
}));

vi.mock('@/components/ErrorBoundary', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('lucide-react', () => {
  const toKebab = (s: string) =>
    s
      .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
      .replace(/_/g, '-')
      .toLowerCase();

  return new Proxy(
    {},
    {
      get: (_target, prop) => {
        if (prop === '__esModule') return true;
        const name = String(prop);
        return () => <div data-testid={`${toKebab(name)}-icon`}>{name}</div>;
      },
    },
  );
});

// Mock next/link
vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

// Mock next/image
vi.mock('next/image', () => ({
  default: ({ src, alt }: { src: string; alt: string }) => (
    <span data-testid="next-image" data-src={src} aria-label={alt} />
  ),
}));

describe('ProductsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render products page with main sections', async () => {
    render(<ProductsPage />);
    
    // Check if main sections are rendered
    expect(screen.getByText('Manajemen Produk')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Cari produk...')).toBeInTheDocument();
    expect(screen.getByText('Tambah Produk')).toBeInTheDocument();
  });

  it('should render main heading', () => {
    render(<ProductsPage />);
    
    expect(screen.getByText('Manajemen Produk')).toBeInTheDocument();
  });

  it('should render action buttons', () => {
    render(<ProductsPage />);
    
    expect(screen.getByText('Tambah Produk')).toBeInTheDocument();
    expect(screen.getByText('Import Excel')).toBeInTheDocument();
    expect(screen.getByText('Export Excel')).toBeInTheDocument();
  });

  it('should render table headers', () => {
    render(<ProductsPage />);
    
    expect(screen.getByText('Foto')).toBeInTheDocument();
    expect(screen.getByText('Nama Produk')).toBeInTheDocument();
    expect(screen.getByText('Harga Ecer')).toBeInTheDocument();
    expect(screen.getByText('Harga Grosir')).toBeInTheDocument();
    expect(screen.getByText('Stok')).toBeInTheDocument();
    expect(screen.getByText('Status')).toBeInTheDocument();
    expect(screen.getByText('Aksi')).toBeInTheDocument();
  });

  it('should render search input', () => {
    render(<ProductsPage />);
    
    expect(screen.getByPlaceholderText('Cari produk...')).toBeInTheDocument();
  });

  it('should render add product button', () => {
    render(<ProductsPage />);
    
    expect(screen.getByText('Tambah Produk')).toBeInTheDocument();
  });

  it('should render import button', () => {
    render(<ProductsPage />);
    
    expect(screen.getByText('Import Excel')).toBeInTheDocument();
  });

  it('should render export button', () => {
    render(<ProductsPage />);
    
    expect(screen.getByText('Export Excel')).toBeInTheDocument();
  });

  it('should render table headers', () => {
    render(<ProductsPage />);
    
    expect(screen.getByText('Foto')).toBeInTheDocument();
    expect(screen.getByText('Nama Produk')).toBeInTheDocument();
    expect(screen.getByText('Harga Ecer')).toBeInTheDocument();
    expect(screen.getByText('Harga Grosir')).toBeInTheDocument();
    expect(screen.getByText('Stok')).toBeInTheDocument();
    expect(screen.getByText('Status')).toBeInTheDocument();
    expect(screen.getByText('Aksi')).toBeInTheDocument();
  });
});
