"use client";

import { useState } from "react";
import type { Database } from "@/types/database";

type Empresa = Database["public"]["Tables"]["companies"]["Row"];

export default function GuiaPublicoClient({ empresas }: { empresas: Empresa[] }) {
  const categorias = Array.from(new Set(empresas.map((e) => e.category).filter(Boolean))) as string[];
  const [cat, setCat] = useState<string>("todas");
  const filtradas = cat === "todas" ? empresas : empresas.filter((e) => e.category === cat);

  return (
    <>
      <div className="flex flex-wrap gap-2 mb-6">
        <button onClick={() => setCat("todas")} className={`px-3 py-1.5 rounded-lg text-sm ${cat === "todas" ? "bg-[#1A2B4A] text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>Todas</button>
        {categorias.map((c) => (
          <button key={c} onClick={() => setCat(c)} className={`px-3 py-1.5 rounded-lg text-sm ${cat === c ? "bg-[#1A2B4A] text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>{c}</button>
        ))}
      </div>

      {filtradas.length === 0 ? (
        <p className="text-gray-400">Nenhuma empresa cadastrada.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtradas.map((e) => (
            <div key={e.id} className="bg-white rounded-xl border border-gray-100 p-5">
              <div className="flex items-center gap-3 mb-3">
                {e.logo_url
                  ? <img src={e.logo_url} alt={e.name} className="h-12 w-12 object-contain" />
                  : <div className="h-12 w-12 rounded bg-[#1A2B4A]/10 flex items-center justify-center font-bold text-[#1A2B4A]">{e.name[0]}</div>}
                <div>
                  <p className="font-semibold text-[#1A2B4A]">{e.name}</p>
                  {e.category && <p className="text-xs text-[#C9A84C] font-semibold">{e.category}</p>}
                </div>
              </div>
              {e.description && <p className="text-sm text-gray-500 line-clamp-3">{e.description}</p>}
              <div className="text-sm text-gray-500 mt-3 space-y-1">
                {(e.city || e.state) && <p>{e.city}{e.state ? "/" + e.state : ""}</p>}
                {e.phone && <p>{e.phone}</p>}
                {e.site && <a href={e.site} target="_blank" rel="noopener noreferrer" className="text-blue-700 hover:underline">Visitar site</a>}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
