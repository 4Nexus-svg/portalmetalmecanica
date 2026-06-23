"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import { useEffect } from "react";

const BTN = "px-2 py-1 rounded text-sm hover:bg-gray-200 disabled:opacity-30 transition-colors";
const BTN_ACTIVE = "bg-[#1A2B4A] text-white hover:bg-[#1A2B4A]";

export default function RichTextEditor({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (html: string) => void;
}) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Link.configure({ openOnClick: false, HTMLAttributes: { rel: "noopener noreferrer", target: "_blank" } }),
    ],
    content: value ?? "",
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    editorProps: {
      attributes: {
        class: "prose prose-sm max-w-none min-h-[200px] px-4 py-3 focus:outline-none",
      },
    },
  });

  // Sincroniza quando o valor muda externamente (ex: abrir outro artigo no modal)
  useEffect(() => {
    if (!editor) return;
    if (editor.getHTML() !== (value ?? "")) {
      editor.commands.setContent(value ?? "", { emitUpdate: false });
    }
  }, [value, editor]);

  function addLink() {
    const url = window.prompt("URL do link:");
    if (!url) return;
    editor?.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  }

  if (!editor) return null;

  return (
    <div className="border border-gray-300 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-[#C9A84C] focus-within:border-[#C9A84C]">
      {/* Toolbar */}
      <div className="flex flex-wrap gap-0.5 border-b border-gray-200 bg-gray-50 px-2 py-1.5">
        <button type="button" onClick={() => editor.chain().focus().toggleBold().run()}
          className={`${BTN} font-bold ${editor.isActive("bold") ? BTN_ACTIVE : ""}`} title="Negrito">
          B
        </button>
        <button type="button" onClick={() => editor.chain().focus().toggleItalic().run()}
          className={`${BTN} italic ${editor.isActive("italic") ? BTN_ACTIVE : ""}`} title="Itálico">
          I
        </button>
        <span className="w-px bg-gray-300 mx-1 self-stretch" />
        <button type="button" onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          className={`${BTN} ${editor.isActive("heading", { level: 2 }) ? BTN_ACTIVE : ""}`} title="Título H2">
          H2
        </button>
        <button type="button" onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          className={`${BTN} ${editor.isActive("heading", { level: 3 }) ? BTN_ACTIVE : ""}`} title="Título H3">
          H3
        </button>
        <span className="w-px bg-gray-300 mx-1 self-stretch" />
        <button type="button" onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={`${BTN} ${editor.isActive("bulletList") ? BTN_ACTIVE : ""}`} title="Lista com marcadores">
          • Lista
        </button>
        <button type="button" onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={`${BTN} ${editor.isActive("orderedList") ? BTN_ACTIVE : ""}`} title="Lista numerada">
          1. Lista
        </button>
        <span className="w-px bg-gray-300 mx-1 self-stretch" />
        <button type="button" onClick={addLink}
          className={`${BTN} ${editor.isActive("link") ? BTN_ACTIVE : ""}`} title="Inserir link">
          Link
        </button>
        {editor.isActive("link") && (
          <button type="button" onClick={() => editor.chain().focus().unsetLink().run()}
            className={`${BTN} text-red-600 hover:bg-red-50`} title="Remover link">
            ✕ Link
          </button>
        )}
        <span className="w-px bg-gray-300 mx-1 self-stretch" />
        <button type="button" onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()} className={BTN} title="Desfazer">
          ↩
        </button>
        <button type="button" onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()} className={BTN} title="Refazer">
          ↪
        </button>
      </div>

      {/* Área de edição */}
      <EditorContent editor={editor} />
    </div>
  );
}
