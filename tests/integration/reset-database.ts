import type postgres from "postgres";

// Esvazia todas as tabelas do banco de teste.
//
// `audit_log` referencia `users`, e o TRUNCATE em `audit_log` é bloqueado por
// gatilho. O gatilho é desligado só durante a limpeza, dentro da mesma
// transação, e religado em seguida. Isso só é feito aqui, no banco de teste.
export async function resetDatabase(sql: postgres.Sql) {
  await sql.begin(async (tx) => {
    await tx`alter table audit_log disable trigger audit_log_forbid_truncate`;
    await tx`
      truncate audit_log, sessions, accounts, verifications, users,
        match_players, nickname_assignments, night_awards, matches, nights,
        seasons, opponents, nicknames, legacy_stats, players
      restart identity cascade`;
    await tx`alter table audit_log enable trigger audit_log_forbid_truncate`;
  });
}
