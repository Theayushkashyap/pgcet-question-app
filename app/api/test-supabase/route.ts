// app/api/test-supabase/route.ts
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../lib/supabaseAdmin';

export async function GET() {
  const { count, error } = await supabaseAdmin
    .from('questions')
    .select('*', { head: true, count: 'exact' });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ questionCount: count });
}
