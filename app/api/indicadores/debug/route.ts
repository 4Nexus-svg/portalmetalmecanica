import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.get('secret') !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  try {
    const url = 'https://apisidra.ibge.gov.br/values/t/8888/n3/32,31/v/11602,12606/p/202603/c544/129314';
    const res = await fetch(url, {
      cache: 'no-store',
      headers: { 'User-Agent': 'PortalMetalmecanica/1.0' },
    });
    const status = res.status;
    const text = await res.text();
    return NextResponse.json({ status, body: text.substring(0, 500) });
  } catch (e) {
    return NextResponse.json({ error: String(e) });
  }
}
