import type { Position } from "../../domain/positions";

// Dados iniciais do Varejista FC. O histórico é a anotação manual anterior ao
// sistema (ADR 0003); `cleanSheets: null` significa "não anotado".

// Temporada histórica à qual o histórico pré-sistema está ligado.
export const LEGACY_SEASON_SLUG = "fc-25";

export const SEED_SEASONS = [
  {
    slug: LEGACY_SEASON_SLUG,
    name: "FC 25",
    gameEdition: "FC 25",
    startsOn: null,
    endsOn: null,
    isActive: false,
  },
  {
    slug: "fc-26",
    name: "FC 26",
    gameEdition: "FC 26",
    startsOn: "2026-06-06",
    endsOn: null,
    isActive: true,
  },
];

interface SeedPlayer {
  slug: string;
  name: string;
  shirtNumber: number;
  defaultPosition: Position;
  legacy: {
    matches: number;
    goals: number;
    assists: number;
    cleanSheets: number | null;
  };
  nicknames: { good: string; bad: string };
}

export const SEED_PLAYERS: SeedPlayer[] = [
  {
    slug: "ericky",
    name: "Ericky",
    shirtNumber: 7,
    defaultPosition: "MEI",
    legacy: { matches: 203, goals: 131, assists: 138, cleanSheets: null },
    nicknames: { good: "OLISO", bad: "EL GARRO" },
  },
  {
    slug: "lucao",
    name: "Lucão",
    shirtNumber: 10,
    defaultPosition: "ATA",
    legacy: { matches: 266, goals: 200, assists: 124, cleanSheets: null },
    nicknames: { good: "LUVERTZ", bad: "THACIANO" },
  },
  {
    slug: "felp",
    name: "Felp",
    shirtNumber: 11,
    defaultPosition: "PD",
    legacy: { matches: 207, goals: 104, assists: 88, cleanSheets: null },
    nicknames: { good: "CRAQUE", bad: "PERNINHA" },
  },
  {
    slug: "heit",
    name: "Heit",
    shirtNumber: 69,
    defaultPosition: "GOL",
    legacy: { matches: 144, goals: 47, assists: 20, cleanSheets: 5 },
    nicknames: { good: "MANOEL HEIT", bad: "MURALHA" },
  },
];
