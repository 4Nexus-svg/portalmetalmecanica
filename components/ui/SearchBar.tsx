"use client";
import { useState, useRef, useEffect } from "react";
import { Search, X } from "lucide-react";
import { useRouter } from "next/navigation";

export default function SearchBar() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const overlayInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (open) {
      inputRef.current?.focus();
      overlayInputRef.current?.focus();
    }
  }, [open]);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    router.push("/busca?q=" + encodeURIComponent(query.trim()));
    setOpen(false);
    setQuery("");
  }

  function handleClose() {
    setOpen(false);
    setQuery("");
  }

  return (
    <>
      {/* Botão lupa — sempre visível */}
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-3 py-1.5 border border-gray-200 rounded text-sm text-gray-500 hover:border-[#1A2B4A] hover:text-[#1A2B4A] transition-colors"
      >
        <Search size={15} />
        <span className="hidden sm:block font-medium uppercase tracking-wider text-xs">
          Buscar no Portal
        </span>
      </button>

      {/* Overlay mobile — full width fixo sobre o header */}
      {open && (
        <div className="sm:hidden fixed inset-x-0 top-0 z-[60] bg-white shadow-lg px-4 py-3 flex items-center gap-3">
          <form onSubmit={handleSearch} className="flex-1 flex items-center gap-2 border border-[#1A2B4A] rounded px-3 py-2 bg-white">
            <Search size={15} className="text-[#1A2B4A] flex-shrink-0" />
            <input
              ref={overlayInputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar no Portal..."
              className="flex-1 text-sm text-gray-800 outline-none bg-transparent placeholder-gray-400"
            />
          </form>
          <button onClick={handleClose} className="p-1 text-gray-500 hover:text-gray-800">
            <X size={20} />
          </button>
        </div>
      )}

      {/* Expansão inline desktop */}
      {open && (
        <form onSubmit={handleSearch} className="hidden sm:flex items-center gap-2 border border-[#1A2B4A] rounded px-3 py-1.5 bg-white absolute left-4">
          <Search size={15} className="text-[#1A2B4A] flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar no Portal..."
            className="text-sm text-gray-800 outline-none w-56 bg-transparent placeholder-gray-400"
          />
          <button type="button" onClick={handleClose}>
            <X size={15} className="text-gray-400 hover:text-gray-700" />
          </button>
        </form>
      )}
    </>
  );
}