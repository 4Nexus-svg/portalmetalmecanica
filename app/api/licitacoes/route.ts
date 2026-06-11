import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const revalidate = 300;

export async function GET(req: NextRequest) {
  const uf     = req.nextUrl.searchParams.get('uf');
  const status = req.nextUrl.searchParams.get('status');

  const supabase = await createClient();
  let query = supabase
    .from('licitacoes_pncp')
    .select('*')
    .order('data_encerramento', { ascending: true, nullsFirst: false })
    .limit(100);

  if (uf)     query = query.eq('uf', uf.toUpperCase());
  if (status) query = query.eq('status', status);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ data: data ?? [] });
}
