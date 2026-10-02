import Image from "next/image";
import { PageTransition } from "../ui/transitions";

// Foto do elenco usada como fundo da entrada do clube.
//
// Para ativar: salve a foto em `public/brand/elenco.webp` (horizontal, com
// pelo menos 2400px de largura, os jogadores no terço de cima) e troque `null`
// por `{ src: "/brand/elenco.webp", focus: "50% 30%" }`. `focus` é o ponto da
// foto que deve ficar visível quando ela é cortada no celular.
const TEAM_PHOTO: { src: string; focus: string } | null = null;

interface EntryBackdropProps {
  children: React.ReactNode;
  // Telas de senha: a foto recua mais, para o formulário ser o foco.
  quiet?: boolean;
}

// Fundo da entrada, em camadas fixas:
//   foto do elenco → tratamento (menos cor, mais contraste) → véu azul-marinho
//   → degradê que fecha em azul sólido embaixo, onde ficam os jogadores.
// A foto é identidade do clube, não enfeite: por isso o tratamento a deixa na
// cor da marca e o conteúdo fica sempre legível por cima. Sem a foto, as
// mesmas camadas resultam em um fundo azul simples.
export function EntryBackdrop({ children, quiet = false }: EntryBackdropProps) {
  return (
    <PageTransition>
      <main className="bg-ink-950 relative isolate flex flex-1 flex-col overflow-hidden">
        <div aria-hidden="true" className="absolute inset-0 -z-10">
          {TEAM_PHOTO ? (
            <>
              <Image
                src={TEAM_PHOTO.src}
                alt=""
                fill
                priority
                sizes="100vw"
                className={`object-cover contrast-110 grayscale-[45%] ${
                  quiet ? "brightness-50" : "brightness-75"
                }`}
                style={{ objectPosition: TEAM_PHOTO.focus }}
              />
              <div className="bg-ink-800/55 absolute inset-0 mix-blend-multiply" />
            </>
          ) : (
            <div className="from-ink-700 absolute inset-x-0 top-0 h-[70%] bg-linear-to-b to-transparent" />
          )}
          <div
            className={`to-ink-950 absolute inset-0 bg-linear-to-b from-transparent ${
              quiet ? "via-ink-950/85 via-35%" : "via-ink-950/80 via-55%"
            }`}
          />
        </div>
        {children}
      </main>
    </PageTransition>
  );
}
