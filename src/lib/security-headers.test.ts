import { describe, expect, it } from "vitest";
import nextConfig from "../../next.config";
import { securityHeaders } from "./security-headers";

const header = (key: string) =>
  securityHeaders.find((entry) => entry.key === key)?.value;

describe("cabeçalhos de segurança", () => {
  it("impede adivinhar o tipo de arquivo e embutir o site em outra página", () => {
    expect(header("X-Content-Type-Options")).toBe("nosniff");
    expect(header("X-Frame-Options")).toBe("DENY");
    expect(header("Content-Security-Policy")).toBe("frame-ancestors 'none'");
    expect(header("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
  });

  it("não define HSTS: isso é do Nginx, só em HTTPS", () => {
    expect(header("Strict-Transport-Security")).toBeUndefined();
  });

  it("vale para todas as rotas", async () => {
    const rules = await nextConfig.headers!();

    expect(rules).toEqual([{ source: "/:path*", headers: securityHeaders }]);
  });

  it("não anuncia a tecnologia do servidor", () => {
    expect(nextConfig.poweredByHeader).toBe(false);
  });
});
