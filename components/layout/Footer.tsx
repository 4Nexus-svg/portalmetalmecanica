import Link from "next/link";
import { BannerSlot } from "@/components/ui/BannerSlot";

export default async function Footer() {
  return (
    <footer className="bg-[#1A2B4A] text-white mt-16">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <BannerSlot position="footer" />
        </div>
        <div className="h-1 bg-gradient-to-r from-[#C9A84C] via-[#e8c97a] to-[#C9A84C]" />
      <div className="max-w-7xl mx-auto px-4 py-12 grid grid-cols-1 md:grid-cols-3 gap-8">
        
        {/* Logo e descrição */}
        <div>
         <div className="mb-4">
  {/* eslint-disable-next-line @next/next/no-img-element */}
  <img
    src="/logo.png"
    alt="Portal Metalmecânica"
    className="h-14 w-auto object-contain"
  />
</div>
          <p className="text-blue-200 text-sm leading-relaxed">
            O portal de referência para profissionais do setor metalmecânico nos estados do ES e MG.
          </p>
        </div>

        {/* Links */}
        <div>
          <h3 className="font-semibold mb-4 text-white">Navegação</h3>
          <ul className="space-y-2 text-sm text-blue-200">
            <li><Link href="/" className="hover:text-white transition-colors">Início</Link></li>
            <li><Link href="/noticias" className="hover:text-white transition-colors">Notícias</Link></li>
            <li><Link href="/classificados" className="hover:text-white transition-colors">Classificados</Link></li>
            <li><Link href="/assinatura" className="hover:text-white transition-colors">Assinar</Link></li>
          </ul>
        </div>

        {/* Contato */}
        <div>
          <h3 className="font-semibold mb-4 text-white">Contato</h3>
          <ul className="space-y-2 text-sm text-blue-200">
            <li>contato@portalmetalmecanica.com.br</li>
            <li>ES e MG — Brasil</li>
          </ul>
        </div>

      </div>

      <div className="border-t border-[#C9A84C] px-4 py-4">
        <p className="text-center text-xs text-blue-300">
          © {new Date().getFullYear()} Portal Metalmecânica. Todos os direitos reservados.
        </p>
      </div>
    </footer>
  );
}