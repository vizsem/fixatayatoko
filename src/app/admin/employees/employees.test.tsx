import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import EmployeesPage from './page';
import notify from '@/lib/notify';

// Mock Firebase dependencies
vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  doc: vi.fn(),
  updateDoc: vi.fn(),
  query: vi.fn(),
  orderBy: vi.fn(),
  getDocs: vi.fn(() =>
    Promise.resolve({
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
    }),
  ),
  increment: vi.fn(),
  addDoc: vi.fn(),
  deleteDoc: vi.fn(),
  serverTimestamp: vi.fn(),
  writeBatch: vi.fn(() => ({
    update: vi.fn(),
    set: vi.fn(),
    commit: vi.fn(),
  })),
  arrayUnion: vi.fn(),
  setDoc: vi.fn(),
  Timestamp: {
    now: vi.fn(),
  },
}));

vi.mock('@/lib/firebase', () => ({
  db: {},
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
      expect(notify.admin.success).toHaveBeenCalled();
    });
  });
});
