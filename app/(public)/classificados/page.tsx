import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export const revalidate = 60;

export default async function ClassificadosPage() {
  const supabase = await createClient();

  const { data: classificados } = await supabase
    .from("classifieds")
    .select("id, title, description, price, city, state, category, created_at, photos")
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(48);

  const categorias = ["Todos", "Máquinas", "Equipamentos", "Peças", "Serviços", "Veículos", "Outros"];

  return (
    <main className="max-w-7xl mx-auto px-4 py-10">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Classificados</h1>
          <p className="text-sm text-gray-500 mt-1">
            {classificados?.length ?? 0} anúncios ativos
          </p>
        </div>
        <Link
          href="/classificados/novo"
          className="bg-orange-500 text-white font-semibold px-5 py-2.5 rounded-lg hover:bg-orange-600 transition-colors"
        >
          + Anunciar
        </Link>
      </div>

      {/* Filtros por categoria */}
      <div className="flex gap-2 flex-wrap mb-8">
        {categorias.map((cat) => (
          <button
            key={cat}
            className="px-4 py-1.5 rounded-full text-sm font-medium border border-gray-200 text-gray-600 hover:border-blue-900 hover:text-blue-900 transition-colors"
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Grid de anúncios */}
      {(!classificados || classificados.length === 0) ? (
        <div className="text-center py-20 text-gray-400">
          <p className="text-lg font-medium mb-2">Nenhum anúncio ativo</p>
          <p className="text-sm mb-6">Seja o primeiro a anunciar!</p>
          <Link href="/classificados/novo" className="bg-orange-500 text-white font-semibold px-6 py-3 rounded-lg hover:bg-orange-600 transition-colors">
            Publicar anúncio
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {classificados.map((item) => (
            <Link
              key={item.id}
              href={"/classificados/" + item.id}
              className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden group hover:shadow-md transition-shadow"
            >
              {/* Foto ou placeholder */}
              <div className="aspect-video bg-gray-100 flex items-center justify-center overflow-hidden">
                {item.photos?.[0] ? (
                  <img src={item.photos[0]} alt={item.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                ) : (
                  <div className="text-gray-300 text-4xl font-bold">PM</div>
                )}
              </div>

              <div className="p-4">
                {item.category && (
                  <span className="text-xs font-semibold text-orange-500 uppercase tracking-wide">
                    {item.category}
                  </span>
                )}
                <h3 className="font-semibold text-gray-900 mt-1 line-clamp-2 group-hover:text-blue-900 transition-colors">
                  {item.title}
                </h3>
                {item.description && (
                  <p className="text-sm text-gray-500 mt-1 line-clamp-2">{item.description}</p>
                )}
                <div className="flex items-center justify-between mt-3">
                  {item.price ? (
                    <span className="font-bold text-blue-900">
                      {item.price.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                    </span>
                  ) : (
                    <span className="text-sm text-gray-400">A consultar</span>
                  )}
                  {(item.city || item.state) && (
                    <span className="text-xs text-gray-400">
                      {[item.city, item.state].filter(Boolean).join(" - ")}
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-400 mt-2">
                  {format(new Date(item.created_at), "dd/MM/yyyy", { locale: ptBR })}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}