import Image from "next/image";
import { ViewTransition } from "react";

// Retrato do jogador no hexágono do escudo: a forma que identifica o clube.
// Um componente só, em todos os tamanhos, para o jogador ser reconhecido da
// mesma maneira na entrada, no ranking, no perfil e nos prêmios.

const SIZES = {
  xs: { box: "h-8", pixels: 32, band: "inset-[2.5px]", text: "text-[0.65rem]" },
  sm: { box: "h-11", pixels: 44, band: "inset-[3px]", text: "text-xs" },
  md: { box: "h-16", pixels: 64, band: "inset-[3.5px]", text: "text-base" },
  lg: { box: "h-28", pixels: 112, band: "inset-[5px]", text: "text-2xl" },
  xl: { box: "h-44", pixels: 176, band: "inset-[7px]", text: "text-4xl" },
  hero: {
    box: "h-60 sm:h-72",
    pixels: 288,
    band: "inset-[9px]",
    text: "text-6xl",
  },
};

const RINGS = {
  // Contorno discreto, um tom acima da superfície.
  quiet: "bg-line",
  // Moldura do escudo: fio azul-marinho por fora e faixa branca por dentro.
  crest: "bg-ink-700",
  // Destaque: primeiro lugar, prêmio.
  accent: "bg-ribbon",
};

interface PlayerAvatarProps {
  name: string;
  // Mostrado no lugar da foto quando o jogador não tem uma.
  shirtNumber?: number;
  photoUrl: string | null;
  size?: keyof typeof SIZES;
  ring?: keyof typeof RINGS;
  // Carrega com prioridade quando é a imagem principal da tela.
  priority?: boolean;
  // Identifica o jogador (slug) para o retrato viajar de uma tela para a
  // outra. Só um retrato por jogador pode ter isto em cada tela.
  sharedAs?: string;
  className?: string;
}

export function PlayerAvatar({
  name,
  shirtNumber,
  photoUrl,
  size = "sm",
  ring = "quiet",
  priority = false,
  sharedAs,
  className = "",
}: PlayerAvatarProps) {
  const { box, pixels, band, text } = SIZES[size];

  const portrait = (
    <span
      className={`clip-hex relative inline-block aspect-[7/8] shrink-0 ${box} ${RINGS[ring]} ${className}`}
    >
      {ring === "crest" && (
        <span
          aria-hidden="true"
          className="clip-hex bg-paper absolute inset-[1.5px]"
        />
      )}
      <span className={`clip-hex bg-ink-800 absolute overflow-hidden ${band}`}>
        {photoUrl ? (
          <Image
            src={photoUrl}
            alt={`Foto de ${name}`}
            width={pixels * 2}
            height={pixels * 2}
            priority={priority}
            // Arquivos do próprio projeto são otimizados pelo Next; um endereço
            // externo é servido como está.
            unoptimized={!photoUrl.startsWith("/")}
            className="h-full w-full object-cover object-[50%_30%]"
          />
        ) : (
          // Só aparece para jogador sem foto cadastrada.
          <span
            aria-hidden="true"
            className={`numeral text-mist flex h-full w-full items-center justify-center ${text}`}
          >
            {shirtNumber ?? name.charAt(0)}
          </span>
        )}
      </span>
    </span>
  );

  if (!sharedAs) return portrait;
  return (
    <ViewTransition name={`jogador-${sharedAs}`} share="morph" default="none">
      {portrait}
    </ViewTransition>
  );
}
