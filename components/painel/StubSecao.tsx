import { Construction } from "lucide-react";
import EmptyState from "./EmptyState";

export default function StubSecao({ fase }: { fase: number }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100">
      <EmptyState
        icon={Construction}
        titulo="Em construção"
        descricao={`Esta seção ganha funcionalidade completa na Fase ${fase} do CMS.`}
      />
    </div>
  );
}
