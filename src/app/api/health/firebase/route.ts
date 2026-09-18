import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET() {
  try {
    const { error } = await supabase.from('products').select('id').limit(1);
    const dbReady = !error;

    return NextResponse.json({
      status: dbReady ? 'ok' : 'error',
      message: dbReady
        ? 'Database (Supabase) is connected and ready.'
        : `Database connection error: ${error?.message || 'unknown'}`,
      timestamp: new Date().toISOString(),
    }, { status: dbReady ? 200 : 500 });
  } catch (err: any) {
    return NextResponse.json({
      status: 'error',
      message: err?.message || 'Database check failed',
    }, { status: 500 });
  }
}
