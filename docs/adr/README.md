# Decisões de arquitetura (ADRs)

Cada arquivo registra uma decisão, o motivo e o que ela obriga no código.
Uma decisão só muda com um novo ADR que substitua o anterior.

| #                                                 | Decisão                                                  | Status |
| ------------------------------------------------- | -------------------------------------------------------- | ------ |
| [0001](0001-monolito-nextjs.md)                   | Monólito Next.js em três camadas                         | Aceita |
| [0002](0002-fonte-de-verdade-sem-contadores.md)   | Fonte de verdade única, sem contadores derivados         | Aceita |
| [0003](0003-historico-pre-sistema.md)             | Histórico pré-sistema separado das partidas              | Aceita |
| [0004](0004-posicao-por-partida-e-n-jogadores.md) | Posição por partida e elenco de N jogadores              | Aceita |
| [0005](0005-papeis-e-autenticacao.md)             | Papéis `admin` e `player`, cadastro fechado              | Aceita |
| [0006](0006-auditoria.md)                         | Auditoria de alterações                                  | Aceita |
| [0007](0007-noites.md)                            | Noites: uma aberta por vez, data de referência e polling | Aceita |
| [0008](0008-premios-da-noite.md)                  | Prêmios da noite e critério do craque                    | Aceita |
| [0009](0009-postgres-drizzle.md)                  | PostgreSQL com Drizzle ORM                               | Aceita |
| [0010](0010-nota-versionada.md)                   | Nota da partida com fórmula versionada                   | Aceita |
| [0011](0011-autenticacao-e-autorizacao.md)        | Autenticação e autorização com Better Auth               | Aceita |
| [0012](0012-gameplay.md)                          | Fluxo de gameplay                                        | Aceita |

A fórmula da nota vigente é a `v2`, em [../nota-v2.md](../nota-v2.md); ela parte da
`v1`, em [../nota-v1.md](../nota-v1.md).
