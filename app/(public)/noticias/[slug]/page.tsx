import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArrowLeft } from "lucide-react";
import { NOTICIAS_FILTROS } from "@/lib/noticias-filtros";
import { sanitizeContent } from "@/lib/sanitize";
import type { Database } from "@/types/database";

type Post = Database["public"]["Tables"]["posts"]["Row"];

interface Props {
  params: Promise<{ slug: string }>;
}

export const revalidate = 300;

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const supabase = await createClient();

  const { data: post } = await supabase
    .from("posts")
    .select("*")
    .eq("slug", slug)
    .maybeSingle() as { data: Post | null; error: unknown };

  if (post) {
    return {
      title: post.title,
      description: post.excerpt,
      openGraph: { images: post.featured_image ? [post.featured_image] : [] },
    };
  }

  const filtro = NOTICIAS_FILTROS[slug];
  if (filtro) {
    return {
      title: `${filtro.label} | Portal Metalmecânica`,
      description: filtro.descricao,
    };
  }

  return {};
}

// ─── Página de post individual ────────────────────────────────────────────────

async function PostPage({ post }: { post: Awaited<ReturnType<typeof buscarPost>> }) {
  if (!post) return null;
  return (
    <article className="max-w-3xl mx-auto px-4 py-10">
      <Link href="/noticias" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-blue-900 transition-colors mb-8">
        <ArrowLeft size={16} /> Voltar às notícias
      </Link>

      <div className="flex items-center gap-3 mb-4">
        {post.category && (
          <span className="bg-orange-100 text-orange-700 text-xs font-semibold px-3 py-1 rounded-full">{post.category}</span>
        )}
        {post.region && (
          <span className="bg-gray-100 text-gray-600 text-xs font-semibold px-3 py-1 rounded-full">{post.region}</span>
        )}
        {post.is_exclusive && (
          <span className="bg-blue-900 text-white text-xs font-semibold px-3 py-1 rounded-full">EXCLUSIVO</span>
        )}
      </div>

      <h1 className="text-3xl md:text-4xl font-bold text-gray-900 leading-tight mb-4">{post.title}</h1>

      {post.published_at && (
        <time className="text-sm text-gray-500 block mb-8">
          {format(new Date(post.published_at), "d 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR })}
        </time>
      )}

      {post.featured_image && (
        <div className="relative aspect-video rounded-xl overflow-hidden mb-8">
          <Image src={post.featured_image} alt={post.title} fill className="object-cover" priority />
        </div>
      )}

      {post.hasAccess ? (
        <>
          <div
            className="prose prose-lg max-w-none prose-headings:text-gray-900 prose-a:text-blue-700"
            dangerouslySetInnerHTML={{ __html: sanitizeContent(post.content ?? "<p>Conteúdo em breve.</p>") }}
          />

          {/* Fonte da notícia */}
          {post.fonte_url && (
            <div className="mt-10 pt-6 border-t border-gray-100">
              <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold mb-2">Fonte original</p>
              <a
                href={post.fonte_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm font-medium text-[#1A2B4A] hover:text-[#C9A84C] transition-colors"
              >
                <span className="w-6 h-6 rounded-full bg-[#1A2B4A]/10 flex items-center justify-center text-xs font-bold text-[#1A2B4A]">
                  {(post.fonte_nome ?? 'F')[0].toUpperCase()}
                </span>
                {post.fonte_nome ?? post.fonte_url}
                <svg className="w-3.5 h-3.5 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
              </a>
            </div>
          )}
        </>
      ) : (
        <div>
          <div className="prose prose-lg max-w-none text-gray-500 line-clamp-3">
            <p>{post.excerpt}</p>
          </div>
          <div className="relative mt-4">
            <div className="prose prose-lg max-w-none blur-sm select-none pointer-events-none text-gray-400">
              <p>Lorem ipsum dolor sit amet consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.</p>
              <p>Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.</p>
            </div>
            <div className="absolute inset-0 bg-gradient-to-b from-transparent to-white" />
          </div>
          <div className="mt-8 rounded-2xl border-2 border-blue-900/20 bg-blue-50 p-8 text-center">
            <div className="w-12 h-12 bg-blue-900 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-white text-xl">🔒</span>
            </div>
            <h3 className="text-xl font-bold text-blue-900 mb-2">Conteúdo exclusivo para assinantes</h3>
            <p className="text-gray-600 mb-6">Acesse este e todos os conteúdos exclusivos por apenas <strong>R$ 290/mês</strong>.</p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link href="/assinatura" className="bg-orange-500 text-white font-semibold px-6 py-3 rounded-lg hover:bg-orange-600 transition-colors">Ver planos</Link>
              <Link href="/login" className="border-2 border-blue-900 text-blue-900 font-semibold px-6 py-3 rounded-lg hover:bg-blue-900 hover:text-white transition-colors">Já sou assinante</Link>
            </div>
          </div>
        </div>
      )}
    </article>
  );
}

// ─── Página de categoria filtrada ─────────────────────────────────────────────

async function CategoriaPage({ slug, filtro }: { slug: string; filtro: typeof NOTICIAS_FILTROS[string] }) {
  const supabase = await createClient();

  const baseQuery = supabase
    .from("posts")
    .select("*")
    .not("published_at", "is", null)
    .order("published_at", { ascending: false })
    .limit(48);

  const { data: posts } = (filtro.tipo === "region"
    ? await baseQuery.eq("region", filtro.valor)
    : await baseQuery.eq("category", filtro.valor)
  ) as { data: Post[] | null; error: unknown };

  const FILTROS = [
    { label: "Todas",           href: "/noticias" },
    { label: "Espírito Santo",  href: "/noticias/es" },
    { label: "Minas Gerais",    href: "/noticias/mg" },
    { label: "Brasil",          href: "/noticias/brasil" },
    { label: "Economia",        href: "/noticias/economia" },
    { label: "Tecnologia",      href: "/noticias/tecnologia" },
    { label: "Sustentabilidade",href: "/noticias/sustentabilidade" },
    { label: "Segurança",       href: "/noticias/seguranca" },
  ];

  return (
    <main className="max-w-7xl mx-auto px-4 py-10">
      <div className="border-l-4 border-[#C9A84C] pl-4 mb-8">
        <h1 className="text-3xl font-bold text-[#1A2B4A]">{filtro.label}</h1>
        <p className="text-gray-500 mt-1">{filtro.descricao}</p>
      </div>

      <div className="flex gap-2 flex-wrap mb-8">
        {FILTROS.map((f) => (
          <Link
            key={f.href}
            href={f.href}
            className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-colors
              ${f.href === `/noticias/${slug}`
                ? "bg-[#1A2B4A] text-white border-[#1A2B4A]"
                : "border-gray-200 text-gray-600 hover:border-[#1A2B4A] hover:text-[#1A2B4A]"}`}
          >
            {f.label}
          </Link>
        ))}
      </div>

      {!posts?.length ? (
        <div className="text-center py-20">
          <p className="text-gray-400 text-lg">Nenhuma notícia nesta categoria ainda.</p>
          <p className="text-gray-400 text-sm mt-2">O pipeline automático publica novas notícias a cada 3 horas.</p>
          <Link href="/noticias" className="mt-6 inline-block text-sm text-[#1A2B4A] underline">Ver todas as notícias</Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {posts.map((post) => (
            <Link
              key={post.id}
              href={`/noticias/${post.slug}`}
              className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden group hover:shadow-md transition-shadow"
            >
              <div className="aspect-video bg-gray-100 overflow-hidden">
                {post.featured_image ? (
                  <img src={post.featured_image} alt={post.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <span className="text-3xl font-bold text-gray-200">PM</span>
                  </div>
                )}
              </div>
              <div className="p-4">
                <div className="flex gap-2 mb-2">
                  {post.category && <span className="text-xs font-semibold text-orange-500 uppercase tracking-wide">{post.category}</span>}
                  {post.region && <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{post.region}</span>}
                </div>
                <h3 className="font-semibold text-gray-900 line-clamp-2 group-hover:text-[#1A2B4A] transition-colors">{post.title}</h3>
                {post.excerpt && <p className="text-sm text-gray-500 mt-1 line-clamp-2">{post.excerpt}</p>}
                {post.published_at && (
                  <p className="text-xs text-gray-400 mt-3">
                    {format(new Date(post.published_at), "dd/MM/yyyy", { locale: ptBR })}
                  </p>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}

// ─── Helper ───────────────────────────────────────────────────────────────────

async function buscarPost(slug: string) {
  const supabase = await createClient();

  const { data: post } = await supabase
    .from("posts")
    .select("*")
    .eq("slug", slug)
    .not("published_at", "is", null)
    .maybeSingle() as { data: Post | null; error: unknown };

  if (!post) return null;

  let hasAccess = !post.is_exclusive;
  if (post.is_exclusive) {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: sub } = await supabase
        .from("subscriptions")
        .select("id")
        .eq("user_id", user.id)
        .eq("status", "active")
        .gte("current_period_end", new Date().toISOString())
        .maybeSingle();
      hasAccess = !!sub;
    }
  }

  return { ...post, hasAccess };
}

// ─── Entry point ──────────────────────────────────────────────────────────────

export default async function SlugPage({ params }: Props) {
  const { slug } = await params;

  // 1. Tenta encontrar o post
  const post = await buscarPost(slug);
  if (post) return <PostPage post={post} />;

  // 2. Verifica se é uma categoria/filtro conhecida
  const filtro = NOTICIAS_FILTROS[slug];
  if (filtro) return <CategoriaPage slug={slug} filtro={filtro} />;

  // 3. 404
  notFound();
}
