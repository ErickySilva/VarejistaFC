import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";

// Redirecionamento otimista: quem não tem cookie de sessão é mandado para o
// a tela de entrada antes de a página carregar. Isto é conveniência, não segurança: o
// cookie não é validado aqui. A autorização de verdade acontece em src/server,
// junto do dado.
export function proxy(request: NextRequest) {
  if (getSessionCookie(request)) return NextResponse.next();
  return NextResponse.redirect(new URL("/entrar", request.url));
}

export const config = {
  matcher: ["/conta/:path*", "/admin/:path*", "/gameplay/:path*"],
};
