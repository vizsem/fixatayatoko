'use server'

import { revalidatePath } from 'next/cache'
import { requireStaff } from '@/lib/actions/session'
import { supabaseAdmin } from '@/lib/supabase'

export type SupplierDebt = {
  id: string
  poNumber: string
  supplierName: string
  supplierId?: string
  totalAmount: number
  paymentMethod: string
  dueDate?: string | null
  createdAt: string
  status: string
  notes?: string | null
  paidAt?: string | null
  isOverdue: boolean
}

export type CustomerDebt = {
  id: string
  orderId: string
  customerName: string
  customerPhone?: string
  totalAmount: number
  paymentMethod: string
  dueDate?: string | null
  createdAt: string
  status: string
  notes?: string | null
  isOverdue: boolean
  channel?: string
}

export type DebtSummary = {
  totalSupplierDebt: number
  totalCustomerDebt: number
  overdueSupplierCount: number
  overdueCustomerCount: number
  supplierDebts: SupplierDebt[]
  customerDebts: CustomerDebt[]
}

/**
 * Ambil semua data hutang:
 * - Hutang ke supplier (PO dengan paymentStatus = HUTANG)
 * - Piutang dari pelanggan (Orders dengan status = BELUM_LUNAS)
 */
export async function getDebtReport(): Promise<DebtSummary> {
  await requireStaff()

  const now = new Date()

  // 1. Hutang ke supplier: PO yang belum lunas
  const { data: purchaseRows } = await supabaseAdmin
    .from('purchases')
    .select('id,total,payment_status,payment_method,created_at,raw_data')
    .or('payment_status.eq.HUTANG,payment_status.is.null,raw_data->>paymentStatus.eq.HUTANG,raw_data->>paymentStatus.eq.BELUM_LUNAS')
    .order('created_at', { ascending: false })

  const supplierDebts: SupplierDebt[] = (purchaseRows || [])
    .filter((p: any) => {
      const raw = p.raw_data || {}
      const ps = raw.paymentStatus || p.payment_status || 'LUNAS'
      return ps === 'HUTANG' || ps === 'BELUM_LUNAS'
    })
    .map((p: any) => {
      const raw = p.raw_data || {}
      const dueDate = raw.dueDate || null
      const isOverdue = dueDate ? new Date(dueDate) < now : false
      return {
        id: p.id,
        poNumber: raw.poNumber || raw.invoiceNumber || `PO-${p.id.slice(0, 8).toUpperCase()}`,
        supplierName: raw.supplierName || raw.supplier?.name || 'Supplier',
        supplierId: raw.supplierId || null,
        totalAmount: Number(p.total ?? raw.total ?? raw.totalAmount ?? 0),
        paymentMethod: raw.paymentMethod || p.payment_method || 'HUTANG',
        dueDate,
        createdAt: p.created_at || raw.createdAt || new Date().toISOString(),
        status: raw.status || p.status || 'RECEIVED',
        notes: raw.notes || null,
        paidAt: raw.paidAt || null,
        isOverdue,
      }
    })

  // 2. Piutang dari pelanggan: Orders BELUM_LUNAS
  const { data: orderRows } = await supabaseAdmin
    .from('orders')
    .select('*')
    .eq('status', 'BELUM_LUNAS')
    .order('created_at', { ascending: false })

  const customerDebts: CustomerDebt[] = (orderRows || []).map((o: any) => {
    const raw = o.raw_data || {}
    const dueDate = raw.dueDate || o.due_date || null
    const isOverdue = dueDate ? new Date(dueDate) < now : false
    return {
      id: o.id,
      orderId: o.order_id || o.id,
      customerName: o.customer_name || raw.customerName || 'Pelanggan',
      customerPhone: raw.customerPhone || o.customer_phone || '',
      totalAmount: Number(o.total ?? raw.total ?? 0),
      paymentMethod: raw.paymentMethod || o.payment_method || 'TEMPO',
      dueDate,
      createdAt: o.created_at || raw.createdAt || new Date().toISOString(),
      status: o.status || 'BELUM_LUNAS',
      notes: raw.notes || null,
      isOverdue,
      channel: raw.source || raw.channel || 'CASHIER',
    }
  })

  const totalSupplierDebt = supplierDebts.reduce((s, d) => s + d.totalAmount, 0)
  const totalCustomerDebt = customerDebts.reduce((s, d) => s + d.totalAmount, 0)
  const overdueSupplierCount = supplierDebts.filter((d) => d.isOverdue).length
  const overdueCustomerCount = customerDebts.filter((d) => d.isOverdue).length

  return {
    totalSupplierDebt,
    totalCustomerDebt,
    overdueSupplierCount,
    overdueCustomerCount,
    supplierDebts,
    customerDebts,
  }
}

/**
 * Tandai piutang pelanggan (order BELUM_LUNAS) sebagai SELESAI/LUNAS.
 */
export async function markCustomerDebtPaid(
  orderId: string,
  paymentMethod?: string,
  notes?: string
): Promise<{ success: boolean; error?: string }> {
  await requireStaff()
  try {
    const { data: o, error: fetchErr } = await supabaseAdmin
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single()

    if (fetchErr || !o) return { success: false, error: 'Order tidak ditemukan' }

    const raw = o.raw_data || {}
    if (o.status !== 'BELUM_LUNAS') {
      return { success: false, error: 'Order ini sudah berstatus LUNAS / SELESAI' }
    }

    const updatedRaw = {
      ...raw,
      status: 'SELESAI',
      paymentMethod: paymentMethod || raw.paymentMethod || 'CASH',
      paidAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      notes: notes
        ? (raw.notes ? `${raw.notes}\n[Pelunasan]: ${notes}` : `[Pelunasan]: ${notes}`)
        : raw.notes,
    }

    const { error: updateErr } = await supabaseAdmin
      .from('orders')
      .update({
        status: 'SELESAI',
        raw_data: updatedRaw,
        updated_at: new Date().toISOString(),
      })
      .eq('id', orderId)

    if (updateErr) throw updateErr

    revalidatePath('/admin/orders')
    revalidatePath(`/admin/orders/${orderId}`)
    revalidatePath('/admin/reports/hutang')
    revalidatePath('/admin/reports')

    return { success: true }
  } catch (err: any) {
    console.error('markCustomerDebtPaid error:', err)
    return { success: false, error: err?.message || 'Gagal melunasi piutang' }
  }
}
