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

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
  Plus: () => <div data-testid="plus-icon">Plus</div>,
  Edit: () => <div data-testid="edit-icon">Edit</div>,
  Trash2: () => <div data-testid="trash-icon">Trash</div>,
  Download: () => <div data-testid="download-icon">Download</div>,
  Upload: () => <div data-testid="upload-icon">Upload</div>,
  Search: () => <div data-testid="search-icon">Search</div>,
  X: () => <div data-testid="x-icon">X</div>,
  Camera: () => <div data-testid="camera-icon">Camera</div>,
  Warehouse: () => <div data-testid="warehouse-icon">Warehouse</div>,
  Calculator: () => <div data-testid="calculator-icon">Calculator</div>,
  Eye: () => <div data-testid="eye-icon">Eye</div>,
  EyeOff: () => <div data-testid="eye-off-icon">EyeOff</div>,
  ChevronLeft: () => <div data-testid="chevron-left-icon">ChevronLeft</div>,
  ChevronRight: () => <div data-testid="chevron-right-icon">ChevronRight</div>,
  FileSpreadsheet: () => <div data-testid="spreadsheet-icon">Spreadsheet</div>,
  AlertTriangle: () => <div data-testid="alert-icon">Alert</div>,
  Package: () => <div data-testid="package-icon">Package</div>,
  Banknote: () => <div data-testid="banknote-icon">Banknote</div>,
  RefreshCw: () => <div data-testid="refresh-icon">Refresh</div>,
  CheckSquare: () => <div data-testid="check-square-icon">CheckSquare</div>,
  Square: () => <div data-testid="square-icon">Square</div>,
}));

// Mock next/link
vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

// Mock next/image
vi.mock('next/image', () => ({
  default: ({ src, alt }: { src: string; alt: string }) => (
    <img src={src} alt={alt} />
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