"use client";

import { useEffect, useState } from "react";

/**
 * Mostra o paywall (children) e, se o leitor for assinante, troca pelo corpo
 * da notícia exclusiva buscado com a sessão dele (ver
 * app/api/noticias/[slug]/conteudo). Mantém a página da notícia cacheável.
 */
export default function ConteudoExclusivo({ slug, children }: { slug: string; children: React.ReactNode }) {
  const [html, setHtml] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;
    fetch(`/api/noticias/${encodeURIComponent(slug)}/conteudo`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { html?: string } | null) => {
        if (ativo && d?.html) setHtml(d.html);
      })
      .catch(() => {});
    return () => {
      ativo = false;
    };
  }, [slug]);

  if (html === null) return <>{children}</>;

  return (
    <div
      className="prose prose-lg max-w-none prose-headings:text-gray-900 prose-a:text-blue-700"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
