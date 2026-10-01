import { describe, it, expect, vi, beforeEach } from 'vitest';

// `src/test/setup.ts` memasang mock global untuk @/lib/firebase. Test ini justru
// menguji implementasi aslinya, jadi mock itu dilepas khusus di file ini.
vi.unmock('@/lib/firebase');

import { collection, query, getDocs, addDoc, orderBy } from '@/lib/firebase';

/**
 * Pemetaan subcollection Firestore -> tabel datar + kolom penaut.
 *
 * Di Firestore, pesan chat disimpan sebagai `chats/{chatId}/messages` sehingga
 * induknya implisit. Di Postgres semuanya tabel datar. Sebelum perbaikan ini,
 * bridge membuang `chatId` sepenuhnya, sehingga:
 *   - tabel `messages` tidak pernah menerima penaut percakapan, dan
 *   - pesan dari semua percakapan akan tercampur dalam satu daftar.
 */

const state = vi.hoisted(() => ({
  filters: [] as { table: string; col: string; val: any }[],
  inserts: [] as { table: string; payload: any }[],
}));

vi.mock('@/lib/supabase', () => {
  const builder = (table: string) => {
    const b: any = {};
    b.select = () => b;
    b.eq = (col: string, val: any) => {
      state.filters.push({ table, col, val });
      return b;
    };
    b.neq = () => b;
    b.gt = () => b;
    b.gte = () => b;
    b.lt = () => b;
    b.lte = () => b;
    b.in = () => b;
    b.contains = () => b;
    b.order = () => b;
    b.limit = () => b;
    b.single = async () => ({ data: null, error: null });
    b.maybeSingle = async () => ({ data: null, error: null });
    b.insert = (payload: any) => {
      state.inserts.push({ table, payload });
      return Promise.resolve({ error: null });
    };
    b.upsert = (payload: any) => {
      state.inserts.push({ table, payload });
      return Promise.resolve({ error: null });
    };
    b.then = (resolve: any) => Promise.resolve({ data: [], error: null }).then(resolve);
    return b;
  };

  return {
    supabase: {
      from: builder,
      auth: { getUser: async () => ({ data: { user: null } }), onAuthStateChange: () => ({ data: { subscription: { unsubscribe: vi.fn() } } }) },
      channel: () => ({ on: () => ({ subscribe: () => {} }) }),
      removeChannel: vi.fn(),
    },
    supabaseAdmin: { from: builder, auth: { admin: {} } },
  };
});

beforeEach(() => {
  state.filters = [];
  state.inserts = [];
});

describe('bridge: collection path', () => {
  it('memetakan subcollection ke tabel segmen terakhir + id induk', () => {
    const ref = collection({}, 'chats', 'chat-1', 'messages');
    expect(ref.table).toBe('messages');
    expect(ref.parentId).toBe('chat-1');
  });

  it('koleksi biasa tidak punya id induk', () => {
    const ref = collection({}, 'chats');
    expect(ref.table).toBe('chats');
    expect(ref.parentId).toBeUndefined();
  });

  it('query() meneruskan id induk', () => {
    const q = query(collection({}, 'chats', 'chat-1', 'messages'), orderBy('createdAt', 'asc'));
    expect(q.parentId).toBe('chat-1');
  });
});

describe('bridge: getDocs', () => {
  it('menyaring pesan berdasarkan chat_id', async () => {
    await getDocs(collection({}, 'chats', 'chat-1', 'messages'));

    expect(state.filters).toContainEqual({ table: 'messages', col: 'chat_id', val: 'chat-1' });
  });

  it('menyaring lewat query() juga', async () => {
    await getDocs(query(collection({}, 'chats', 'chat-9', 'messages'), orderBy('createdAt', 'asc')));

    expect(state.filters).toContainEqual({ table: 'messages', col: 'chat_id', val: 'chat-9' });
    // Urutan waktu tetap diterjemahkan ke kolom asli.
    expect(state.filters.some((f) => f.col === 'chat_id' && f.val === 'chat-9')).toBe(true);
  });

  it('tidak menyaring chat_id pada koleksi biasa', async () => {
    await getDocs(collection({}, 'chats'));

    expect(state.filters.some((f) => f.col === 'chat_id')).toBe(false);
  });
});

describe('bridge: addDoc', () => {
  it('menyertakan chat_id dan mempromosikan kolom pesan', async () => {
    await addDoc(collection({}, 'chats', 'chat-1', 'messages'), {
      text: 'halo',
      senderId: 'user-1',
      createdAt: '2026-10-01T10:00:00.000Z',
      isRead: false,
      type: 'text',
    });

    expect(state.inserts).toHaveLength(1);
    const { table, payload } = state.inserts[0];
    expect(table).toBe('messages');
    expect(payload).toMatchObject({
      chat_id: 'chat-1',
      text: 'halo',
      sender_id: 'user-1',
      is_read: false,
      type: 'text',
    });
    // raw_data tetap menyimpan salinan asli, termasuk penaut percakapan.
    expect(payload.raw_data).toMatchObject({ text: 'halo', chat_id: 'chat-1' });
  });

  it('tidak menambahkan chat_id pada koleksi biasa', async () => {
    await addDoc(collection({}, 'notifications'), { title: 'x' });

    expect(state.inserts[0].payload.chat_id).toBeUndefined();
  });
});
