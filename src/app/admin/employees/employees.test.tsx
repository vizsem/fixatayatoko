import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import EmployeesPage from './page';

// Mock Firebase dependencies
const mockGetDocs = vi.fn();
const mockGetDoc = vi.fn();
const mockRunTransaction = vi.fn();
// Halaman ini sekarang mengakses data lewat `@/lib/hr-client`, yang meneruskan
// setiap panggilan ke Server Action. Yang di-mock karena itu adalah modul
// tersebut, bukan `@/lib/firebase` seperti sebelumnya.
vi.mock('@/lib/hr-client', () => {
  const M = Symbol('supabase_increment');
  return ({
  auth: {},
  db: {},
  collection: vi.fn(),
  doc: vi.fn(),
  updateDoc: vi.fn(),
  query: vi.fn(),
  orderBy: vi.fn(),
  where: vi.fn(),
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
  getDoc: (...args: unknown[]) => mockGetDoc(...args),
  runTransaction: (...args: unknown[]) => mockRunTransaction(...args),
  increment: (n: any) => ({ [M]: true, delta: n }),
  INCREMENT_MARKER: M,
  addDoc: vi.fn(),
  deleteDoc: vi.fn(),
  serverTimestamp: vi.fn(),
  arrayUnion: vi.fn(),
  setDoc: vi.fn(),
  onAuthStateChanged: (_auth: unknown, cb: (user: { uid: string } | null) => void) => {
    cb({ uid: 'admin-user' });
    return () => {};
  },
  });
});

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock('@/lib/hooks/useAdminAuth', () => ({
  __esModule: true,
  default: () => ({ adminId: 'admin-user', role: 'admin', authLoading: false }),
}));

vi.mock('@/lib/supabase', () => {
  const createQueryBuilder = () => {
    const builder: any = {};
    builder.select = vi.fn().mockReturnValue(builder);
    builder.eq = vi.fn().mockReturnValue(builder);
    builder.order = vi.fn().mockReturnValue(builder);
    builder.single = vi.fn().mockResolvedValue({ data: null, error: null });
    builder.then = (onfulfilled: any, onrejected?: any) =>
      Promise.resolve({ data: [], error: null }).then(onfulfilled, onrejected);
    return builder;
  };
  return {
    supabase: {
      auth: {
        getUser: vi.fn(async () => ({
          data: { user: { id: 'admin-user', app_metadata: { role: 'admin' } } },
        })),
        onAuthStateChange: vi.fn(() => ({
          data: { subscription: { unsubscribe: vi.fn() } },
        })),
        signInWithPassword: vi.fn(async () => ({ data: { user: null, session: null }, error: null })),
        signOut: vi.fn(async () => ({ error: null })),
      },
      storage: {},
      from: vi.fn(() => createQueryBuilder()),
      rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
    },
    supabaseAdmin: {
      from: vi.fn(() => {
        const builder: any = createQueryBuilder();
        builder.update = vi.fn().mockReturnValue(builder);
        builder.set = vi.fn().mockResolvedValue({ data: null, error: null });
        return builder;
      }),
      rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
    },
  };
});

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

    mockGetDocs.mockResolvedValue({
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
    
    expect(await screen.findByText('Manajemen Karyawan (HR)', {}, { timeout: 15000 })).toBeInTheDocument();
    expect(screen.getByText('Staff, Presensi, Jadwal Shift & Penggajian')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Cari nama, jabatan, status...')).toBeInTheDocument();
    expect(screen.getByText(/Tambah Staf/i)).toBeInTheDocument();
  }, 15000);

  it('should show loading state initially', async () => {
    render(<EmployeesPage />);
    
    await waitFor(() => {
      expect(screen.getByText('Manajemen Karyawan (HR)')).toBeInTheDocument();
    });
  });

  it('should handle search input', async () => {
    render(<EmployeesPage />);
    
    const searchInput = await screen.findByPlaceholderText('Cari nama, jabatan, status...');
    fireEvent.change(searchInput, { target: { value: 'john doe' } });
    
    await waitFor(() => {
      expect(searchInput).toHaveValue('john doe');
    });
  });

  it('should render employee card after data load', async () => {
    render(<EmployeesPage />);

    // Both mobile card and desktop table render the name and role
    const names = await screen.findAllByText('Budi Santoso', {}, { timeout: 10000 });
    expect(names.length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Kasir/i).length).toBeGreaterThan(0);
    // Mobile card shows totalAttendance as "5 hari" (no prefix); desktop shows "Hadir: 5 hari"
    expect(screen.getAllByText(/5\s*hari/i).length).toBeGreaterThan(0);
  }, 15000);

  it('should show success notification when marking employee present', async () => {
    render(<EmployeesPage />);

    // Desktop table has title="Tandai Hadir Hari Ini"; mobile buttons have no title
    const presentButton = await screen.findByTitle('Tandai Hadir Hari Ini', {}, { timeout: 10000 });
    fireEvent.click(presentButton);

    await waitFor(() => {
      expect(mockRunTransaction).toHaveBeenCalled();
    });
  });
});
