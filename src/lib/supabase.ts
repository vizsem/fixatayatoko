import { createClient } from '@supabase/supabase-js';

/**
 * Klien Supabase.
 *
 * Ada dua klien dengan peran berbeda:
 *
 * 1. `supabase`      - memakai publishable/anon key. Aman dipakai di browser dan
 *                      tunduk pada RLS. Gunakan di client component.
 * 2. `supabaseAdmin` - memakai service role/secret key dan MELEWATI RLS.
 *                      HANYA untuk server (Server Action / Route Handler).
 *                      Jangan pernah memberi prefix NEXT_PUBLIC_ pada key ini.
 */

const isServer = typeof window === 'undefined';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseAnonKey = 
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || 
  process.env.SUPABASE_PUBLISHABLE_KEY || 
  '';
const supabaseServiceKey = 
  process.env.SUPABASE_SERVICE_ROLE_KEY || 
  process.env.SUPABASE_SECRET_KEY || 
  '';

const supabaseKey = supabaseAnonKey || supabaseServiceKey;

if (!supabaseUrl || !supabaseKey) {
  // Log warning agar terlihat di Vercel Function Logs
  console.error(
    '[Supabase] KONFIGURASI TIDAK LENGKAP!\n' +
    'Pastikan variabel berikut sudah di-set di Vercel Environment Variables:\n' +
    '  - NEXT_PUBLIC_SUPABASE_URL\n' +
    '  - NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (atau NEXT_PUBLIC_SUPABASE_ANON_KEY)\n' +
    'URL:', supabaseUrl ? '✓ ada' : '✗ KOSONG',
    '| Key:', supabaseKey ? '✓ ada' : '✗ KOSONG'
  );
}

// Peringatan khusus server: tanpa service key, supabaseAdmin tidak akan
// mem-bypass RLS sehingga operasi backend bisa gagal tanpa pesan yang jelas.
if (isServer && !supabaseServiceKey) {
  console.warn(
    '[Supabase] SUPABASE_SERVICE_ROLE_KEY belum di-set di server. ' +
    'supabaseAdmin akan memakai publishable key, sehingga RLS TETAP BERLAKU ' +
    'dan query yang seharusnya bypass RLS akan gagal atau mengembalikan data kosong. ' +
    'Set di .env.local (lokal) dan Vercel Environment Variables (produksi).'
  );
}

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseKey || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.mock'
);

/**
 * Admin client with Service Role Key for server actions and backend mutations (bypasses RLS)
 */
export const supabaseAdmin = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseServiceKey || supabaseKey || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.mock',
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    }
  }
);

/**
 * Server-side helper to upload a buffer/blob directly to Supabase Storage
 */
export async function uploadToSupabase(
  bucketName: string,
  filePath: string,
  fileData: Buffer | Uint8Array | Blob | ArrayBuffer,
  contentType?: string
): Promise<{ success: boolean; url?: string; error?: string }> {
  try {
    const { data, error } = await supabase.storage
      .from(bucketName)
      .upload(filePath, fileData, {
        upsert: true,
        contentType: contentType || 'image/jpeg',
      })

    if (error) {
      console.error('Supabase upload error:', error)
      return { success: false, error: error.message }
    }

    const { data: publicUrlData } = supabase.storage
      .from(bucketName)
      .getPublicUrl(data.path)

    return { success: true, url: publicUrlData.publicUrl }
  } catch (err: any) {
    console.error('Supabase upload exception:', err)
    return { success: false, error: err.message || 'Unknown upload error' }
  }
}
