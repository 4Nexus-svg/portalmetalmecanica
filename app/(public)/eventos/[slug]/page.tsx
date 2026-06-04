import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArrowLeft, Calendar, MapPin, Building2 } from "lucide-react";
import { EVENTOS_FILTROS, CHIPS_FILTRO, TIPO_LABELS, TIPO_CORES, type TipoEvento } from "@/lib/eventos-filtros";
import { EventCard } from "@/components/eventos/EventCard";
import type { Database } from "@/types/database";

type Event = Database["public"]["Tables"]["events"]["Row"];

interface Props {
  params: Promise<{ slug: string }>;
}

export const revalidate = 60;

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const filtro = EVENTOS_FILTROS[slug];
  if (filtro) return { title: `${filtro.label} | Portal Metalmecânica`, description: filtro.descricao };

  const supabase = await createClient();
  const { data } = await supabase.from("events").select("title, description").eq("slug", slug).maybeSingle() as { data: { title: string; description: string | null } | null; error: unknown };
  if (!data) return {};
  return { title: `${data.title} | Portal Metalmecânica`, description: data.description ?? undefined };
}

// ─── Página de filtro ─────────────────────────────────────────────────────────
async function FiltroPage({ slug }: { slug: string }) {
  const filtro = EVENTOS_FILTROS[slug];
  const supabase = await createClient();
  const hoje = new Date().toISOString().split("T")[0];

  let query = supabase.from("events").select("*").gte("date_start", hoje).order("date_start", { ascending: true }).limit(48);

  if (filtro.tipo)  query = query.eq("type", filtro.tipo);
  if (filtro.state) query = query.eq("state", filtro.state);

  const { data: eventos } = await query as { data: Event[] | null; error: unknown };

  return (
    <main className="max-w-7xl mx-auto px-4 py-10">
      <div className="border-l-4 border-[#C9A84C] pl-4 mb-8">
        <h1 className="text-3xl font-bold text-[#1A2B4A]">{filtro.label}</h1>
        <p className="text-gray-500 mt-1">{filtro.descricao}</p>
      </div>

      <div className="flex gap-2 flex-wrap mb-8">
        {CHIPS_FILTRO.map((f) => (
          <Link
            key={f.href}
            href={f.href}
            className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-colors
              ${f.href === `/eventos/${slug}`
                ? "bg-[#1A2B4A] text-white border-[#1A2B4A]"
                : "border-gray-200 text-gray-600 hover:border-[#1A2B4A] hover:text-[#1A2B4A]"}`}
          >
            {f.label}
          </Link>
        ))}
      </div>

      {!eventos?.length ? (
        <div className="text-center py-20">
          <Calendar size={48} className="mx-auto text-gray-200 mb-4" />
          <p className="text-gray-400 text-lg font-medium">Nenhum evento agendado</p>
          <p className="text-gray-400 text-sm mt-2">Os próximos eventos aparecerão aqui automaticamente.</p>
          <Link href="/eventos" className="mt-6 inline-block text-sm text-[#1A2B4A] underline">Ver todos os eventos</Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {eventos.map((ev) => <EventCard key={ev.id} evento={ev} />)}
        </div>
      )}
    </main>
  );
}

function isValidImageUrl(url: string): boolean {
  if (/[\s\\]/.test(url)) return false;
  try {
    const u = new URL(url);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

// ─── Página individual do evento ──────────────────────────────────────────────
async function EventoPage({ evento }: { evento: Event }) {
  const tipo = evento.type as TipoEvento;
  const corBadge = TIPO_CORES[tipo] ?? "bg-gray-100 text-gray-600";
  const labelTipo = TIPO_LABELS[tipo] ?? tipo;

  return (
    <main className="max-w-4xl mx-auto px-4 py-10">
      <Link href="/eventos" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-[#1A2B4A] mb-8 transition-colors">
        <ArrowLeft size={16} /> Voltar aos eventos
      </Link>

      {/* Imagem */}
      {evento.image_url && isValidImageUrl(evento.image_url) ? (
        <div className="aspect-video rounded-xl overflow-hidden mb-8">
          <img src={evento.image_url} alt={evento.title} className="w-full h-full object-cover" />
        </div>
      ) : (
        <div className="aspect-video rounded-xl bg-gradient-to-br from-[#1A2B4A] to-[#0f1e35] flex items-center justify-center mb-8">
          <Calendar size={64} className="text-[#C9A84C] opacity-40" />
        </div>
      )}

      {/* Badges */}
      <div className="flex items-center gap-2 mb-4">
        <span className={`text-xs font-semibold px-3 py-1 rounded-full ${corBadge}`}>{labelTipo}</span>
        {evento.state && (
          <span className="text-xs font-semibold bg-gray-100 text-gray-500 px-3 py-1 rounded-full">{evento.state}</span>
        )}
        {evento.is_auto && (
          <span className="text-xs font-semibold bg-yellow-50 text-yellow-600 px-3 py-1 rounded-full">Auto</span>
        )}
      </div>

      <h1 className="text-3xl font-bold text-gray-900 mb-6">{evento.title}</h1>

      {/* Detalhes */}
      <div className="bg-white rounded-xl border border-gray-100 p-5 mb-6 space-y-3">
        <div className="flex items-start gap-3">
          <Calendar size={18} className="text-[#C9A84C] mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-gray-700">Data</p>
            <p className="text-sm text-gray-600">
              {format(new Date(evento.date_start + "T12:00:00"), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
              {evento.date_end && evento.date_end !== evento.date_start && (
                <> até {format(new Date(evento.date_end + "T12:00:00"), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}</>
              )}
            </p>
          </div>
        </div>

        {(evento.city || evento.state) && (
          <div className="flex items-start gap-3">
            <MapPin size={18} className="text-[#C9A84C] mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-gray-700">Local</p>
              <p className="text-sm text-gray-600">{[evento.city, evento.state].filter(Boolean).join(", ")}</p>
            </div>
          </div>
        )}

        {evento.organizer && (
          <div className="flex items-start gap-3">
            <Building2 size={18} className="text-[#C9A84C] mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-gray-700">Organização</p>
              <p className="text-sm text-gray-600">{evento.organizer}</p>
            </div>
          </div>
        )}
      </div>

      {/* Descrição */}
      {evento.description && (
        <div className="prose prose-lg max-w-none">
          <p className="text-gray-700 leading-relaxed">{evento.description}</p>
        </div>
      )}
    </main>
  );
}

// ─── Entry point ──────────────────────────────────────────────────────────────
export default async function EventoSlugPage({ params }: Props) {
  const { slug } = await params;

  // 1. Verifica se é um filtro conhecido
  if (EVENTOS_FILTROS[slug]) return <FiltroPage slug={slug} />;

  // 2. Busca evento individual
  const supabase = await createClient();
  const { data: evento } = await supabase
    .from("events")
    .select("*")
    .eq("slug", slug)
    .maybeSingle() as { data: Event | null; error: unknown };

  if (!evento) notFound();

  return <EventoPage evento={evento} />;
}
