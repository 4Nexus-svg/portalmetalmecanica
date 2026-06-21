import Link from "next/link";

const canais = [
  {
    label: "Espírito Santo",
    href: "/noticias/es",
    bandeira: "/bandeiras/es.png",
    alt: "Bandeira do Espírito Santo",
  },
  {
    label: "Minas Gerais",
    href: "/noticias/mg",
    bandeira: "/bandeiras/mg.png",
    alt: "Bandeira de Minas Gerais",
  },
  {
    label: "Brasil Industrial",
    href: "/noticias/brasil",
    bandeira: "/bandeiras/br.png",
    alt: "Bandeira do Brasil",
  },
];

export default function CanaisRegionais() {
  return (
    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
      <div className="bg-[#1A2B4A] px-4 py-3 flex items-center gap-2">
        <div className="w-1 h-5 bg-[#C9A84C] rounded" />
        <h3 className="text-white font-bold text-sm uppercase tracking-wide">Canais Regionais</h3>
      </div>
      <div className="p-3 space-y-2">
        {canais.map((canal) => (
          <Link key={canal.href} href={canal.href} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 transition-colors group">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={canal.bandeira}
              alt={canal.alt}
              width={32}
              height={22}
              className="rounded-sm object-cover shadow-sm flex-shrink-0"
            />
            <span className="text-sm font-medium text-gray-700 group-hover:text-[#1A2B4A]">{canal.label}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
