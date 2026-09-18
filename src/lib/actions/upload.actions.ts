'use server'

import { uploadToSupabase } from '@/lib/supabase'

export async function uploadImageAction(formData: FormData): Promise<{ success: boolean; url?: string; error?: string }> {
  try {
    const file = formData.get('file') as File | null
    const folder = (formData.get('folder') as string) || 'products'

    if (!file) {
      return { success: false, error: 'Tidak ada file yang diunggah' }
    }

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const ext = file.name.split('.').pop() || 'jpg'
    const fileName = `${folder}/${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${ext}`

    return await uploadToSupabase('products', fileName, buffer, file.type)
  } catch (error: any) {
    console.error('Failed to upload image:', error)
    return { success: false, error: error.message || 'Gagal mengunggah gambar' }
  }
}
