/**
 * Aviso temporário de manutenção: o Supabase bloqueou o projeto por cota de
 * egress do plano Free até a virada do ciclo (02/11/2026). Some sozinho a
 * partir de 03/11 00:00 (SP) — depois disso, apagar este componente e o uso
 * em app/layout.tsx.
 */
const FIM_AVISO = new Date("2026-11-03T00:00:00-03:00");

export default function AvisoManutencao() {
  if (new Date() >= FIM_AVISO) return null;

  return (
    <div role="status" className="max-w-7xl mx-auto px-4 w-full mb-4">
      <div className="rounded-xl border border-[#C9A84C]/40 bg-[#C9A84C]/10 px-5 py-4 text-[#1A2B4A]">
        <p className="font-semibold">Site em manutenção</p>
        <p className="text-sm mt-1">
          Estamos realizando uma manutenção programada e as notícias estão temporariamente indisponíveis.
          O portal retorna à normalidade no dia <strong>02/11</strong>. Obrigado pela compreensão!
        </p>
      </div>
    </div>
  );
}
