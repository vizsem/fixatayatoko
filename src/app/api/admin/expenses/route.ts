import { NextResponse } from 'next/server';
import { getExpenses, createExpense, deleteExpense } from '@/lib/actions/expense.actions';
import { ActionAuthError } from '@/lib/actions/session';

/**
 * Endpoint ini sebelumnya TANPA otorisasi sama sekali, padahal action di
 * belakangnya memakai klien service role (melewati RLS). Sekarang action-nya
 * sendiri yang memverifikasi identitas (fail-closed); helper di bawah hanya
 * menerjemahkan penolakan menjadi 401/403, bukan 500.
 */
function toErrorResponse(error: unknown): NextResponse {
  if (error instanceof ActionAuthError) {
    const status = error.code === 'UNAUTHENTICATED' ? 401 : 403;
    return NextResponse.json({ error: error.message, code: error.code }, { status });
  }
  console.error('Expenses API error:', error);
  return NextResponse.json({ error: 'Terjadi kesalahan pada server' }, { status: 500 });
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const category = url.searchParams.get('category') ?? undefined;
    const start = url.searchParams.get('start') ? new Date(url.searchParams.get('start')!) : undefined;
    const end = url.searchParams.get('end') ? new Date(url.searchParams.get('end')!) : undefined;
    const data = await getExpenses({ category, startDate: start, endDate: end });
    return NextResponse.json(data);
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { category, amount, description, date } = body;
    const result = await createExpense({
      category,
      amount,
      description,
      date: new Date(date),
    });
    return NextResponse.json(result);
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const url = new URL(request.url);
    const id = url.searchParams.get('id');
    if (!id) return NextResponse.json({ success: false, error: 'Missing id' }, { status: 400 });
    const result = await deleteExpense(id);
    return NextResponse.json(result);
  } catch (error) {
    return toErrorResponse(error);
  }
}
