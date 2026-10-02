import { deleteMatch } from "@/server/actions/gameplay-actions";
import { ActionButton } from "./action-button";

interface DeleteMatchButtonProps {
  matchId: number;
  opponentName: string;
  goalsFor: number;
  goalsAgainst: number;
  // A partida é a única da gameplay: excluí-la deixa a gameplay vazia.
  onlyMatchOfNight: boolean;
}

// Exclui uma partida da gameplay em andamento, com confirmação explícita. Só
// aparece para admin; o servidor confere a permissão e que a gameplay está
// aberta. Não existe "desfazer" na interface, então a confirmação diz isso com
// todas as letras.
export function DeleteMatchButton({
  matchId,
  opponentName,
  goalsFor,
  goalsAgainst,
  onlyMatchOfNight,
}: DeleteMatchButtonProps) {
  const consequence = onlyMatchOfNight
    ? " É a única partida desta gameplay: depois de excluir, cancele a gameplay no painel para ela não ficar vazia."
    : "";

  return (
    <ActionButton
      action={deleteMatch.bind(null, { matchId })}
      label="Excluir partida"
      pendingLabel="Excluindo"
      variant="danger"
      size="md"
      redirectTo="/gameplay"
      confirm={{
        title: "Excluir esta partida?",
        message: `A partida contra ${opponentName} (${goalsFor} × ${goalsAgainst}) sai das estatísticas, do ranking e dos prêmios da noite. Esta ação é irreversível.${consequence}`,
        confirmLabel: "Excluir definitivamente",
      }}
    />
  );
}
