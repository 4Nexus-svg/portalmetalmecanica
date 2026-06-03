import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import ColunistasCarrossel from "@/components/ui/ColunistasCarrossel";

export const revalidate = 300;

const COLUNISTAS = [
  { nome: "Ricardo Mendonça", slug: "ricardo-mendonca", especialidade: "Automação & Indústria 4.0", iniciais: "RM", cor: "bg-blue-700" },
  { nome: "Fernanda Castelo", slug: "fernanda-castelo", especialidade: "Gestão Industrial & Lean", iniciais: "FC", cor: "bg-amber-700" },
  { nome: "Carlos Drummond Neto", slug: "carlos-drummond-neto", especialidade: "Soldagem & Metalurgia", iniciais: "CD", cor: "bg-orange-700" },
  { nome: "Patrícia Sousa", slug: "patricia-sousa", especialidade: "Mercado & Investimentos", iniciais: "PS", cor: "bg-green-700" },
  { nome: "Marcos Vinicius Teixeira", slug: "marcos-vinicius-teixeira", especialidade: "Manutenção Preditiva", iniciais: "MV", cor: "bg-red-700" },
  { nome: "Juliana Faria", slug: "juliana-faria", especialidade: "ISO 9001 & Qualidade", iniciais: "JF", cor: "bg-purple-700" },
];

export default async function HomePage() {
  const supabase = await createClient();

  const { data: posts } = await supabase
    .from("posts")
    .select("id, slug, title, excerpt, featured_image, category, region, published_at, is_exclusive")
    .not("published_at", "is", null)
    .order("published_at", { ascending: false })
    .limit(20);

  const destaque = posts?.[0];
  const secundarias = posts?.slice(1, 4) ?? [];
  const grid = posts?.slice(4, 10) ?? [];
  const maisLidas = posts?.slice(0, 6) ?? [];
  const ultimasNoticias = posts?.slice(10, 16) ?? [];

  return (
    <>
    <div className="max-w-7xl mx-auto px-4 pt-6">

      {/* MANCHETE PRINCIPAL */}
      {destaque && (
        <section className="mb-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

            {/* Post destaque grande */}
            <Link href={"/noticias/" + destaque.slug} className="lg:col-span-2 group relative rounded-xl overflow-hidden block">
              <div className="relative aspect-video bg-[#1A2B4A]">
                {destaque.featured_image ? (
                  <img src={destaque.featured_image} alt={destaque.title} className="w-full h-full object-cover opacity-70 group-hover:opacity-80 transition-opacity" />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-[#1A2B4A] to-[#0f1e35]" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />
                <div className="absolute bottom-0 left-0 p-6">
                  {destaque.category && (
                    <span className="bg-[#C9A84C] text-white text-xs font-bold px-2 py-1 rounded mb-3 inline-block uppercase tracking-wide">
                      {destaque.category}
                    </span>
                  )}
                  <h2 className="text-white text-2xl md:text-3xl font-bold leading-tight mb-2 group-hover:text-[#C9A84C] transition-colors">
                    {destaque.title}
                  </h2>
                  {destaque.excerpt && (
                    <p className="text-gray-300 text-sm line-clamp-2">{destaque.excerpt}</p>
                  )}
                  {destaque.published_at && (
                    <p className="text-gray-400 text-xs mt-2">
                      {format(new Date(destaque.published_at), "d 'de' MMMM 'de' yyyy", { locale: ptBR })}
                    </p>
                  )}
                </div>
              </div>
            </Link>

            {/* 3 posts secundários */}
            <div className="flex flex-col gap-3">
              {secundarias.map((post) => (
                <Link key={post.id} href={"/noticias/" + post.slug} className="group flex gap-3 bg-white rounded-lg border border-gray-100 p-3 hover:shadow-md transition-shadow">
                  <div className="w-20 h-20 flex-shrink-0 rounded-md overflow-hidden bg-gray-100">
                    {post.featured_image ? (
                      <img src={post.featured_image} alt={post.title} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-[#1A2B4A]/10 flex items-center justify-center text-xs text-gray-400 font-bold">PM</div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    {post.category && (
                      <span className="text-xs font-bold text-[#C9A84C] uppercase">{post.category}</span>
                    )}
                    <h3 className="text-sm font-semibold text-gray-900 group-hover:text-[#1A2B4A] line-clamp-2 mt-0.5 leading-tight">
                      {post.title}
                    </h3>
                    {post.published_at && (
                      <p className="text-xs text-gray-400 mt-1">
                        {format(new Date(post.published_at), "dd/MM/yyyy", { locale: ptBR })}
                      </p>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* LINHA DIVISÓRIA DOURADA */}
      <div className="h-0.5 bg-gradient-to-r from-[#C9A84C] via-[#e8c97a] to-[#C9A84C]" />
    </div>

    {/* FAIXA COLUNISTAS — full-width */}
    <ColunistasCarrossel colunistas={COLUNISTAS} />

    <div className="max-w-7xl mx-auto px-4 pb-8">

      {/* CONTEÚDO PRINCIPAL + SIDEBAR */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-8">

        {/* COLUNA PRINCIPAL */}
        <div className="lg:col-span-2 space-y-8">

          {/* Grid de notícias */}
          <section>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-1 h-6 bg-[#C9A84C] rounded" />
              <h2 className="text-lg font-bold text-[#1A2B4A] uppercase tracking-wide">Últimas Notícias</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {grid.map((post) => (
                <Link key={post.id} href={"/noticias/" + post.slug} className="group bg-white rounded-xl border border-gray-100 overflow-hidden hover:shadow-md transition-shadow">
                  <div className="aspect-video bg-gray-100 overflow-hidden">
                    {post.featured_image ? (
                      <img src={post.featured_image} alt={post.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                    ) : (
                      <div className="w-full h-full bg-[#1A2B4A]/10 flex items-center justify-center font-bold text-gray-300 text-2xl">PM</div>
                    )}
                  </div>
                  <div className="p-4">
                    <div className="flex items-center gap-2 mb-1">
                      {post.category && <span className="text-xs font-bold text-[#C9A84C] uppercase">{post.category}</span>}
                      {post.region && <span className="text-xs text-gray-400">· {post.region}</span>}
                      {post.is_exclusive && <span className="text-xs bg-[#1A2B4A] text-white px-1.5 py-0.5 rounded font-bold">EXCLUSIVO</span>}
                    </div>
                    <h3 className="font-semibold text-gray-900 group-hover:text-[#1A2B4A] line-clamp-2 leading-tight">
                      {post.title}
                    </h3>
                    {post.excerpt && <p className="text-sm text-gray-500 mt-1 line-clamp-2">{post.excerpt}</p>}
                    {post.published_at && (
                      <p className="text-xs text-gray-400 mt-2">
                        {format(new Date(post.published_at), "d 'de' MMMM", { locale: ptBR })}
                      </p>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </section>

          {/* Últimas notícias lista */}
          {ultimasNoticias.length > 0 && (
            <section>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-1 h-6 bg-[#C9A84C] rounded" />
                <h2 className="text-lg font-bold text-[#1A2B4A] uppercase tracking-wide">Mais Notícias</h2>
              </div>
              <div className="space-y-3">
                {ultimasNoticias.map((post, i) => (
                  <Link key={post.id} href={"/noticias/" + post.slug} className="group flex gap-4 bg-white rounded-lg border border-gray-100 p-3 hover:shadow-md transition-shadow">
                    <span className="text-2xl font-black text-gray-100 w-8 flex-shrink-0 leading-none mt-1">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <div className="flex-1">
                      {post.category && <span className="text-xs font-bold text-[#C9A84C] uppercase">{post.category}</span>}
                      <h3 className="font-semibold text-gray-900 group-hover:text-[#1A2B4A] transition-colors line-clamp-2 text-sm mt-0.5">
                        {post.title}
                      </h3>
                    </div>
                    {post.featured_image && (
                      <div className="w-16 h-16 flex-shrink-0 rounded-md overflow-hidden">
                        <img src={post.featured_image} alt={post.title} className="w-full h-full object-cover" />
                      </div>
                    )}
                  </Link>
                ))}
              </div>
            </section>
          )}
        </div>

        {/* SIDEBAR */}
        <aside className="space-y-6">

          {/* Mais lidas */}
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <div className="bg-[#1A2B4A] px-4 py-3 flex items-center gap-2">
              <div className="w-1 h-5 bg-[#C9A84C] rounded" />
              <h3 className="text-white font-bold text-sm uppercase tracking-wide">Mais Lidas</h3>
            </div>
            <div className="divide-y divide-gray-50">
              {maisLidas.map((post, i) => (
                <Link key={post.id} href={"/noticias/" + post.slug} className="group flex gap-3 p-3 hover:bg-gray-50 transition-colors">
                  <span className="text-2xl font-black text-gray-100 w-6 flex-shrink-0 leading-none">
                    {i + 1}
                  </span>
                  <div>
                    {post.category && <span className="text-xs font-bold text-[#C9A84C] uppercase">{post.category}</span>}
                    <h4 className="text-sm font-medium text-gray-800 group-hover:text-[#1A2B4A] line-clamp-2 leading-tight mt-0.5">
                      {post.title}
                    </h4>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          {/* Banner newsletter */}
          <div className="bg-[#1A2B4A] rounded-xl p-5 text-white">
            <h3 className="font-bold text-lg mb-1">Newsletter</h3>
            <p className="text-blue-200 text-sm mb-4">Receba as principais notícias industriais toda semana.</p>
            <input
              type="email"
              placeholder="seu@email.com"
              className="w-full px-3 py-2 rounded-lg text-gray-900 text-sm mb-2 focus:outline-none"
            />
            <button className="w-full bg-[#C9A84C] text-white font-bold py-2 rounded-lg hover:bg-[#b8973e] transition-colors text-sm">
              Inscrever-se
            </button>
          </div>

          {/* Banner assinar */}
          <div className="bg-gradient-to-br from-[#C9A84C] to-[#b8973e] rounded-xl p-5 text-white">
            <h3 className="font-bold text-lg mb-1">Seja Assinante</h3>
            <p className="text-white/80 text-sm mb-4">Acesse conteúdos exclusivos do setor metalmecânico.</p>
            <div className="text-2xl font-black mb-1">R$ 290<span className="text-sm font-normal">/mês</span></div>
            <Link href="/assinatura" className="block w-full bg-[#1A2B4A] text-white font-bold py-2 rounded-lg hover:bg-[#0f1e35] transition-colors text-sm text-center mt-3">
              Assinar agora
            </Link>
          </div>

          {/* Canais regionais */}
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <div className="bg-[#1A2B4A] px-4 py-3 flex items-center gap-2">
              <div className="w-1 h-5 bg-[#C9A84C] rounded" />
              <h3 className="text-white font-bold text-sm uppercase tracking-wide">Canais Regionais</h3>
            </div>
            <div className="p-3 space-y-2">
              {[
                { label: "Espírito Santo", href: "/noticias/es", flag: "🏭" },
                { label: "Minas Gerais", href: "/noticias/mg", flag: "⚙️" },
                { label: "Brasil Industrial", href: "/noticias/brasil", flag: "🇧🇷" },
              ].map((canal) => (
                <Link key={canal.href} href={canal.href} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 transition-colors group">
                  <span className="text-lg">{canal.flag}</span>
                  <span className="text-sm font-medium text-gray-700 group-hover:text-[#1A2B4A]">{canal.label}</span>
                </Link>
              ))}
            </div>
          </div>

        </aside>
      </div>
    </div>
    </>
  );
}