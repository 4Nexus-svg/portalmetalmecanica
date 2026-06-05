import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import type { Database } from "@/types/database";

type Vaga = Database["public"]["Tables"]["jobs"]["Row"];

type Props = { params: Promise<{ id: string }> };

export const revalidate = 300;

export default async function VagaDetalhePage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: vaga } = await supabase
    .from("jobs").select("*").eq("id", Number(id)).eq("ativo", true).maybeSingle() as { data: Vaga | null; error: unknown };

  if (!vaga) notFound();

  return (
    <main className="max-w-3xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-bold text-[#1A2B4A]">{vaga.title}</h1>
      <p className="text-sm text-gray-500 mt-1">
        {[vaga.company, vaga.city && `${vaga.city}/${vaga.state ?? ""}`, vaga.type].filter(Boolean).join(" · ")}
      </p>
      {vaga.salary && <p className="text-sm font-semibold text-[#1A2B4A] mt-2">Salário: {vaga.salary}</p>}

      {vaga.description && (
        <div className="mt-6 text-gray-700 whitespace-pre-wrap">{vaga.description}</div>
      )}

      <div className="mt-8 bg-gray-50 rounded-xl p-5">
        <h2 className="font-semibold text-[#1A2B4A] mb-2">Como se candidatar</h2>
        {vaga.link && <a href={vaga.link} target="_blank" rel="noopener noreferrer" className="block text-blue-700 hover:underline">Candidatar-se pelo link</a>}
        {vaga.contact_email && <a href={"mailto:" + vaga.contact_email} className="block text-blue-700 hover:underline">{vaga.contact_email}</a>}
        {!vaga.link && !vaga.contact_email && <p className="text-sm text-gray-400">Sem informações de contato.</p>}
      </div>
    </main>
  );
}
