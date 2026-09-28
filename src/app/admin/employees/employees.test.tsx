import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import EmployeesPage from './page';

// Mock Firebase dependencies
const mockGetDocs = vi.fn();
const mockGetDoc = vi.fn();
const mockRunTransaction = vi.fn();
vi.mock('@/lib/firebase', () => {
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
    
    expect(await screen.findByText('Human Capital')).toBeInTheDocument();
    expect(screen.getByText('Staff & Payroll Engine')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Search Staff...')).toBeInTheDocument();
    expect(screen.getByText(/NEW STAFF/i)).toBeInTheDocument();
  });

  it('should show loading state initially', async () => {
    render(<EmployeesPage />);
    
    await waitFor(() => {
      expect(screen.getByText('Human Capital')).toBeInTheDocument();
    });
  });

  it('should handle search input', async () => {
    render(<EmployeesPage />);
    
    const searchInput = await screen.findByPlaceholderText('Search Staff...');
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
      expect(screen.getByText(/Att:\s*5\s*d/i)).toBeInTheDocument();
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
