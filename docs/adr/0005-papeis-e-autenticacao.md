# 0005 — Papéis `admin` e `player`, cadastro fechado

**Status:** aceita

## Decisão

- Visitante sem login enxerga toda a área pública (somente leitura).
- `player`: edita o próprio perfil.
- `admin`: cadastra, edita e corrige noites, partidas, jogadores, apelidos e
  histórico.
- Não existe cadastro aberto. Contas são criadas por um `admin` e podem ser
  vinculadas a um jogador.
- A autorização é verificada no servidor em cada Server Action e rota. Esconder
  um botão não conta como proteção.
- Apelidos (ex.: OLISO, EL GARRÓ) são atribuídos manualmente por um `admin`
  a uma partida ou a uma noite. O sistema nunca escolhe apelido.

## Implementação

A biblioteca, as tabelas, a tabela de autorização e as proteções estão no
[ADR 0011](0011-autenticacao-e-autorizacao.md). Um ajuste em relação ao texto
acima: no próprio perfil, o `player` altera somente a foto do jogador
vinculado à sua conta; nome, número da camisa e posição padrão são de admin.
