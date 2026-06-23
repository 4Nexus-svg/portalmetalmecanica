"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { slugifyTitulo } from "@/lib/noticias/utils";
import DataTable from "@/components/painel/DataTable";
import Modal from "@/components/painel/Modal";
import { FormField, Input, Textarea, Select } from "@/components/painel/FormField";
import ImageUpload from "@/components/painel/ImageUpload";
import RichTextEditor from "@/components/painel/RichTextEditor";
import Badge from "@/components/painel/Badge";
import {
  criarColunista, atualizarColunista, excluirColunista,
  criarArtigo, atualizarArtigo, excluirArtigo,
  type ColunistaInput, type ArtigoInput,
} from "./actions";
import type { Database } from "@/types/database";
import type { Role } from "@/lib/painel/permissions";

type Colunista = Database["public"]["Tables"]["columnists"]["Row"];
type Artigo = Database["public"]["Tables"]["articles"]["Row"];

function colunistaVazio(): ColunistaInput {
  return { nome: "", slug: "", cargo: null, especialidade: null, bio: null, foto_url: null, ativo: true, profile_id: null };
}
function artigoVazio(columnistId: number): ArtigoInput {
  return { title: "", slug: "", excerpt: null, content: null, cover_url: null, columnist_id: columnistId, publicar: false };
}

export default function ColunistasClient({
  role, colunistas, artigos, meuColunistaId,
}: {
  role: Role;
  colunistas: Colunista[];
  artigos: Artigo[];
  meuColunistaId: number | null;
}) {
  const router = useRouter();
  const ehGestor = role === "admin" || role === "editor";

  // ----- Colunistas modal -----
  const [colAberto, setColAberto] = useState(false);
  const [colEditId, setColEditId] = useState<number | null>(null);
  const [colForm, setColForm] = useState<ColunistaInput>(colunistaVazio());
  const [colSalvando, setColSalvando] = useState(false);

  function abrirNovoColunista() { setColEditId(null); setColForm(colunistaVazio()); setColAberto(true); }
  function abrirEdicaoColunista(c: Colunista) {
    setColEditId(c.id);
    setColForm({ nome: c.nome, slug: c.slug, cargo: c.cargo, especialidade: c.especialidade, bio: c.bio, foto_url: c.foto_url, ativo: c.ativo, profile_id: c.profile_id });
    setColAberto(true);
  }
  async function salvarColunista() {
    if (!colForm.nome) { toast.error("Nome obrigatório"); return; }
    setColSalvando(true);
    try {
      if (colEditId) await atualizarColunista(colEditId, colForm);
      else await criarColunista(colForm);
      toast.success("Colunista salvo");
      setColAberto(false);
      router.refresh();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erro"); }
    finally { setColSalvando(false); }
  }
  async function removerColunista(id: number) {
    if (!confirm("Excluir este colunista? Os artigos dele também serão removidos.")) return;
    try { await excluirColunista(id); toast.success("Excluído"); router.refresh(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Erro"); }
  }

  // ----- Artigos modal -----
  const colunistaPadrao = ehGestor ? (colunistas[0]?.id ?? 0) : (meuColunistaId ?? 0);
  const [artAberto, setArtAberto] = useState(false);
  const [artEditId, setArtEditId] = useState<number | null>(null);
  const [artForm, setArtForm] = useState<ArtigoInput>(artigoVazio(colunistaPadrao));
  const [artSalvando, setArtSalvando] = useState(false);

  function abrirNovoArtigo() { setArtEditId(null); setArtForm(artigoVazio(colunistaPadrao)); setArtAberto(true); }
  function abrirEdicaoArtigo(a: Artigo) {
    setArtEditId(a.id);
    setArtForm({ title: a.title, slug: a.slug, excerpt: a.excerpt, content: a.content, cover_url: a.cover_url, columnist_id: a.columnist_id, publicar: a.published_at != null });
    setArtAberto(true);
  }
  async function salvarArtigo() {
    if (!artForm.title) { toast.error("Título obrigatório"); return; }
    if (!artForm.columnist_id) { toast.error("Selecione um colunista"); return; }
    setArtSalvando(true);
    try {
      if (artEditId) await atualizarArtigo(artEditId, artForm);
      else await criarArtigo(artForm);
      toast.success("Artigo salvo");
      setArtAberto(false);
      router.refresh();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erro"); }
    finally { setArtSalvando(false); }
  }
  async function removerArtigo(a: Artigo) {
    if (!confirm("Excluir este artigo?")) return;
    try { await excluirArtigo(a.id, a.columnist_id); toast.success("Excluído"); router.refresh(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Erro"); }
  }

  const nomeColunista = (id: number) => colunistas.find((c) => c.id === id)?.nome ?? "—";

  const meuPerfil = !ehGestor && meuColunistaId !== null
    ? colunistas.find((c) => c.id === meuColunistaId) ?? null
    : null;

  return (
    <div className="space-y-10">
      {!ehGestor && meuColunistaId === null && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-lg px-4 py-3 text-sm">
          Seu usuário ainda não está vinculado a um colunista — peça ao administrador para fazer o vínculo.
        </div>
      )}

      {meuPerfil && (
        <section>
          <h2 className="text-lg font-bold text-[#1A2B4A] mb-4">Meu Perfil</h2>
          <div className="flex items-start gap-4 bg-white border border-gray-200 rounded-xl p-5">
            {meuPerfil.foto_url
              ? <img src={meuPerfil.foto_url} alt="" className="h-16 w-16 rounded-full object-cover shrink-0" />
              : <div className="h-16 w-16 rounded-full bg-[#1A2B4A]/10 flex items-center justify-center shrink-0 text-2xl font-bold text-[#1A2B4A]">{meuPerfil.nome.charAt(0)}</div>
            }
            <div>
              <p className="text-base font-semibold text-[#1A2B4A]">{meuPerfil.nome}</p>
              {meuPerfil.cargo && <p className="text-sm text-gray-500">{meuPerfil.cargo}</p>}
              {meuPerfil.especialidade && <p className="text-xs text-gray-400 mt-0.5">{meuPerfil.especialidade}</p>}
              {meuPerfil.bio && <p className="text-sm text-gray-600 mt-2 line-clamp-3">{meuPerfil.bio}</p>}
            </div>
          </div>
        </section>
      )}

      {ehGestor && (
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-[#1A2B4A]">Colunistas</h2>
            <button onClick={abrirNovoColunista} className="bg-[#1A2B4A] text-white font-semibold px-4 py-2 rounded-lg hover:bg-[#0f1e35] text-sm">
              + Novo colunista
            </button>
          </div>
          <DataTable<Colunista>
            dados={colunistas}
            vazio="Nenhum colunista."
            colunas={[
              { chave: "foto_url", titulo: "Foto", render: (c) => c.foto_url ? <img src={c.foto_url} alt="" className="h-10 w-10 rounded-full object-cover" /> : "—" },
              { chave: "nome", titulo: "Nome" },
              { chave: "especialidade", titulo: "Especialidade" },
              { chave: "profile_id", titulo: "Vínculo", render: (c) => <Badge variant={c.profile_id ? "sucesso" : "neutro"}>{c.profile_id ? "Vinculado" : "Sem login"}</Badge> },
              { chave: "ativo", titulo: "Ativo", render: (c) => <Badge variant={c.ativo ? "sucesso" : "neutro"}>{c.ativo ? "Sim" : "Não"}</Badge> },
            ]}
            acoes={(c) => (
              <div className="flex gap-3 justify-end">
                <button onClick={() => abrirEdicaoColunista(c)} className="text-blue-700 hover:text-blue-900 text-xs font-medium">Editar</button>
                <button onClick={() => removerColunista(c.id)} className="text-red-600 hover:text-red-800 text-xs font-medium">Excluir</button>
              </div>
            )}
          />
        </section>
      )}

      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-[#1A2B4A]">{ehGestor ? "Artigos" : "Meus Artigos"}</h2>
          {(ehGestor ? colunistas.length > 0 : meuColunistaId !== null) && (
            <button onClick={abrirNovoArtigo} className="bg-[#1A2B4A] text-white font-semibold px-4 py-2 rounded-lg hover:bg-[#0f1e35] text-sm">
              + Novo artigo
            </button>
          )}
        </div>
        <DataTable<Artigo>
          dados={artigos}
          vazio="Nenhum artigo."
          colunas={[
            { chave: "title", titulo: "Título" },
            { chave: "columnist_id", titulo: "Colunista", render: (a) => nomeColunista(a.columnist_id) },
            { chave: "published_at", titulo: "Status", render: (a) => <Badge variant={a.published_at ? "sucesso" : "alerta"}>{a.published_at ? "Publicado" : "Rascunho"}</Badge> },
          ]}
          acoes={(a) => (
            <div className="flex gap-3 justify-end">
              <button onClick={() => abrirEdicaoArtigo(a)} className="text-blue-700 hover:text-blue-900 text-xs font-medium">Editar</button>
              <button onClick={() => removerArtigo(a)} className="text-red-600 hover:text-red-800 text-xs font-medium">Excluir</button>
            </div>
          )}
        />
      </section>

      {/* Modal colunista */}
      <Modal aberto={colAberto} titulo={colEditId ? "Editar colunista" : "Novo colunista"} onFechar={() => setColAberto(false)}>
        <ImageUpload label="Foto" valor={colForm.foto_url} onChange={(url) => setColForm((f) => ({ ...f, foto_url: url }))} />
        <FormField label="Nome">
          <Input value={colForm.nome} onChange={(e) => setColForm((f) => ({ ...f, nome: e.target.value }))} />
        </FormField>
        <FormField label="Slug (vazio = gerar do nome)">
          <Input value={colForm.slug} onChange={(e) => setColForm((f) => ({ ...f, slug: slugifyTitulo(e.target.value) }))} />
        </FormField>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Cargo">
            <Input value={colForm.cargo ?? ""} onChange={(e) => setColForm((f) => ({ ...f, cargo: e.target.value || null }))} />
          </FormField>
          <FormField label="Especialidade">
            <Input value={colForm.especialidade ?? ""} onChange={(e) => setColForm((f) => ({ ...f, especialidade: e.target.value || null }))} />
          </FormField>
        </div>
        <FormField label="Bio">
          <Textarea rows={3} value={colForm.bio ?? ""} onChange={(e) => setColForm((f) => ({ ...f, bio: e.target.value || null }))} />
        </FormField>
        <FormField label="ID do usuário de login (profile_id, opcional)">
          <Input value={colForm.profile_id ?? ""} onChange={(e) => setColForm((f) => ({ ...f, profile_id: e.target.value || null }))} placeholder="UUID do usuário em profiles" />
        </FormField>
        <label className="flex items-center gap-2 mb-4 text-sm">
          <input type="checkbox" checked={colForm.ativo} onChange={(e) => setColForm((f) => ({ ...f, ativo: e.target.checked }))} />
          Ativo
        </label>
        <button onClick={salvarColunista} disabled={colSalvando} className="w-full bg-[#1A2B4A] text-white font-semibold py-2.5 rounded-lg hover:bg-[#0f1e35] disabled:opacity-50">
          {colSalvando ? "Salvando..." : "Salvar"}
        </button>
      </Modal>

      {/* Modal artigo */}
      <Modal aberto={artAberto} titulo={artEditId ? "Editar artigo" : "Novo artigo"} onFechar={() => setArtAberto(false)}>
        <ImageUpload label="Capa" valor={artForm.cover_url} onChange={(url) => setArtForm((f) => ({ ...f, cover_url: url }))} />
        <FormField label="Título">
          <Input value={artForm.title} onChange={(e) => setArtForm((f) => ({ ...f, title: e.target.value }))} />
        </FormField>
        <FormField label="Slug (vazio = gerar do título)">
          <Input value={artForm.slug} onChange={(e) => setArtForm((f) => ({ ...f, slug: slugifyTitulo(e.target.value) }))} />
        </FormField>
        {ehGestor && (
          <FormField label="Colunista">
            <Select value={artForm.columnist_id} onChange={(e) => setArtForm((f) => ({ ...f, columnist_id: Number(e.target.value) }))}>
              {colunistas.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </Select>
          </FormField>
        )}
        <FormField label="Resumo">
          <Textarea rows={2} value={artForm.excerpt ?? ""} onChange={(e) => setArtForm((f) => ({ ...f, excerpt: e.target.value || null }))} />
        </FormField>
        <FormField label="Conteúdo">
          <RichTextEditor value={artForm.content} onChange={(html) => setArtForm((f) => ({ ...f, content: html || null }))} />
        </FormField>
        <label className="flex items-center gap-2 mb-4 text-sm">
          <input type="checkbox" checked={artForm.publicar} onChange={(e) => setArtForm((f) => ({ ...f, publicar: e.target.checked }))} />
          Publicar (desmarcado = rascunho)
        </label>
        <button onClick={salvarArtigo} disabled={artSalvando} className="w-full bg-[#1A2B4A] text-white font-semibold py-2.5 rounded-lg hover:bg-[#0f1e35] disabled:opacity-50">
          {artSalvando ? "Salvando..." : "Salvar"}
        </button>
      </Modal>
    </div>
  );
}
