"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// Captura o #access_token do magic link/convite (fluxo implícito do Supabase)
// e troca por uma sessão real, redirecionando para o painel.
export default function AuthHashHandler() {
  const router = useRouter();

  useEffect(() => {
    const hash = window.location.hash;
    if (!hash.includes("access_token")) return;

    const params = new URLSearchParams(hash.slice(1));
    const accessToken = params.get("access_token");
    const refreshToken = params.get("refresh_token");
    if (!accessToken || !refreshToken) return;

    const supabase = createClient();
    const type = params.get("type");
    supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken }).then(({ error }) => {
      if (!error) {
        window.location.href = type === "invite" ? "/auth/definir-senha" : "/painel";
      }
    });
  }, []);

  return null;
}
