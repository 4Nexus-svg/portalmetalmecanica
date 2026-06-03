import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar, MapPin } from "lucide-react";
import { CHIPS_FILTRO, TIPO_LABELS, TIPO_CORES, type TipoEvento } from "@/lib/eventos-filtros";
import type { Database } from "@/types/database";

type Event = Database["public"]["Tables"]["events"]["Row"];

export const revalidate = 60;

export const metadata = {
  title: "Eventos | Portal Metalmecânica",
  description: "Feiras, congressos, seminários e workshops do setor metalmecânico.",
};

export default async function EventosPage() {
  const supabase = await createClient();

  const hoje = new Date().toISOString().split("T")[0];

  const { data: eventos } = await supabase
    .from("events")
    .select("*")
    .gte("date_start", hoje)
    .order("date_start", { ascending: true })
    .limit(48) as { data: Event[] | null; error: unknown };

  return (
    <main className="max-w-7xl mx-auto px-4 py-10">
      <div className="border-l-4 border-[#C9A84C] pl-4 mb-8">
        <h1 className="text-3xl font-bold text-[#1A2B4A]">Eventos</h1>
        <p className="text-gray-500 mt-1">Feiras, congressos, seminários e workshops do setor industrial</p>
      </div>

      {/* Filtros */}
      <div className="flex gap-2 flex-wrap mb-8">
        {CHIPS_FILTRO.map((f) => (
          <Link
            key={f.href}
            href={f.href}
            className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-colors
              ${f.href === "/eventos"
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
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {eventos.map((ev) => (
            <EventCard key={ev.id} evento={ev} activeSlug="" />
          ))}
        </div>
      )}
    </main>
  );
}

export function EventCard({ evento, activeSlug }: { evento: Event; activeSlug: string }) {
  const tipo = evento.type as TipoEvento;
  const corBadge = TIPO_CORES[tipo] ?? "bg-gray-100 text-gray-600";
  const labelTipo = TIPO_LABELS[tipo] ?? tipo;

  return (
    <Link
      href={`/eventos/${evento.slug}`}
      className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden group hover:shadow-md transition-shadow"
    >
      {/* Imagem ou placeholder */}
      <div className="aspect-video bg-gradient-to-br from-[#1A2B4A] to-[#0f1e35] flex items-center justify-center overflow-hidden">
        {evento.image_url ? (
          <img src={evento.image_url} alt={evento.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
        ) : (
          <Calendar size={40} className="text-[#C9A84C] opacity-50" />
        )}
      </div>

      <div className="p-4">
        <div className="flex items-center gap-2 mb-2">
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${corBadge}`}>{labelTipo}</span>
          {evento.state && (
            <span className="text-xs font-semibold bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{evento.state}</span>
          )}
        </div>

        <h3 className="font-semibold text-gray-900 line-clamp-2 group-hover:text-[#1A2B4A] transition-colors">{evento.title}</h3>

        {evento.description && (
          <p className="text-sm text-gray-500 mt-1 line-clamp-2">{evento.description}</p>
        )}

        <div className="mt-3 space-y-1.5">
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <Calendar size={12} className="text-[#C9A84C]" />
            <span>
              {format(new Date(evento.date_start + "T12:00:00"), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
              {evento.date_end && evento.date_end !== evento.date_start && (
                <> — {format(new Date(evento.date_end + "T12:00:00"), "dd 'de' MMMM", { locale: ptBR })}</>
              )}
            </span>
          </div>
          {(evento.city || evento.state) && (
            <div className="flex items-center gap-1.5 text-xs text-gray-500">
              <MapPin size={12} className="text-[#C9A84C]" />
              <span>{[evento.city, evento.state].filter(Boolean).join(", ")}</span>
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}
