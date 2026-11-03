import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // sharp abre o libvips via dlopen em runtime. Sem um require estático, o
  // rastreamento de arquivos do Next não inclui o .so na função e a rota de
  // notícias quebra com ERR_DLOPEN_FAILED em qualquer build sem cache.
  serverExternalPackages: ["sharp"],
  outputFileTracingIncludes: {
    "/api/cron/buscar-noticias": ["./node_modules/@img/**"],
    // Fontes e logo lidos do disco pelo card de indicadores do resumo.
    "/og/indicadores/[grupo]": ["./assets/fonts/**", "./public/logo-variants/logo-instagram.png"],
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**" },
      { protocol: "http", hostname: "**" },
    ],
  },
};

export default nextConfig;
