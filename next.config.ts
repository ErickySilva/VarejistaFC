import type { NextConfig } from "next";
import { securityHeaders } from "./src/lib/security-headers";

const nextConfig: NextConfig = {
  // Gera .next/standalone, usado pelo estágio de produção do Dockerfile.
  output: "standalone",
  // Fixa a raiz no projeto: sem isso o Next sobe até outro package-lock.json
  // que exista em uma pasta acima e rastreia arquivos a partir de lá.
  outputFileTracingRoot: __dirname,
  turbopack: { root: __dirname },
  // Não anuncia a tecnologia do servidor (cabeçalho X-Powered-By).
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
