"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { DndContext, closestCenter, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, useSortable, arrayMove, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { salvarLayout } from "./actions";
import type { Database } from "@/types/database";

type Bloco = Database["public"]["Tables"]["home_blocks"]["Row"];
type Coluna = "full" | "main" | "sidebar";

const TITULOS: Record<Coluna, string> = {
  full: "Largura total (topo)",
  main: "Coluna principal",
  sidebar: "Barra lateral",
};

function Item({ bloco, onToggle }: { bloco: Bloco; onToggle: (id: number) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: bloco.id });
  const style = { transform: CSS.Transform.toString(transform), transition };
  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-3 bg-white border border-gray-100 rounded-lg px-3 py-2">
      <button {...attributes} {...listeners} className="cursor-grab text-gray-400 hover:text-gray-600" aria-label="Arrastar">
        <GripVertical className="w-4 h-4" />
      </button>
      <span className={`flex-1 text-sm ${bloco.ativo ? "text-gray-800" : "text-gray-400 line-through"}`}>{bloco.label}</span>
      <label className="flex items-center gap-1.5 text-xs text-gray-500">
        <input type="checkbox" checked={bloco.ativo} onChange={() => onToggle(bloco.id)} />
        Ativo
      </label>
    </div>
  );
}

function Lista({ coluna, blocos, setBlocos }: { coluna: Coluna; blocos: Bloco[]; setBlocos: (fn: (prev: Bloco[]) => Bloco[]) => void }) {
  const doColuna = blocos.filter((b) => b.coluna === coluna).sort((a, b) => a.ordem - b.ordem);

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const ids = doColuna.map((b) => b.id);
    const from = ids.indexOf(Number(active.id));
    const to = ids.indexOf(Number(over.id));
    const reordenados = arrayMove(doColuna, from, to);
    setBlocos((prev) => prev.map((b) => {
      const idx = reordenados.findIndex((r) => r.id === b.id);
      return idx >= 0 ? { ...b, ordem: idx } : b;
    }));
  }

  function toggle(id: number) {
    setBlocos((prev) => prev.map((b) => (b.id === id ? { ...b, ativo: !b.ativo } : b)));
  }

  return (
    <div className="bg-gray-50 rounded-xl p-4">
      <h3 className="text-sm font-bold text-[#1A2B4A] mb-3">{TITULOS[coluna]}</h3>
      <DndContext collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={doColuna.map((b) => b.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {doColuna.map((b) => <Item key={b.id} bloco={b} onToggle={toggle} />)}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}

export default function HomeBuilderClient({ inicial }: { inicial: Bloco[] }) {
  const router = useRouter();
  const [blocos, setBlocos] = useState<Bloco[]>(inicial);
  const [salvando, setSalvando] = useState(false);

  async function salvar() {
    setSalvando(true);
    try {
      await salvarLayout(blocos.map((b) => ({ id: b.id, ordem: b.ordem, ativo: b.ativo })));
      toast.success("Layout salvo");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {(["full", "main", "sidebar"] as Coluna[]).map((col) => (
          <Lista key={col} coluna={col} blocos={blocos} setBlocos={setBlocos} />
        ))}
      </div>
      <button onClick={salvar} disabled={salvando} className="bg-[#1A2B4A] text-white font-semibold px-6 py-2.5 rounded-lg hover:bg-[#0f1e35] disabled:opacity-50">
        {salvando ? "Salvando..." : "Salvar layout"}
      </button>
    </div>
  );
}
