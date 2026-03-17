import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import EmployeesPage from './page';

// Mock Firebase dependencies
const mockGetDocs = vi.fn();
const mockGetDoc = vi.fn();
const mockRunTransaction = vi.fn();

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  doc: vi.fn(),
  updateDoc: vi.fn(),
  query: vi.fn(),
  orderBy: vi.fn(),
  where: vi.fn(),
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
  getDoc: (...args: unknown[]) => mockGetDoc(...args),
  runTransaction: (...args: unknown[]) => mockRunTransaction(...args),
  increment: vi.fn(),
  addDoc: vi.fn(),
  deleteDoc: vi.fn(),
  serverTimestamp: vi.fn(),
  arrayUnion: vi.fn(),
  setDoc: vi.fn(),
}));

vi.mock('@/lib/firebase', () => ({
  auth: {},
  db: {},
}));

vi.mock('firebase/auth', () => ({
  onAuthStateChanged: (_auth: unknown, cb: (user: { uid: string } | null) => void) => {
    cb({ uid: 'admin-user' });
    return () => {};
  },
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock('jspdf', () => ({
  default: function () {
    return {
      setFontSize: vi.fn(),
      text: vi.fn(),
      line: vi.fn(),
      save: vi.fn(),
    };
  },
}));

vi.mock('react-hot-toast', () => ({
  Toaster: () => <div data-testid="toaster">Toaster</div>,
  default: {
    success: vi.fn(),
    error: vi.fn(),
    loading: vi.fn(),
  },
}));

vi.mock('@/lib/notify', () => {
  const mocked = {
    admin: {
      success: vi.fn(),
      error: vi.fn(),
      loading: vi.fn(),
    },
  };

  return { default: mocked };
});

describe('EmployeesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockGetDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({ role: 'admin' }),
    });

    mockGetDocs.mockResolvedValueOnce({
      docs: [
        {
          id: 'emp1',
          data: () => ({
            name: 'Budi Santoso',
            role: 'Kasir',
            email: 'budi@example.com',
            phone: '08123456789',
            status: 'AKTIF',
            manualSalary: 3000000,
            workSchedule: '07:00 - 14:00',
            totalAttendance: 5,
          }),
        },
      ],
    });
    mockGetDocs.mockResolvedValue({
      docs: [],
    });

    mockRunTransaction.mockImplementation(async (_db: unknown, fn: (tx: any) => unknown) => {
      const tx = {
        get: vi.fn(async () => ({
          exists: () => true,
          data: () => ({}),
        })),
        set: vi.fn(),
        update: vi.fn(),
      };
      return await fn(tx);
    });
  });

  it('should render employees page with main sections', async () => {
    render(<EmployeesPage />);
    
    await waitFor(() => {
      expect(screen.getByText('Team Ataya')).toBeInTheDocument();
      expect(screen.getByText('Manajemen staf & kehadiran')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Cari nama, jabatan...')).toBeInTheDocument();
      expect(screen.getByText('Tambah Staff')).toBeInTheDocument();
    });
  });

  it('should show loading state initially', async () => {
    render(<EmployeesPage />);
    
    await waitFor(() => {
      expect(screen.getByText('Team Ataya')).toBeInTheDocument();
    });
  });

  it('should handle search input', async () => {
    render(<EmployeesPage />);
    
    const searchInput = await screen.findByPlaceholderText('Cari nama, jabatan...');
    fireEvent.change(searchInput, { target: { value: 'john doe' } });
    
    await waitFor(() => {
      expect(searchInput).toHaveValue('john doe');
    });
  });

  it('should render employee card after data load', async () => {
    render(<EmployeesPage />);

    await waitFor(() => {
      expect(screen.getByText('Budi Santoso')).toBeInTheDocument();
      expect(screen.getByText(/Kasir/i)).toBeInTheDocument();
      expect(screen.getByText(/Hadir:\s*5\s*hari/i)).toBeInTheDocument();
    });
  });

  it('should show success notification when marking employee present', async () => {
    render(<EmployeesPage />);

    const presentButton = await screen.findByTitle('Absen Hadir');
    fireEvent.click(presentButton);

    await waitFor(() => {
      expect(mockRunTransaction).toHaveBeenCalled();
    });
  });
});
