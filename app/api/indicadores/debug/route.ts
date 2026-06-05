import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.get('secret') !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  try {
    const now = new Date();
    const toPeriod = (d: Date) => `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}`;
    const log: Array<Record<string, unknown>> = [];

    for (let lag = 2; lag <= 4; lag++) {
      const ref = new Date(now.getFullYear(), now.getMonth() - lag, 1);
      const period = toPeriod(ref);
      const url = `https://apisidra.ibge.gov.br/values/t/8888/n3/32,31/v/11602,12606/p/${period}/c544/129314`;

      try {
        const res = await fetch(url, { cache: 'no-store', headers: { 'User-Agent': 'PortalMetalmecanica/1.0' } });
        const rows = await res.json() as Array<Record<string, string>>;
        const dataRows = rows.slice(1);
        const values = dataRows.map(r => ({ D1C: r['D1C'], D2C: r['D2C'], V: r['V'] }));
        const hasData = dataRows.some(r => r['V'] && r['V'] !== '..' && r['V'] !== '-');
        log.push({ lag, period, status: res.status, rowCount: dataRows.length, hasData, sample: values.slice(0, 4) });
        if (hasData) break;
      } catch (e) {
        log.push({ lag, period, error: String(e) });
      }
    }

    return NextResponse.json({ log });
  } catch (e) {
    return NextResponse.json({ error: String(e) });
  }
}
