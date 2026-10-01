// Limite de tentativas de login com senha errada. Os tiles de entrada tornam
// público quem tem conta, então a senha não pode ser adivinhada à vontade.
//
// O contador fica em memória, por origem (IP) e conta de destino: quem erra
// demais é barrado por um tempo, sem travar o acesso do dono da conta a partir
// de outro lugar. Reinicia quando o servidor reinicia.

const WINDOW_MS = 15 * 60 * 1000;
export const MAX_FAILED_ATTEMPTS = 8;

const failures = new Map<string, number[]>();

function recent(key: string, now: number): number[] {
  const kept = (failures.get(key) ?? []).filter(
    (moment) => now - moment < WINDOW_MS,
  );
  if (kept.length === 0) failures.delete(key);
  else failures.set(key, kept);
  return kept;
}

export function attemptKey(headers: Headers, target: string): string {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return `${forwarded || "local"}|${target.toLowerCase()}`;
}

export function isBlocked(key: string, now = Date.now()): boolean {
  return recent(key, now).length >= MAX_FAILED_ATTEMPTS;
}

export function recordFailure(key: string, now = Date.now()): void {
  failures.set(key, [...recent(key, now), now]);
}

export function clearFailures(key: string): void {
  failures.delete(key);
}

// Para os testes começarem sem contagem anterior.
export function resetAttempts(): void {
  failures.clear();
}
