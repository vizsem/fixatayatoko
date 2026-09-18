import { NextResponse } from 'next/server';
import { getExpenses, createExpense, deleteExpense } from '@/lib/actions/expense.actions';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const category = url.searchParams.get('category') ?? undefined;
  const start = url.searchParams.get('start') ? new Date(url.searchParams.get('start')!) : undefined;
  const end = url.searchParams.get('end') ? new Date(url.searchParams.get('end')!) : undefined;
  const data = await getExpenses({ category, startDate: start, endDate: end });
  return NextResponse.json(data);
}

export async function POST(request: Request) {
  const body = await request.json();
  const { category, amount, description, date } = body;
  const result = await createExpense({
    category,
    amount,
    description,
    date: new Date(date),
  });
  return NextResponse.json(result);
}

export async function DELETE(request: Request) {
  const url = new URL(request.url);
  const id = url.searchParams.get('id');
  if (!id) return NextResponse.json({ success: false, error: 'Missing id' }, { status: 400 });
  const result = await deleteExpense(id);
  return NextResponse.json(result);
}
