import { describe, it, expect } from 'vitest';
import { resolveSiteUrl } from './seo';

const OFICIAL = 'https://www.portalmetalmecanica.com.br';

describe('resolveSiteUrl', () => {
  it('usa o domínio oficial sem env', () => expect(resolveSiteUrl(undefined)).toBe(OFICIAL));
  it('ignora .vercel.app', () =>
    expect(resolveSiteUrl('https://portalmetalmecanica.vercel.app')).toBe(OFICIAL));
  it('ignora valor sem protocolo', () =>
    expect(resolveSiteUrl('www.portalmetalmecanica.com.br')).toBe(OFICIAL));
  it('remove barra final', () =>
    expect(resolveSiteUrl('https://www.portalmetalmecanica.com.br/')).toBe(OFICIAL));
  it('mantém localhost em dev', () =>
    expect(resolveSiteUrl('http://localhost:3005')).toBe('http://localhost:3005'));
});
