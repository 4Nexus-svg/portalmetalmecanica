import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard, Megaphone, Tag, BookOpen, Briefcase,
  CalendarDays, PenLine, Star, Home, Settings, Users,
} from "lucide-react";

export type Role = "admin" | "editor" | "comercial" | "colunista";

export type Secao =
  | "dashboard" | "publicidade" | "classificados" | "guia"
  | "vagas" | "eventos" | "colunistas" | "destaques"
  | "home" | "configuracoes" | "usuarios";

const ACESSO: Record<Role, Secao[]> = {
  admin:     ["dashboard", "publicidade", "classificados", "guia", "vagas", "eventos", "colunistas", "destaques", "home", "configuracoes", "usuarios"],
  editor:    ["dashboard", "guia", "vagas", "eventos", "colunistas", "destaques", "home"],
  comercial: ["dashboard", "publicidade", "classificados", "destaques"],
  colunista: ["dashboard", "colunistas"],
};

export function podeAcessar(role: Role, secao: Secao): boolean {
  return ACESSO[role]?.includes(secao) ?? false;
}

export function secoesDisponiveis(role: Role): Secao[] {
  return ACESSO[role] ?? [];
}

export const ROLE_LABEL: Record<Role, string> = {
  admin: "Administrador",
  editor: "Editor",
  comercial: "Comercial",
  colunista: "Colunista",
};

export interface SecaoMeta {
  label: string;
  rota: string;
  icone: LucideIcon;
  fase: number; // fase em que ganha CRUD real
}

export const SECOES_META: Record<Secao, SecaoMeta> = {
  dashboard:     { label: "Dashboard",       rota: "/painel",                icone: LayoutDashboard, fase: 3 },
  publicidade:   { label: "Publicidade",     rota: "/painel/publicidade",    icone: Megaphone,       fase: 1 },
  classificados: { label: "Classificados",   rota: "/painel/classificados",  icone: Tag,             fase: 1 },
  destaques:     { label: "Destaques",       rota: "/painel/destaques",      icone: Star,            fase: 1 },
  guia:          { label: "Guia Industrial", rota: "/painel/guia",           icone: BookOpen,        fase: 2 },
  vagas:         { label: "Vagas",           rota: "/painel/vagas",          icone: Briefcase,       fase: 2 },
  eventos:       { label: "Eventos",         rota: "/painel/eventos",        icone: CalendarDays,    fase: 2 },
  colunistas:    { label: "Colunistas",      rota: "/painel/colunistas",     icone: PenLine,         fase: 2 },
  home:          { label: "Home",            rota: "/painel/home",           icone: Home,            fase: 3 },
  configuracoes: { label: "Configurações",   rota: "/painel/configuracoes",  icone: Settings,        fase: 3 },
  usuarios:      { label: "Usuários",        rota: "/painel/usuarios",       icone: Users,           fase: 3 },
};

/** Converte o role do banco (5 valores) num Role de painel, ou null se não acessa o painel. */
export function rolePainel(dbRole: string | null | undefined): Role | null {
  if (dbRole === "admin" || dbRole === "editor" || dbRole === "comercial" || dbRole === "colunista") {
    return dbRole;
  }
  return null;
}
