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

## Em aberto

A biblioteca de autenticação será fixada na fase de autenticação. A candidata é
Better Auth, com credenciais e sessão no banco.
