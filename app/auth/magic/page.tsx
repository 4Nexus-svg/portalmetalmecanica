"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function MagicPage() {
  const [status, setStatus] = useState("Autenticando...");

  useEffect(() => {
    const supabase = createClient();

    // O createBrowserClient do @supabase/ssr detecta o hash automaticamente
    // via onAuthStateChange quando há #access_token na URL
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session) {
        setStatus("Logado! Redirecionando...");
        window.location.href = "/painel";
      } else if (event === "TOKEN_REFRESHED") {
        window.location.href = "/painel";
      }
    });

    // Fallback: tenta pegar a sessão atual (caso já tenha sido processada)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        window.location.href = "/painel";
      } else {
        setStatus("Link inválido ou expirado. Solicite um novo.");
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <p className="text-gray-600 text-sm">{status}</p>
    </div>
  );
}
