import Link from "next/link";
import { BannerSlot } from "@/components/ui/BannerSlot";
import { getSettings } from "@/lib/settings";

export default async function Footer() {
  const s = await getSettings();
  const redes = [
    { url: s.social_instagram, label: "Instagram" },
    { url: s.social_linkedin, label: "LinkedIn" },
    { url: s.social_youtube, label: "YouTube" },
  ].filter((r) => r.url);

  return (
    <footer className="bg-[#1A2B4A] text-white mt-16">
      <div className="max-w-7xl mx-auto px-4 py-4">
        <BannerSlot position="footer" />
      </div>
      <div className="h-1 bg-gradient-to-r from-[#C9A84C] via-[#e8c97a] to-[#C9A84C]" />
      <div className="max-w-7xl mx-auto px-4 py-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10">

        {/* Coluna 1 — Logo + descrição + redes */}
        <div className="sm:col-span-2 lg:col-span-1">
          <div className="mb-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="Portal Metalmecânica" className="h-14 w-auto object-contain" />
          </div>
          <p className="text-blue-200 text-sm leading-relaxed mb-4">
            O portal de referência para profissionais do setor metalmecânico nos estados do ES e MG.
          </p>
          {redes.length > 0 && (
            <div className="flex gap-3">
              {redes.map((r) => (
                <a key={r.label} href={r.url} target="_blank" rel="noopener noreferrer"
                  className="text-xs font-semibold text-[#C9A84C] border border-[#C9A84C]/40 px-3 py-1 rounded hover:bg-[#C9A84C] hover:text-white transition-colors">
                  {r.label}
                </a>
              ))}
            </div>
          )}
        </div>

        {/* Coluna 2 — Notícias */}
        <div>
          <h3 className="font-bold mb-4 text-[#C9A84C] uppercase tracking-wide text-sm">Notícias</h3>
          <ul className="space-y-2 text-sm text-blue-200">
            <li><Link href="/noticias/es" className="hover:text-white transition-colors">Espírito Santo</Link></li>
            <li><Link href="/noticias/mg" className="hover:text-white transition-colors">Minas Gerais</Link></li>
            <li><Link href="/noticias/brasil" className="hover:text-white transition-colors">Brasil Industrial</Link></li>
            <li><Link href="/noticias/economia" className="hover:text-white transition-colors">Economia</Link></li>
            <li><Link href="/noticias/seguranca" className="hover:text-white transition-colors">Segurança do Trabalho</Link></li>
            <li><Link href="/noticias/tecnologia" className="hover:text-white transition-colors">Tecnologia</Link></li>
            <li><Link href="/noticias" className="hover:text-white transition-colors">Últimas Notícias</Link></li>
          </ul>
        </div>

        {/* Coluna 3 — Portal */}
        <div>
          <h3 className="font-bold mb-4 text-[#C9A84C] uppercase tracking-wide text-sm">Portal</h3>
          <ul className="space-y-2 text-sm text-blue-200">
            <li><Link href="/mercado/exportacao-importacao" className="hover:text-white transition-colors">Exportação & Importação</Link></li>
            <li><Link href="/mercado/licitacoes" className="hover:text-white transition-colors">Licitações</Link></li>
            <li><Link href="/vagas" className="hover:text-white transition-colors">Vagas de Emprego</Link></li>
            <li><Link href="/eventos" className="hover:text-white transition-colors">Eventos</Link></li>
            <li><Link href="/colunistas" className="hover:text-white transition-colors">Colunistas</Link></li>
            <li><Link href="/guia" className="hover:text-white transition-colors">Guia Industrial</Link></li>
            <li><Link href="/classificados" className="hover:text-white transition-colors">Classificados</Link></li>
            <li><Link href="/assinatura" className="hover:text-white transition-colors">Assinar</Link></li>
          </ul>
        </div>

        {/* Coluna 4 — Contato */}
        <div>
          <h3 className="font-bold mb-4 text-[#C9A84C] uppercase tracking-wide text-sm">Contato</h3>
          <ul className="space-y-2 text-sm text-blue-200">
            <li>
              <a href={`mailto:${s.contact_email || "contato@portalmetalmecanica.com.br"}`} className="hover:text-white transition-colors">
                {s.contact_email || "contato@portalmetalmecanica.com.br"}
              </a>
            </li>
            {s.contact_phone && <li>{s.contact_phone}</li>}
            <li>ES e MG — Brasil</li>
          </ul>
        </div>

      </div>

      <div className="border-t border-[#C9A84C] px-4 py-4">
        <p className="text-center text-xs text-blue-300">
          © {new Date().getFullYear()} {s.site_name || "Portal Metalmecânica"}. Todos os direitos reservados.
        </p>
      </div>
    </footer>
  );
}
