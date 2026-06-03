import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArrowLeft, MapPin, Phone, MessageCircle, Tag, Calendar } from "lucide-react";

interface Props {
  params: Promise<{ id: string }>;
}

export const revalidate = 60;

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from("classifieds")
    .select("title, description, photos")
    .eq("id", Number(id))
    .eq("status", "active")
    .single();
  if (!data) return {};
  return {
    title: `${data.title} — Classificados | Portal Metalmecânica`,
    description: data.description ?? undefined,
    openGraph: { images: data.photos?.[0] ? [data.photos[0]] : [] },
  };
}

function formatWhatsApp(numero: string): string {
  return numero.replace(/\D/g, "");
}

export default async function ClassificadoPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();

  const { data } = await supabase
    .from("classifieds")
    .select("id, title, description, price, city, state, category, photos, phone, whatsapp, created_at, expires_at")
    .eq("id", Number(id))
    .eq("status", "active")
    .single();

  if (!data) notFound();

  const fotos = data.photos ?? [];
  const temContato = data.phone || data.whatsapp;

  return (
    <main className="max-w-5xl mx-auto px-4 py-10">
      <Link
        href="/classificados"
        className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-blue-900 mb-8 transition-colors"
      >
        <ArrowLeft size={16} /> Voltar aos classificados
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

        {/* Coluna principal */}
        <div className="lg:col-span-2 space-y-6">

          {/* Galeria de fotos */}
          {fotos.length > 0 ? (
            <div className="space-y-2">
              <div className="aspect-video rounded-xl overflow-hidden bg-gray-100">
                <img
                  src={fotos[0]}
                  alt={data.title}
                  className="w-full h-full object-cover"
                />
              </div>
              {fotos.length > 1 && (
                <div className="grid grid-cols-4 gap-2">
                  {fotos.slice(1).map((foto, i) => (
                    <div key={i} className="aspect-square rounded-lg overflow-hidden bg-gray-100">
                      <img src={foto} alt="" className="w-full h-full object-cover" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="aspect-video rounded-xl bg-gray-100 flex items-center justify-center">
              <span className="text-5xl font-bold text-gray-200">PM</span>
            </div>
          )}

          {/* Título e preço */}
          <div>
            {data.category && (
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-orange-500 uppercase tracking-wide mb-2">
                <Tag size={12} />
                {data.category}
              </span>
            )}
            <h1 className="text-2xl font-bold text-gray-900">{data.title}</h1>
            <div className="flex items-center gap-4 mt-3 flex-wrap">
              {data.price != null ? (
                <span className="text-2xl font-bold text-blue-900">
                  {data.price.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                </span>
              ) : (
                <span className="text-lg text-gray-400">Preço a consultar</span>
              )}
              {(data.city || data.state) && (
                <span className="inline-flex items-center gap-1 text-sm text-gray-500">
                  <MapPin size={14} />
                  {[data.city, data.state].filter(Boolean).join(" — ")}
                </span>
              )}
            </div>
          </div>

          {/* Descrição */}
          {data.description && (
            <div className="bg-white rounded-xl border border-gray-100 p-5">
              <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">Descrição</h2>
              <p className="text-gray-700 leading-relaxed whitespace-pre-line">{data.description}</p>
            </div>
          )}

          {/* Detalhes */}
          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">Detalhes do anúncio</h2>
            <dl className="space-y-2 text-sm">
              {data.category && (
                <div className="flex gap-2">
                  <dt className="text-gray-400 w-28 shrink-0">Categoria</dt>
                  <dd className="text-gray-700 font-medium">{data.category}</dd>
                </div>
              )}
              {(data.city || data.state) && (
                <div className="flex gap-2">
                  <dt className="text-gray-400 w-28 shrink-0">Localização</dt>
                  <dd className="text-gray-700 font-medium">{[data.city, data.state].filter(Boolean).join(" — ")}</dd>
                </div>
              )}
              <div className="flex gap-2">
                <dt className="text-gray-400 w-28 shrink-0">Publicado em</dt>
                <dd className="text-gray-700 font-medium">
                  {format(new Date(data.created_at), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                </dd>
              </div>
              {data.expires_at && (
                <div className="flex gap-2">
                  <dt className="text-gray-400 w-28 shrink-0">Válido até</dt>
                  <dd className="text-gray-700 font-medium">
                    {format(new Date(data.expires_at), "dd/MM/yyyy", { locale: ptBR })}
                  </dd>
                </div>
              )}
            </dl>
          </div>
        </div>

        {/* Sidebar de contato */}
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-100 p-5 sticky top-6">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4">
              Fale com o anunciante
            </h2>

            {temContato ? (
              <div className="space-y-3">
                {data.whatsapp && (
                  <a
                    href={`https://wa.me/55${formatWhatsApp(data.whatsapp)}?text=${encodeURIComponent(`Olá! Vi seu anúncio "${data.title}" no Portal Metalmecânica e tenho interesse.`)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 w-full bg-green-500 hover:bg-green-600 text-white font-semibold py-3 rounded-lg transition-colors"
                  >
                    <MessageCircle size={18} />
                    Chamar no WhatsApp
                  </a>
                )}
                {data.phone && (
                  <a
                    href={`tel:${data.phone.replace(/\D/g, "")}`}
                    className="flex items-center justify-center gap-2 w-full border-2 border-blue-900 text-blue-900 hover:bg-blue-900 hover:text-white font-semibold py-3 rounded-lg transition-colors"
                  >
                    <Phone size={18} />
                    {data.phone}
                  </a>
                )}
              </div>
            ) : (
              <p className="text-sm text-gray-400 text-center py-4">
                O anunciante não informou contato.
              </p>
            )}

            <div className="mt-4 pt-4 border-t border-gray-100 flex items-center gap-2 text-xs text-gray-400">
              <Calendar size={12} />
              Anúncio #{data.id} · publicado em{" "}
              {format(new Date(data.created_at), "dd/MM/yyyy", { locale: ptBR })}
            </div>
          </div>

          <Link
            href="/classificados/novo"
            className="flex items-center justify-center w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold py-3 rounded-lg transition-colors text-sm"
          >
            + Publicar meu anúncio
          </Link>
        </div>

      </div>
    </main>
  );
}
