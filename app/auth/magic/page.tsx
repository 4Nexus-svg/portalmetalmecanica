"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function MagicPage() {
  const [status, setStatus] = useState("Autenticando...");
  // Captura o hash antes que o SDK do Supabase o limpe
  const [isInvite] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.location.hash.includes("type=invite");
  });

  useEffect(() => {
    const supabase = createClient();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if ((event === "SIGNED_IN" || event === "TOKEN_REFRESHED") && session) {
        setStatus("Logado! Redirecionando...");
        window.location.href = isInvite ? "/auth/definir-senha" : "/painel";
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        window.location.href = "/painel";
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
