'use server'

import { revalidatePath } from 'next/cache'
import { requireAdmin, requireStaff } from '@/lib/actions/session'
import { ambilSemuaPurchaseOrder, hitungRekonsiliasiModal, rekonsiliasiMutasiModal } from '@/lib/capital-ledger'
import { kebutuhanModalPO, petakanPOUntukRekonsiliasi, type BarisRekonsiliasi } from '@/lib/capital-reconcile'

/**
 * Rekonsiliasi Purchase Order ↔ buku besar modal.
 *
 * LATAR BELAKANG
 * --------------
 * Sampai 2026-10-01 pencatatan modal untuk PO dilakukan di peramban dan selalu
 * gagal dengan senyap, sehingga banyak PO tunai tidak pernah memotong saldo
 * modal. Penulisannya sudah diperbaiki (`src/lib/capital-ledger.ts`), tetapi PO
 * yang dibuat SEBELUM perbaikan itu masih menyisakan selisih.
 *
 * Halaman `/admin/capital/rekonsiliasi` memakai dua aksi di berkas ini:
 *   - `getCapitalReconciliation()`  — daftar selisih (hanya membaca),
 *   - `applyCapitalReconciliation()` — menutup selisih untuk PO yang DIPILIH.
 *
 * Semua nominal DIHITUNG ULANG di server dari data PO; angka yang dikirim klien
 * tidak pernah dipercaya. Penulisannya memakai `rekonsiliasiMutasiModal()` yang
 * idempoten, jadi menekan tombol dua kali tidak menggandakan mutasi.
 */

export type CapitalReconciliationResult =
  | {
      success: true
      data: {
        baris: BarisRekonsiliasi[]
        ringkasan: {
          jumlah: number
          kurangPotong: number
          lebihPotong: number
          jumlahKurangPotong: number
          jumlahLebihPotong: number
        }
      }
    }
  | { success: false; error: string }

/** Batas aman: satu permintaan tidak boleh memproses lebih dari ini. */
const MAKS_PO_PER_PERMINTAAN = 500

/** Daftar PO yang selisih modalnya belum nol. Hanya membaca. */
export async function getCapitalReconciliation(): Promise<CapitalReconciliationResult> {
  await requireStaff()
  try {
    const { baris, ringkasan } = await hitungRekonsiliasiModal()
    return { success: true, data: { baris, ringkasan } }
  } catch (error: any) {
    return { success: false, error: error?.message || 'Gagal memuat rekonsiliasi modal' }
  }
}

/**
 * Tutup selisih modal untuk PO yang dipilih.
 *
 * Klien HANYA mengirim daftar id PO. Nominal, cara bayar, dan jenis penyesuaian
 * (WITHDRAWAL/INJECTION) dihitung ulang di server, sehingga permintaan yang
 * dimanipulasi tidak bisa memindahkan uang ke arah yang salah.
 */
export async function applyCapitalReconciliation(poIds: string[]): Promise<{
  success: boolean
  error?: string
  data?: { diproses: number; disesuaikan: number; gagal: string[] }
}> {
  await requireAdmin()
  try {
    const ids = Array.from(
      new Set((Array.isArray(poIds) ? poIds : []).filter((id) => typeof id === 'string' && id.trim()))
    ).slice(0, MAKS_PO_PER_PERMINTAAN)

    if (ids.length === 0) {
      return { success: false, error: 'Tidak ada PO yang dipilih' }
    }

    // Ambil PO dari basis data (bukan dari klien), lalu saring sesuai pilihan.
    const semuaPO = await ambilSemuaPurchaseOrder()
    const petaPO = new Map(semuaPO.map((row: any) => [String(row.id), petakanPOUntukRekonsiliasi(row)]))

    const gagal: string[] = []
    let disesuaikan = 0
    let diproses = 0

    for (const id of ids) {
      const po = petaPO.get(id)
      if (!po) {
        gagal.push(`${id} (PO tidak ditemukan)`)
        continue
      }

      const hasil = await rekonsiliasiMutasiModal({
        referenceId: po.id,
        diharapkan: kebutuhanModalPO(po),
        label: po.supplierName,
        paymentMethod: po.paymentMethod,
        keterangan: `Penyesuaian Selisih Modal PO ${po.poNumber}`,
      })

      if (!hasil.success) {
        gagal.push(`${po.poNumber ?? id} (${hasil.error})`)
        continue
      }

      diproses += 1
      disesuaikan += hasil.disesuaikan
    }

    revalidatePath('/admin/capital')
    revalidatePath('/admin/capital/rekonsiliasi')

    return { success: true, data: { diproses, disesuaikan, gagal } }
  } catch (error: any) {
    return { success: false, error: error?.message || 'Gagal menerapkan rekonsiliasi modal' }
  }
}
