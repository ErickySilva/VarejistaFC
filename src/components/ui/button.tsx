import Link from "next/link";
import { Spinner } from "./icons";

// Botão do produto. Uma hierarquia só:
// - primary: a ação principal da tela (amarelo da faixa); no máximo uma à vista;
// - secondary: ação de apoio, sobre a superfície;
// - ghost: ação discreta, sem fundo;
// - danger: ação que desfaz ou encerra algo.

const BASE =
  "inline-flex items-center justify-center gap-2 rounded-md font-semibold select-none " +
  "transition-[transform,background-color,color,opacity] duration-150 ease-out " +
  "active:scale-[0.97] disabled:pointer-events-none disabled:opacity-45";

const VARIANTS = {
  primary: "bg-accent text-accent-ink hover:bg-accent-deep",
  secondary: "bg-raised text-fg hover:bg-line",
  ghost: "text-soft hover:bg-surface hover:text-fg",
  danger: "bg-loss/15 text-loss hover:bg-loss/25",
};

const SIZES = {
  // 44px de altura: confortável para o polegar.
  md: "min-h-11 px-4 text-sm",
  lg: "min-h-13 px-5 text-base",
};

export type ButtonVariant = keyof typeof VARIANTS;
export type ButtonSize = keyof typeof SIZES;

export function buttonClass(
  variant: ButtonVariant = "secondary",
  size: ButtonSize = "md",
  extra = "",
): string {
  return `${BASE} ${VARIANTS[variant]} ${SIZES[size]} ${extra}`;
}

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  // Mostra o indicador de carregamento e bloqueia novos cliques.
  loading?: boolean;
}

export function Button({
  variant,
  size,
  loading = false,
  className = "",
  children,
  disabled,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={buttonClass(variant, size, className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading && <Spinner className="h-4 w-4" />}
      {children}
    </button>
  );
}

interface ButtonLinkProps {
  href: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  children: React.ReactNode;
}

// Link com aparência de botão, para navegação que é a ação principal.
export function ButtonLink({
  href,
  variant,
  size,
  className = "",
  children,
}: ButtonLinkProps) {
  return (
    <Link href={href} className={buttonClass(variant, size, className)}>
      {children}
    </Link>
  );
}
