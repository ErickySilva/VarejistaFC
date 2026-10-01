import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Gera .next/standalone, usado pelo estágio de produção do Dockerfile.
  output: "standalone",
  // Fixa a raiz no projeto: sem isso o Next sobe até outro package-lock.json
  // que exista em uma pasta acima e rastreia arquivos a partir de lá.
  outputFileTracingRoot: __dirname,
  turbopack: { root: __dirname },
};

export default nextConfig;
