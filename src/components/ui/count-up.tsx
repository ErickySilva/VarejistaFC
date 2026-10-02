// Número inteiro que conta de zero até o valor ao entrar na tela. A animação é
// só CSS (utilitário `count-up`); o valor real fica em texto para leitores de
// tela e some a contagem com "reduzir movimento".
export function CountUp({
  value,
  delayMs = 0,
}: {
  value: number;
  // Espera antes de começar a contar (ex.: até o elemento aparecer).
  delayMs?: number;
}) {
  return (
    <>
      <span
        aria-hidden="true"
        className="count-up"
        style={
          {
            "--num": value,
            animationDelay: `${delayMs}ms`,
          } as React.CSSProperties
        }
      />
      <span className="sr-only">{value}</span>
    </>
  );
}
