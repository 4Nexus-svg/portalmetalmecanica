import Link from "next/link";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar, MapPin } from "lucide-react";
import { TIPO_LABELS, TIPO_CORES, type TipoEvento } from "@/lib/eventos-filtros";
import type { Database } from "@/types/database";

type Event = Database["public"]["Tables"]["events"]["Row"];

function isValidUrl(url: string): boolean {
  if (/[\s\\]/.test(url)) return false;
  try {
    const u = new URL(url);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

export function EventCard({ evento }: { evento: Event }) {
  const tipo = evento.type as TipoEvento;
  const corBadge = TIPO_CORES[tipo] ?? "bg-gray-100 text-gray-600";
  const labelTipo = TIPO_LABELS[tipo] ?? tipo;

  return (
    <Link
      href={`/eventos/${evento.slug}`}
      className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden group hover:shadow-md transition-shadow"
    >
      <div className="aspect-video bg-gradient-to-br from-[#1A2B4A] to-[#0f1e35] flex items-center justify-center overflow-hidden">
        {evento.image_url && isValidUrl(evento.image_url) ? (
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
