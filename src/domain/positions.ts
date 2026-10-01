// Fonte única da lista de posições. O enum do banco é criado a partir dela.
export const POSITIONS = [
  "GOL",
  "ZAG",
  "LD",
  "LE",
  "VOL",
  "MC",
  "MD",
  "ME",
  "MEI",
  "PD",
  "PE",
  "SA",
  "ATA",
] as const;

export type Position = (typeof POSITIONS)[number];

export const POSITION_GROUPS = ["GOL", "DEF", "MEI", "ATA"] as const;

export type PositionGroup = (typeof POSITION_GROUPS)[number];

const POSITION_GROUP: Record<Position, PositionGroup> = {
  GOL: "GOL",
  ZAG: "DEF",
  LD: "DEF",
  LE: "DEF",
  VOL: "MEI",
  MC: "MEI",
  MD: "MEI",
  ME: "MEI",
  MEI: "MEI",
  PD: "ATA",
  PE: "ATA",
  SA: "ATA",
  ATA: "ATA",
};

export const POSITION_LABEL: Record<Position, string> = {
  GOL: "Goleiro",
  ZAG: "Zagueiro",
  LD: "Lateral direito",
  LE: "Lateral esquerdo",
  VOL: "Volante",
  MC: "Meia central",
  MD: "Meia direita",
  ME: "Meia esquerda",
  MEI: "Meia ofensivo",
  PD: "Ponta direita",
  PE: "Ponta esquerda",
  SA: "Segundo atacante",
  ATA: "Atacante",
};

export function positionGroup(position: Position): PositionGroup {
  return POSITION_GROUP[position];
}

export function isGoalkeeper(position: Position): boolean {
  return position === "GOL";
}
