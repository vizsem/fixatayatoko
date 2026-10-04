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

vi.mock('@/lib/firebase', () => {
  const M = Symbol('supabase_increment');
  return ({
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
  INCREMENT_MARKER: M,
  increment: (n: any) => ({ [M]: true, delta: n }),
  });
});

vi.mock('@/lib/supabase', () => {
  const createQueryBuilder = () => {
    const builder: any = {};
    builder.select = vi.fn().mockReturnValue(builder);
    builder.eq = vi.fn().mockReturnValue(builder);
    builder.order = vi.fn().mockReturnValue(builder);
    builder.single = vi.fn().mockResolvedValue({ data: null, error: null });
    builder.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    builder.neq = vi.fn().mockReturnValue(builder);
    builder.gt = vi.fn().mockReturnValue(builder);
    builder.lt = vi.fn().mockReturnValue(builder);
    builder.gte = vi.fn().mockReturnValue(builder);
    builder.lte = vi.fn().mockReturnValue(builder);
    builder.limit = vi.fn().mockReturnValue(builder);
    builder.insert = vi.fn().mockReturnValue(builder);
    builder.delete = vi.fn().mockReturnValue(builder);
    builder.upsert = vi.fn().mockReturnValue(builder);
    builder.in = vi.fn().mockReturnValue(builder);
    builder.contains = vi.fn().mockReturnValue(builder);
    builder.update = vi.fn().mockReturnValue(builder);
    builder.then = (onfulfilled: any, onrejected?: any) =>
      Promise.resolve({ data: [], error: null }).then(onfulfilled, onrejected);
    return builder;
  };
  return {
    supabase: {
      storage: {},
      auth: {
        getUser: vi.fn(async () => ({
          data: { user: { id: 'admin-user', app_metadata: { role: 'admin' } } },
          error: null,
        })),
        onAuthStateChange: vi.fn(() => ({
          data: { subscription: { unsubscribe: vi.fn() } },
        })),
        signInWithPassword: vi.fn(async () => ({ data: { user: null, session: null }, error: null })),
        signOut: vi.fn(async () => ({ error: null })),
      },
      from: vi.fn(() => createQueryBuilder()),
      rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
    },
    supabaseAdmin: {
      from: vi.fn(() => createQueryBuilder()),
      rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
    },
  };
});


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
  }, 15000);
});
