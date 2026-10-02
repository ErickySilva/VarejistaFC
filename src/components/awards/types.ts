import type { AwardType } from "@/domain/night";

// Um vencedor de prêmio, pronto para a cerimônia e para o card.
export interface AwardWinner {
  award: AwardType;
  // Nome do prêmio (ex.: "Craque da Noite").
  label: string;
  name: string;
  shirtNumber: number;
  photoUrl: string | null;
  // Número principal do prêmio, já formatado, e a sua unidade.
  value: string;
  unit: string;
  // Quando o número principal é inteiro, o valor para a contagem.
  countTo?: number;
  // Números de apoio (ex.: gols, assistências, defesas).
  stats: { label: string; value: string }[];
}

export interface CeremonyNight {
  id: number;
  // Data da gameplay, pronta para leitura (dd/mm/aaaa).
  date: string;
  summary: string | null;
  score: {
    matches: number;
    wins: number;
    draws: number;
    losses: number;
    goalsFor: number;
    goalsAgainst: number;
  };
}
