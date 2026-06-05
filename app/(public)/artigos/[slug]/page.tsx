import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { sanitizeContent } from "@/lib/sanitize";
import type { Database } from "@/types/database";

type Artigo = Database["public"]["Tables"]["articles"]["Row"];
type Colunista = Database["public"]["Tables"]["columnists"]["Row"];

type Props = { params: Promise<{ slug: string }> };

export const revalidate = 300;

export default async function ArtigoPage({ params }: Props) {
  const { slug } = await params;
  const supabase = await createClient();

  const { data: artigo } = await supabase
    .from("articles").select("*").eq("slug", slug).not("published_at", "is", null).maybeSingle() as { data: Artigo | null; error: unknown };

  if (!artigo) notFound();

  const { data: colunista } = await supabase
    .from("columnists").select("*").eq("id", artigo.columnist_id).maybeSingle() as { data: Colunista | null; error: unknown };

  return (
    <main className="max-w-3xl mx-auto px-4 py-10">
      {colunista && (
        <Link href={"/colunistas/" + colunista.slug} className="inline-flex items-center gap-2 text-sm text-[#C9A84C] font-semibold mb-3">
          {colunista.nome}
        </Link>
      )}
      <h1 className="text-3xl font-bold text-[#1A2B4A] leading-tight">{artigo.title}</h1>
      {artigo.published_at && (
        <p className="text-sm text-gray-400 mt-2">
          {format(new Date(artigo.published_at), "d 'de' MMMM 'de' yyyy", { locale: ptBR })}
        </p>
      )}
      {artigo.cover_url && (
        <img src={artigo.cover_url} alt={artigo.title} className="w-full rounded-xl mt-6 object-cover" />
      )}
      {artigo.content && (
        <article
          className="prose prose-lg max-w-none mt-8"
          dangerouslySetInnerHTML={{ __html: sanitizeContent(artigo.content) }}
        />
      )}
    </main>
  );
}
