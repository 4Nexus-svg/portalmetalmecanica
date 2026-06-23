"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function MagicPage() {
  const [status, setStatus] = useState("Autenticando...");

  useEffect(() => {
    const supabase = createClient();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if ((event === "SIGNED_IN" || event === "TOKEN_REFRESHED") && session) {
        window.location.href = "/auth/definir-senha";
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        window.location.href = "/auth/definir-senha";
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
