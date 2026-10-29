const SITE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://portalmetalmecanica.vercel.app';

/** URL absoluta a partir do caminho, ex.: absoluteUrl('/noticias/x') → https://.../noticias/x */
export function absoluteUrl(path: string): string {
  return `${SITE_URL}${path}`;
}
