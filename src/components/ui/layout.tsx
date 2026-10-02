import Link from "next/link";
import { ArrowLeftIcon, ChevronRightIcon } from "./icons";
import { BACK, FORWARD, PageTransition } from "./transitions";

// Peças de estrutura de página.

const WIDTHS = {
  narrow: "max-w-md",
  reading: "max-w-2xl",
  wide: "max-w-5xl",
};

interface PageProps {
  width?: keyof typeof WIDTHS;
  children: React.ReactNode;
  className?: string;
}

// Contêiner de página: largura, respiro e o espaço da barra inferior no celular.
export function Page({
  width = "reading",
  children,
  className = "",
}: PageProps) {
  return (
    <PageTransition>
      <main
        className={`mx-auto flex w-full flex-1 flex-col gap-10 px-4 pt-5 pb-28 sm:px-6 md:pt-8 md:pb-16 ${WIDTHS[width]} ${className}`}
      >
        {children}
      </main>
    </PageTransition>
  );
}

// Link de volta, quando a página é um nível abaixo de outra.
export function PageHeaderBack({
  href,
  label,
}: {
  href: string;
  label: string;
}) {
  return (
    <Link
      href={href}
      transitionTypes={BACK}
      className="text-muted hover:text-fg -my-3 -ml-1 inline-flex min-h-11 items-center gap-1.5 self-start px-1 text-sm transition-colors"
    >
      <ArrowLeftIcon className="h-4 w-4" />
      {label}
    </Link>
  );
}

interface PageHeaderProps {
  title: string;
  description?: React.ReactNode;
  back?: { href: string; label: string };
  children?: React.ReactNode;
}

export function PageHeader({
  title,
  description,
  back,
  children,
}: PageHeaderProps) {
  return (
    <header className="flex flex-col gap-2">
      {back && (
        <div className="mb-3 flex">
          <PageHeaderBack href={back.href} label={back.label} />
        </div>
      )}
      <h1 className="display text-3xl sm:text-4xl">{title}</h1>
      {description && <p className="text-muted text-sm">{description}</p>}
      {children}
    </header>
  );
}

interface SectionProps {
  title: string;
  // Texto curto à direita do título (ex.: o período).
  aside?: React.ReactNode;
  // Link "ver tudo" da seção.
  more?: { href: string; label: string };
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export function Section({
  title,
  aside,
  more,
  children,
  className = "",
  style,
}: SectionProps) {
  return (
    <section className={`flex flex-col gap-3 ${className}`} style={style}>
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="display text-xl">
          {title}
          {aside && (
            <span className="text-muted ml-2 text-sm font-normal tracking-normal">
              {aside}
            </span>
          )}
        </h2>
        {more && (
          <Link
            href={more.href}
            transitionTypes={FORWARD}
            className="text-soft hover:text-fg inline-flex min-h-9 shrink-0 items-center gap-0.5 text-sm font-medium transition-colors"
          >
            {more.label}
            <ChevronRightIcon className="h-4 w-4" />
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

// Superfície: agrupa conteúdo relacionado. Sem borda; a diferença de tom já
// separa do fundo.
export function Surface({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={`bg-surface rounded-lg ${className}`}>{children}</div>;
}

interface EmptyStateProps {
  title: string;
  children?: React.ReactNode;
  action?: React.ReactNode;
}

// Tela ou seção sem conteúdo: diz o que falta e, se houver, o que fazer.
export function EmptyState({ title, children, action }: EmptyStateProps) {
  return (
    <div className="border-line flex flex-col items-start gap-2 rounded-lg border border-dashed px-5 py-6">
      <p className="font-semibold">{title}</p>
      {children && <p className="text-muted text-sm">{children}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div aria-hidden="true" className={`skeleton ${className}`} />;
}
