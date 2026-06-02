"use client";
import { useState, useRef, useEffect } from "react";
import { Search, X } from "lucide-react";
import { useRouter } from "next/navigation";

export default function SearchBar() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    router.push("/busca?q=" + encodeURIComponent(query.trim()));
    setOpen(false);
    setQuery("");
  }

  return (
    <>
      {/* Botão de busca — fecha quando aberto */}
      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className="flex items-center gap-2 px-3 py-1.5 border border-gray-200 rounded text-sm text-gray-500 hover:border-[#1A2B4A] hover:text-[#1A2B4A] transition-colors group"
        >
          <Search size={15} />
          <span className="hidden sm:block font-medium uppercase tracking-wider text-xs">
            Buscar no Portal
          </span>
        </button>
      ) : (
        <form onSubmit={handleSearch} className="flex items-center gap-2 border border-[#1A2B4A] rounded px-3 py-1.5 bg-white">
          <Search size={15} className="text-[#1A2B4A] flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar no Portal..."
            className="text-sm text-gray-800 outline-none w-40 sm:w-56 bg-transparent placeholder-gray-400"
          />
          <button type="button" onClick={() => { setOpen(false); setQuery(""); }}>
            <X size={15} className="text-gray-400 hover:text-gray-700" />
          </button>
        </form>
      )}
    </>
  );
}