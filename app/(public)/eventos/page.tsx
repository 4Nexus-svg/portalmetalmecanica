import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Calendar } from "lucide-react";
import { CHIPS_FILTRO } from "@/lib/eventos-filtros";
import { EventCard } from "@/components/eventos/EventCard";
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
            <EventCard key={ev.id} evento={ev} />
          ))}
        </div>
      )}
    </main>
  );
}
