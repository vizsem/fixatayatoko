import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.mock';

export const supabase = createClient(supabaseUrl, supabaseKey);

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
