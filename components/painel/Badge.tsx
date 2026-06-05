type Variant = "neutro" | "sucesso" | "alerta" | "perigo" | "info";

const ESTILOS: Record<Variant, string> = {
  neutro:  "bg-gray-100 text-gray-600",
  sucesso: "bg-green-100 text-green-700",
  alerta:  "bg-amber-100 text-amber-700",
  perigo:  "bg-red-100 text-red-700",
  info:    "bg-blue-100 text-blue-700",
};

export default function Badge({
  children,
  variant = "neutro",
}: {
  children: React.ReactNode;
  variant?: Variant;
}) {
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${ESTILOS[variant]}`}>
      {children}
    </span>
  );
}
