import { beforeEach, describe, expect, it, vi } from 'vitest'
import { uploadImageAction } from '@/lib/actions/upload.actions'

const mocks = vi.hoisted(() => ({
  uploadToSupabase: vi.fn(),
}))

vi.mock('@/lib/supabase', () => ({ uploadToSupabase: mocks.uploadToSupabase }))

beforeEach(() => {
  vi.clearAllMocks()
  mocks.uploadToSupabase.mockResolvedValue({ success: true, url: 'https://storage.example/products/test.jpg' })
})

function urlForm(url: string): FormData {
  const formData = new FormData()
  formData.set('url', url)
  return formData
}

describe('uploadImageAction untuk URL gambar', () => {
  it('mengunduh gambar publik lalu mengunggahnya ke Storage', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(new Uint8Array([1, 2, 3]), {
      headers: { 'content-type': 'image/jpeg', 'content-length': '3' },
    })))

    const result = await uploadImageAction(urlForm('https://93.184.216.34/product.jpg'))

    expect(result).toEqual({ success: true, url: 'https://storage.example/products/test.jpg' })
    expect(mocks.uploadToSupabase).toHaveBeenCalledWith(
      'products', expect.stringMatching(/^products\/.+\.jpg$/), expect.any(Buffer), 'image/jpeg'
    )
  })

  it('menolak URL yang tidak mengembalikan gambar', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('not an image', {
      headers: { 'content-type': 'text/html' },
    })))

    const result = await uploadImageAction(urlForm('https://93.184.216.34/product'))

    expect(result).toMatchObject({ success: false, error: 'URL tidak mengarah ke format gambar yang didukung' })
    expect(mocks.uploadToSupabase).not.toHaveBeenCalled()
  })

  it('menolak host yang mengarah ke alamat privat sebelum melakukan fetch', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const result = await uploadImageAction(urlForm('http://10.0.0.8/product.jpg'))

    expect(result).toMatchObject({ success: false, error: 'URL foto harus mengarah ke host publik' })
    expect(fetchMock).not.toHaveBeenCalled()
    expect(mocks.uploadToSupabase).not.toHaveBeenCalled()
  })

  it('menolak gambar yang ukuran responsnya melebihi batas', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, {
      headers: { 'content-type': 'image/jpeg', 'content-length': String(5 * 1024 * 1024 + 1) },
    })))

    const result = await uploadImageAction(urlForm('https://93.184.216.34/product.jpg'))

    expect(result).toMatchObject({ success: false, error: 'Ukuran foto maksimal 5 MB' })
    expect(mocks.uploadToSupabase).not.toHaveBeenCalled()
  })
})