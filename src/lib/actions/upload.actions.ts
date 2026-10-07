'use server'

import { lookup } from 'node:dns/promises'
import { randomUUID } from 'node:crypto'
import { BlockList, isIP } from 'node:net'
import { uploadToSupabase } from '@/lib/supabase'

const MAX_IMAGE_BYTES = 5 * 1024 * 1024
const IMAGE_TYPES: Record<string, string> = {
  'image/avif': 'avif',
  'image/gif': 'gif',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

const blockedAddresses = new BlockList()
for (const [address, prefix] of [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8],
  ['169.254.0.0', 16], ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.0.2.0', 24],
  ['192.168.0.0', 16], ['198.18.0.0', 15], ['198.51.100.0', 24], ['203.0.113.0', 24],
  ['224.0.0.0', 4], ['240.0.0.0', 4],
] as const) {
  blockedAddresses.addSubnet(address, prefix, 'ipv4')
}
for (const [address, prefix] of [
  ['::', 128], ['::1', 128], ['64:ff9b::', 96], ['100::', 64],
  ['2001:db8::', 32], ['fc00::', 7], ['fe80::', 10], ['ff00::', 8],
] as const) {
  blockedAddresses.addSubnet(address, prefix, 'ipv6')
}

async function downloadImage(urlValue: string): Promise<{ buffer: Buffer; contentType: string }> {
  let url: URL
  try {
    url = new URL(urlValue)
  } catch {
    throw new Error('URL foto tidak valid')
  }

  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
    throw new Error('URL foto harus berupa alamat HTTP atau HTTPS publik')
  }

  const hostname = url.hostname.toLowerCase()
  const addressHostname = hostname.startsWith('[') && hostname.endsWith(']')
    ? hostname.slice(1, -1)
    : hostname
  if (hostname === 'localhost' || hostname.endsWith('.localhost') || hostname.endsWith('.local')) {
    throw new Error('Host URL foto tidak diizinkan')
  }

  const ipVersion = isIP(addressHostname)
  const addresses = ipVersion
    ? [{ address: addressHostname, family: ipVersion }]
    : await lookup(hostname, { all: true, verbatim: true })
  if (!addresses.length || addresses.some(({ address }) => {
    const version = isIP(address)
    return version === 0 || address.toLowerCase().startsWith('::ffff:') ||
      blockedAddresses.check(address, version === 4 ? 'ipv4' : 'ipv6')
  })) {
    throw new Error('URL foto harus mengarah ke host publik')
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  if (supabaseUrl) {
    const storageUrl = new URL(supabaseUrl)
    if (url.origin === storageUrl.origin && url.pathname.startsWith('/storage/v1/object/public/products/')) {
      return { buffer: Buffer.alloc(0), contentType: 'application/x-existing-storage-url' }
    }
  }

  const response = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(10_000) })
  if (!response.ok) throw new Error(`Gagal mengunduh foto (HTTP ${response.status})`)

  const contentType = (response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase()
  if (!IMAGE_TYPES[contentType]) throw new Error('URL tidak mengarah ke format gambar yang didukung')

  const contentLength = Number(response.headers.get('content-length') || 0)
  if (contentLength > MAX_IMAGE_BYTES) throw new Error('Ukuran foto maksimal 5 MB')

  if (!response.body) throw new Error('File foto kosong')
  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let totalBytes = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    totalBytes += value.byteLength
    if (totalBytes > MAX_IMAGE_BYTES) {
      await reader.cancel()
      throw new Error('Ukuran foto maksimal 5 MB')
    }
    chunks.push(value)
  }

  if (!totalBytes) throw new Error('File foto kosong')
  return { buffer: Buffer.concat(chunks), contentType }
}

export async function uploadImageAction(formData: FormData): Promise<{ success: boolean; url?: string; error?: string }> {
  try {
    const file = formData.get('file') as File | null
    const sourceUrl = String(formData.get('url') || '').trim()
    const folder = (formData.get('folder') as string) || 'products'

    if (!file && !sourceUrl) {
      return { success: false, error: 'Pilih file atau masukkan URL foto' }
    }

    let buffer: Buffer
    let contentType: string
    if (file) {
      if (!file.type.startsWith('image/') || !IMAGE_TYPES[file.type]) {
        return { success: false, error: 'Format gambar tidak didukung' }
      }
      if (file.size > MAX_IMAGE_BYTES) return { success: false, error: 'Ukuran foto maksimal 5 MB' }
      buffer = Buffer.from(await file.arrayBuffer())
      contentType = file.type
    } else {
      const downloaded = await downloadImage(sourceUrl)
      if (downloaded.contentType === 'application/x-existing-storage-url') {
        return { success: true, url: sourceUrl }
      }
      buffer = downloaded.buffer
      contentType = downloaded.contentType
    }

    const ext = IMAGE_TYPES[contentType]
    const fileName = `${folder}/${randomUUID()}.${ext}`

    return await uploadToSupabase('products', fileName, buffer, contentType)
  } catch (error: any) {
    console.error('Failed to upload image:', error)
    return { success: false, error: error.message || 'Gagal mengunggah gambar' }
  }
}
