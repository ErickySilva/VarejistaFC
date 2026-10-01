import Image from "next/image";

const SIZES = {
  sm: { box: "h-8 w-8 text-xs", pixels: 32 },
  md: { box: "h-12 w-12 text-sm", pixels: 48 },
  lg: { box: "h-28 w-28 text-2xl", pixels: 112 },
};

interface PlayerAvatarProps {
  name: string;
  shirtNumber: number;
  photoUrl: string | null;
  size?: keyof typeof SIZES;
}

// Foto do jogador. Enquanto a foto real não é cadastrada, mostra o número da
// camisa em um marcador neutro e provisório; havendo foto, é sempre ela.
export function PlayerAvatar({
  name,
  shirtNumber,
  photoUrl,
  size = "md",
}: PlayerAvatarProps) {
  const { box, pixels } = SIZES[size];

  if (photoUrl) {
    return (
      <Image
        src={photoUrl}
        alt={`Foto de ${name}`}
        width={pixels}
        height={pixels}
        unoptimized
        className={`${box} shrink-0 rounded-full object-cover`}
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      className={`${box} border-foreground/20 bg-foreground/5 flex shrink-0 items-center justify-center rounded-full border font-semibold tabular-nums`}
    >
      {shirtNumber}
    </span>
  );
}
