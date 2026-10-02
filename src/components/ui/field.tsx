// Controles de formulário. Mesma altura dos botões (44px) e fonte de 16px,
// para o celular não dar zoom ao focar.

export const controlClass =
  "bg-well text-fg placeholder:text-muted/60 ring-line focus:ring-focus " +
  "min-h-11 w-full rounded-md px-3 text-base ring-1 ring-inset " +
  "transition-shadow duration-150 outline-none focus:ring-2";

interface FieldProps {
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
  className?: string;
}

// Rótulo + controle + ajuda ou erro. O rótulo envolve o controle: tocar no
// texto foca o campo.
export function Field({
  label,
  hint,
  error,
  children,
  className = "",
}: FieldProps) {
  return (
    <label className={`flex flex-col gap-1.5 ${className}`}>
      <span className="text-soft text-sm font-medium">{label}</span>
      {children}
      {error ? (
        <span role="alert" className="text-loss text-sm">
          {error}
        </span>
      ) : (
        hint && <span className="text-muted text-xs">{hint}</span>
      )}
    </label>
  );
}

export function Input({
  className = "",
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`${controlClass} ${className}`} {...props} />;
}

export function Select({
  className = "",
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={`${controlClass} ${className}`} {...props}>
      {children}
    </select>
  );
}

const NOTICE_TONES = {
  error: "bg-loss/15 text-loss",
  success: "bg-win/15 text-win",
  info: "bg-raised text-soft",
};

// Mensagem de retorno de uma ação (erro ou confirmação) ou aviso de contexto.
export function Notice({
  tone,
  children,
}: {
  tone: keyof typeof NOTICE_TONES;
  children: React.ReactNode;
}) {
  return (
    <p
      role={tone === "error" ? "alert" : "status"}
      className={`rounded-md px-3 py-2.5 text-sm ${NOTICE_TONES[tone]}`}
    >
      {children}
    </p>
  );
}
