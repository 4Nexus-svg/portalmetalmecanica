const SITE_URL_PADRAO = 'https://www.portalmetalmecanica.com.br';

/**
 * Domínio oficial. Ignora NEXT_PUBLIC_APP_URL quando aponta pro domínio interno
 * da Vercel (.vercel.app) ou vem sem protocolo — senão links e og:image saem com
 * endereço errado. Localhost (dev) continua valendo.
 */
export function resolveSiteUrl(env: string | undefined = process.env.NEXT_PUBLIC_APP_URL): string {
  const valor = env?.trim().replace(/\/+$/, '');
  if (!valor || !/^https?:\/\//.test(valor) || valor.includes('.vercel.app')) return SITE_URL_PADRAO;
  return valor;
}

const SITE_URL = resolveSiteUrl();

/** URL absoluta a partir do caminho, ex.: absoluteUrl('/noticias/x') → https://.../noticias/x */
export function absoluteUrl(path: string): string {
  return `${SITE_URL}${path}`;
}
