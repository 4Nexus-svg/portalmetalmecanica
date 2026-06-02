import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArrowLeft } from "lucide-react";

interface Props {
  params: Promise<{ slug: string }>;
}

export const revalidate = 300;

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from("posts").select("title, excerpt, featured_image").eq("slug", slug).single();
  if (!data) return {};
  return {
    title: data.title,
    description: data.excerpt,
    openGraph: { images: data.featured_image ? [data.featured_image] : [] },
  };
}

export default async function PostPage({ params }: Props) {
  const { slug } = await params;
  const supabase = await createClient();

  const { data: post } = await supabase
    .from("posts")
    .select("*")
    .eq("slug", slug)
    .not("published_at", "is", null)
    .single();

  if (!post) notFound();

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

  return (
    <article className="max-w-3xl mx-auto px-4 py-10">

      {/* Voltar */}
      <Link href="/" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-blue-900 transition-colors mb-8">
        <ArrowLeft size={16} />
        Voltar para o início
      </Link>

      {/* Categoria e região */}
      <div className="flex items-center gap-3 mb-4">
        {post.category && (
          <span className="bg-orange-100 text-orange-700 text-xs font-semibold px-3 py-1 rounded-full">
            {post.category}
          </span>
        )}
        {post.region && (
          <span className="bg-gray-100 text-gray-600 text-xs font-semibold px-3 py-1 rounded-full">
            {post.region}
          </span>
        )}
        {post.is_exclusive && (
          <span className="bg-blue-900 text-white text-xs font-semibold px-3 py-1 rounded-full">
            EXCLUSIVO
          </span>
        )}
      </div>

      {/* Título */}
      <h1 className="text-3xl md:text-4xl font-bold text-gray-900 leading-tight mb-4">
        {post.title}
      </h1>

      {/* Data */}
      {post.published_at && (
        <time className="text-sm text-gray-500 block mb-8">
          {format(new Date(post.published_at), "d 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR })}
        </time>
      )}

      {/* Imagem destaque */}
      {post.featured_image && (
        <div className="relative aspect-video rounded-xl overflow-hidden mb-8">
          <Image src={post.featured_image} alt={post.title} fill className="object-cover" priority />
        </div>
      )}

      {/* Conteúdo ou Paywall */}
      {hasAccess ? (
        <div
          className="prose prose-lg max-w-none prose-headings:text-gray-900 prose-a:text-blue-700"
          dangerouslySetInnerHTML={{ __html: post.content ?? "<p>Conteúdo em breve.</p>" }}
        />
      ) : (
        <div>
          <div className="prose prose-lg max-w-none text-gray-500 line-clamp-3">
            <p>{post.excerpt}</p>
          </div>

          {/* Blur effect */}
          <div className="relative mt-4">
            <div className="prose prose-lg max-w-none blur-sm select-none pointer-events-none text-gray-400">
              <p>Lorem ipsum dolor sit amet consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam quis nostrud exercitation.</p>
              <p>Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur excepteur sint occaecat cupidatat non proident.</p>
            </div>
            <div className="absolute inset-0 bg-gradient-to-b from-transparent to-white" />
          </div>

          {/* Paywall box */}
          <div className="mt-8 rounded-2xl border-2 border-blue-900/20 bg-blue-50 p-8 text-center">
            <div className="w-12 h-12 bg-blue-900 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-white text-xl">🔒</span>
            </div>
            <h3 className="text-xl font-bold text-blue-900 mb-2">
              Conteúdo exclusivo para assinantes
            </h3>
            <p className="text-gray-600 mb-6">
              Acesse este e todos os conteúdos exclusivos por apenas <strong>R$ 290/mês</strong>.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link href="/assinatura" className="bg-orange-500 text-white font-semibold px-6 py-3 rounded-lg hover:bg-orange-600 transition-colors">
                Ver planos
              </Link>
              <Link href="/login" className="border-2 border-blue-900 text-blue-900 font-semibold px-6 py-3 rounded-lg hover:bg-blue-900 hover:text-white transition-colors">
                Já sou assinante
              </Link>
            </div>
          </div>
        </div>
      )}
    </article>
  );
}