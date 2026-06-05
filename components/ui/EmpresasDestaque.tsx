import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

type Destaque = Database["public"]["Tables"]["featured_companies"]["Row"];

export async function EmpresasDestaque({ className }: { className?: string }) {
  const supabase = await createClient();
  const hoje = new Date().toISOString().split("T")[0];

  const { data } = await supabase
    .from("featured_companies")
    .select("id, name, logo_url, link, description")
    .eq("ativo", true)
    .or(`start_date.is.null,start_date.lte.${hoje}`)
    .or(`end_date.is.null,end_date.gte.${hoje}`)
    .order("ordem", { ascending: true })
    .limit(12) as { data: Pick<Destaque, "id" | "name" | "logo_url" | "link" | "description">[] | null; error: unknown };

  if (!data?.length) return null;

  return (
    <section className={className}>
      <div className="flex items-center gap-3 mb-4">
        <div className="w-1 h-6 bg-[#C9A84C] rounded" />
        <h2 className="text-lg font-bold text-[#1A2B4A] uppercase tracking-wide">Empresas em Destaque</h2>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {data.map((e) => (
          <a
            key={e.id}
            href={e.link ?? "#"}
            target={e.link ? "_blank" : undefined}
            rel="noopener noreferrer"
            className="group bg-white rounded-xl border border-gray-100 p-4 flex flex-col items-center text-center hover:border-[#C9A84C] hover:shadow-sm transition-all"
          >
            <div className="h-16 flex items-center justify-center mb-2">
              {e.logo_url
                ? <img src={e.logo_url} alt={e.name} className="max-h-16 object-contain" />
                : <span className="font-bold text-[#1A2B4A]">{e.name}</span>}
            </div>
            <p className="font-semibold text-sm text-[#1A2B4A] group-hover:text-[#C9A84C]">{e.name}</p>
            {e.description && <p className="text-xs text-gray-500 mt-1 line-clamp-2">{e.description}</p>}
          </a>
        ))}
      </div>
    </section>
  );
}
