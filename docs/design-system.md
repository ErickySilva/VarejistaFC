# Identidade visual e design system

Este documento descreve a identidade visual do Varejista FC e os componentes
que a aplicam. Vale para quem for criar ou alterar uma tela.

## De onde vem a identidade

Tudo sai do escudo do clube. O logo não foi redesenhado: as cores foram
medidas nele e as formas foram reaproveitadas.

| Elemento do escudo         | Uso no produto                                     |
| -------------------------- | -------------------------------------------------- |
| Azul-marinho do grifo      | Fundo e superfícies do app (a "tinta")             |
| Branco da moldura          | Texto principal e moldura dos retratos em destaque |
| Amarelo da faixa           | Único acento: ação principal, prêmio, ao vivo      |
| Hexágono                   | Recorte de toda foto de jogador                    |
| Faixa de pontas recortadas | Rótulo de destaque (prêmio, camisa)                |

O app tem um tema só, escuro: o azul-marinho do escudo. A entrada do clube usa
o mesmo tema, sobre a foto do elenco (ver "Entrada do clube").

A composição evita o visual de painel: listas são linhas sobre o fundo,
separadas por um fio, e não caixas. A superfície (`surface`) fica para o que é
um bloco de verdade: o painel ao vivo, o placar da partida, um gráfico.

## Tokens

Ficam em `src/app/globals.css`, no bloco `@theme`. Nenhum componente escreve
cor, raio ou sombra direto: usa o token.

### Cores do escudo

`ink-950` a `ink-600` (do fundo mais escuro à linha), `paper`, `shield`, `mist`,
`ribbon`, `ribbon-deep`. Só aparecem direto onde a marca é literal: a moldura do
retrato, a faixa e o card compartilhável.

### Papéis (o que os componentes usam)

| Token                 | Papel                                                    |
| --------------------- | -------------------------------------------------------- |
| `bg`                  | Fundo da página                                          |
| `surface`             | Bloco em destaque (ao vivo, placar, gráfico) e toque     |
| `raised`              | Um degrau acima da superfície (hover, botão)             |
| `line`                | Fios e contornos                                         |
| `well`                | Fundo de campo de formulário                             |
| `fg`                  | Texto principal                                          |
| `soft`                | Texto de apoio                                           |
| `muted`               | Texto discreto (rótulos, unidades)                       |
| `accent`              | Acento; `accent-ink` é o texto sobre ele                 |
| `focus`               | Contorno de foco do teclado                              |
| `win`, `loss`, `draw` | Resultado; `win-ink` e `loss-ink` são o texto sobre eles |

Resultado nunca depende só da cor: vitória, empate e derrota têm letra (V, E,
D), ícone (seta para cima, igual, seta para baixo) e, no placar da partida, uma
faixa com desenho próprio (cheia, tracejada, listrada).

### Forma, sombra e espaço

- Raios: `sm` (selos), `md` (botões e campos), `lg` (listas), `xl` (painéis de
  destaque).
- Sombra: uma só, `shadow-float`, para o que flutua de verdade (barra inferior
  e diálogo). Superfícies se separam do fundo pelo tom, sem borda nem sombra.
- Espaço: a escala padrão do Tailwind. Entre seções, `gap-10`; dentro de uma
  seção, `gap-3`; linhas de lista, `py-3`.
- Alvos de toque: 44px de altura no mínimo.

### Tipografia

Uma família só, **Rubik**. As formas arredondadas e firmes conversam com o
letreiro do logo.

- `display`: títulos de página e nomes em destaque (peso 800, apertado).
- `numeral`: números de estatística (peso 800, algarismos tabulares).
- Texto corrido em peso normal; rótulos em `text-xs`/`text-sm` com `muted`.
  Negrito é reservado para nome, número e ação.
- Frases em caixa normal. Caixa alta só em dois lugares, onde é um sinal: o
  selo "GAMEPLAY EM ANDAMENTO" e a faixa do prêmio na cerimônia e no card.

### Movimento

A regra: **animação é resposta a uma ação ou a uma mudança de estado.** Nada se
mexe sozinho para enfeitar. As únicas coisas em repetição são o ponto do "ao
vivo" e o relógio da gameplay, porque representam um estado que está de fato
em andamento.

Sem biblioteca: CSS para o que é local e o `<ViewTransition>` do React para o
que atravessa telas. Onde o navegador não suporta, a troca é direta.

| Movimento                                                     | Onde                                                   | É resposta a quê                |
| ------------------------------------------------------------- | ------------------------------------------------------ | ------------------------------- |
| `animate-rise` em cascata (`stagger`)                         | Entrada de blocos e linhas                             | A tela abriu                    |
| Troca de página (fade curto; desliza para dentro ou de volta) | Toda navegação                                         | O toque em um link              |
| Retrato que viaja (`sharedAs`)                                | Entrada → senha; escalação, ranking e partida → perfil | A escolha de um jogador         |
| Linha que desliza de posição                                  | Ranking, ao trocar de aba ou período                   | A ordem mudou                   |
| Marcador que desliza                                          | Barra inferior                                         | A seção mudou                   |
| `animate-roll-up` / `roll-down`                               | Contadores do registro                                 | O valor mudou                   |
| `animate-shake` + motivo                                      | Contadores do registro                                 | O limite foi atingido           |
| `animate-next` / `prev`                                       | Etapas do registro                                     | Avançar ou voltar               |
| `animate-stamp`                                               | Placar da partida, botão "Partida salva", conquistas   | Algo foi concluído              |
| `animate-tick` (`FlashValue`)                                 | Números da gameplay ao vivo                            | Uma partida nova mudou o número |
| `animate-unveil`, `animate-spot`                              | Premiação                                              | A revelação de um premiado      |
| `animate-grow`, `animate-draw`, `count-up`                    | Barras, gráficos, números do perfil                    | Os dados entraram               |
| `animate-live`                                                | Ponto do "ao vivo"                                     | Estado: gameplay aberta         |

Tempos: resposta ao toque em 150–300 ms; troca de tela em 300–450 ms; só a
premiação tem momentos mais longos. Uma família de curvas (`ease-out-quint`).
Só `transform`, `opacity` e `filter` são animados.

A transição de tela é um aprimoramento, nunca um requisito: se o navegador a
abortar (aba oculta, janela redimensionada pelo teclado, outra transição em
seguida), a tela troca do mesmo jeito e sem erro. Isso é garantido por
`src/lib/view-transition-guard.ts`, instalado em
`src/instrumentation-client.ts`; com a aba oculta, a transição nem é iniciada.

Com "reduzir movimento" ligado no aparelho, nada se desloca, as transições de
tela viram troca direta e a premiação abre no quadro final.

## Componentes

Em `src/components/ui/`, salvo indicação.

| Componente                                                                    | O que é                                                                                                                                                       |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Button`, `ButtonLink`                                                        | Botão e link com cara de botão. Variantes: `primary` (uma por tela), `secondary`, `ghost`, `danger`.                                                          |
| `PlayerAvatar`                                                                | Retrato no hexágono. Tamanhos `xs` a `hero`; molduras `quiet`, `crest` e `accent`; `sharedAs` faz o retrato viajar entre telas (um por jogador em cada tela). |
| `Badge`, `Ribbon`, `MatchTypeBadge`, `ResultMark`                             | Selos, a faixa de destaque e o resultado da partida.                                                                                                          |
| `Stat`, `StatGroup`, `StatGrid`, `CountUp`                                    | Número com rótulo, em linha ou em grade.                                                                                                                      |
| `RecordBar`                                                                   | Campanha em uma barra (vitórias, empates, derrotas).                                                                                                          |
| `Page`, `PageHeader`, `PageHeaderBack`, `Section`, `Surface`                  | Estrutura de página.                                                                                                                                          |
| `EmptyState`, `Skeleton`, `skeletons.tsx`                                     | Sem conteúdo e carregando.                                                                                                                                    |
| `LinkTabs`, `PeriodSwitcher`                                                  | Abas na URL e seletor de período.                                                                                                                             |
| `Table`, `Th`, `Td`, `Tr`                                                     | Tabela de números, quando há várias colunas para comparar.                                                                                                    |
| `Field`, `Input`, `Select`, `Notice`, `NumberStepper`                         | Formulário e retorno de ação. O contador responde a cada toque e explica o limite.                                                                            |
| `Modal`, `ConfirmDialog`                                                      | Janela modal e confirmação de ação.                                                                                                                           |
| `icons.tsx`                                                                   | Ícones em traço único, sem biblioteca, incluindo os do jogo: bola (gol), passe (assistência) e luva (defesa).                                                 |
| `transitions.tsx`, `LinkPending`, `FlashValue`                                | Transições de tela e de lista, retorno do toque enquanto a tela carrega e valor que avisa quando mudou.                                                       |
| `shell/AppNav`                                                                | Barra superior e barra inferior do celular.                                                                                                                   |
| `matches/MatchRow`, `Score`                                                   | Partida em lista e placar.                                                                                                                                    |
| `ranking/Leaderboard`                                                         | Classificação: linhas iguais para todos, com posição, foto, nome, camisa e números.                                                                           |
| `gameplay/LivePanel`, `Elapsed`, `LiveRefresh`, `MatchForm`, `night-view.tsx` | A gameplay: painel ao vivo (relógio, fita de partidas, números de cada jogador), atualização ao voltar para a tela, registro em etapas e prêmios.             |
| `squad/Lineup`                                                                | A escalação: os jogadores lado a lado, do mesmo tamanho, na ordem da camisa.                                                                                  |
| `entry/EntryBackdrop`, `PlayerTiles`                                          | Fundo da entrada e a escolha do jogador.                                                                                                                      |
| `awards/Ceremony`, `ShareCardPanel`, `share-card.ts`                          | Premiação da noite (revelações e pôster final) e card compartilhável.                                                                                         |

Regra: um problema visual, um componente. Antes de criar outro, veja se uma
variante de um existente resolve.

## Ranking: geral neutro, coroa nos scouts

No ranking, todos os jogadores têm o mesmo tratamento: mesma foto, mesmo
tamanho, mesma linha. A ordem e o número da posição dizem quem está à frente.
Estar em 1º por uma métrica não faz de ninguém "o melhor do clube", então não
há painel, foto maior, selo nem barra de comparação para o líder.

A única exceção é a **coroa**: nas abas de scout (Gols, Assistências e G/A),
quem tem o maior valor ganha um ícone pequeno de coroa sobre a foto. É só o
ícone; a linha continua igual às outras. Empatados no topo recebem todos, e
com todos zerados ninguém recebe. Geral, Nota VFC e Goleiros não têm coroa.

Destaque visual maior (faixa, moldura amarela, retrato grande) é reservado
para prêmio e conquista: Artilheiro, Assistente, Craque da Noite e Destaque do
Rush.

## Navegação

- **Desktop**: barra superior com escudo, Início, Ranking e Partidas; à direita,
  Gameplay e Admin (só para quem pode) e a conta.
- **Celular**: barra superior enxuta (escudo e conta) e barra inferior com
  Início, Ranking, Partidas e Perfil. Quem opera a gameplay tem o botão dela no
  centro, em hexágono; com a gameplay aberta, ele indica "Ao vivo".
- Sem navegação: a entrada do clube e a premiação (telas cheias). No registro
  de partida, a barra inferior dá lugar aos botões da etapa.
- Ranking e perfil não têm esqueleto de carregamento: a tela atual fica até a
  nova chegar (a linha tocada fica marcada), para as linhas deslizarem e o
  retrato viajar sem interrupção.

Os atalhos de admin são só atalhos. A permissão é conferida no servidor em cada
página e em cada ação.

## Gameplay ao vivo

Com uma gameplay aberta, a Home e o painel da gameplay abrem com o modo ao
vivo: sinal de "em andamento", relógio correndo, fita de partidas e os números
de cada jogador na noite.

Quem está assistindo vê os dados em dia sem consulta periódica: a tela busca de
novo só quando a pessoa volta para a aba do app ou reentra na Home ou na
Gameplay (`LiveRefresh`). O que mudou pisca (`FlashValue`) e a partida nova
entra no fim da fita. Não há polling nem WebSocket.

## Entrada do clube

A entrada (`/entrar`) é montada em camadas, em `entry/backdrop.tsx`:

1. foto do elenco;
2. tratamento da foto (menos cor, mais contraste, mais escura);
3. véu azul-marinho;
4. degradê que fecha em azul sólido embaixo, onde ficam os jogadores;
5. logo, "Escolha seu jogador" e os retratos.

Para colocar a foto: salve em `public/brand/elenco.webp` e preencha a
constante `TEAM_PHOTO` no topo de `entry/backdrop.tsx` (caminho e ponto
focal). Nada mais muda. Foto horizontal, com pelo menos 2400px de largura e os
jogadores no terço de cima. Sem a foto, as mesmas camadas dão um fundo azul
simples.

## Card compartilhável

O card do prêmio (1080 × 1920, formato de story) é desenhado no próprio
aparelho, em um `<canvas>`, com a foto real, o logo e as cores dos tokens. Não
depende de servidor nem de biblioteca. "Compartilhar" abre a folha do aparelho
(WhatsApp, Instagram) quando ela existe; senão, baixa a imagem.

Se a foto do jogador estiver em outro endereço que não permita o uso no
canvas, o card sai com o número da camisa no lugar da foto.
