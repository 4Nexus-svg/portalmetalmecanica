"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function MagicPage() {
  const [status, setStatus] = useState("Autenticando...");
  // Lê ?invite=1 da query string — preservado pelo Supabase no redirect
  const [isInvite] = useState(() => {
    if (typeof window === "undefined") return false;
    return new URLSearchParams(window.location.search).get("invite") === "1";
  });

  useEffect(() => {
    const supabase = createClient();
    const destino = isInvite ? "/auth/definir-senha" : "/painel";

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if ((event === "SIGNED_IN" || event === "TOKEN_REFRESHED") && session) {
        setStatus("Logado! Redirecionando...");
        window.location.href = destino;
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        window.location.href = destino;
      } else {
        setStatus("Link inválido ou expirado. Solicite um novo.");
      }
    });

    return () => subscription.unsubscribe();
  }, [isInvite]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <p className="text-gray-600 text-sm">{status}</p>
    </div>
  );
}
