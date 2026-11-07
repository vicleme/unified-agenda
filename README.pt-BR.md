# Unified Agenda

> Um item, várias lentes, tudo local.

[English](README.md) | **Português (Brasil)**

Uma agenda web local-first em que eventos e tarefas são a mesma coisa. Você enxerga esse único item por várias lentes: uma Linha do Tempo com rolagem dia após dia, um calendário e um quadro Kanban. Funciona no computador e no celular, e contas aprovadas podem sincronizar entre dispositivos.

**Status:** em planejamento. Ainda não há código da aplicação. Veja o [roteiro](docs/pt-BR/roadmap.md).

## Por que isto existe

Existem ótimas ferramentas para cada pedaço desta ideia, mas cada pedaço mora em um produto diferente:

- Alguns apps mostram eventos e tarefas com data numa mesma lista, mas dão pouca estrutura interna à tarefa.
- Alguns oferecem várias visões sobre os mesmos dados, mas são bancos de dados genéricos, não agendas.
- Alguns têm etiquetas e subtarefas aninhadas, mas limitam a profundidade ou deixam as melhores visões no plano pago.
- Alguns guardam seus dados no seu dispositivo, mas têm poucas visões e pouca organização.

O objetivo aqui é uma receita só: **um modelo de item, várias lentes por cima, e seus dados sob o seu controle**. O diferencial é a combinação, e não uma visão isolada.

## Destaques

- **Evento e tarefa são a mesma coisa.** Os dois têm início e fim (data e hora). Uma tarefa também pode existir sem data.
- **Aninhamento sem limite.** Todo subitem é um item completo (datas, etiquetas, status), em qualquer profundidade. A lista de marcação é só o caso leve.
- **Etiquetas em árvore, com escopo.** As etiquetas formam uma árvore (por exemplo Cuidado, depois Jardinagem, depois Regas). Cada etiqueta é global ou restrita a uma ou mais agendas. Filtrar por um pai inclui os descendentes.
- **Períodos do dia.** Filtre por madrugada, manhã, tarde e noite. Os períodos são calculados a partir dos horários, e não armazenados.
- **Seleção e agrupamento de agendas.** Mostre todas, nenhuma ou um conjunto escolhido, em grupos, misturadas ou lado a lado. Salve combinações como visões com nome.
- **Três lentes.** Linha do Tempo (rolagem contínua, dia após dia), calendário (dia, semana, mês) e Kanban (grupos e colunas personalizáveis, arrastar e soltar).
- **Itens completos.** Anotações (Markdown), local, links e lista de marcação.
- **Temas claro, escuro e automático.**
- **Bom no celular.** Pensado para telas pequenas e toque desde a primeira entrega.
- **Local-first, com sincronização opcional.** Os dados ficam no seu dispositivo (IndexedDB), com exportação e importação em JSON. O modo visitante não exige conta e nunca fala com servidor. Contas aprovadas também sincronizam entre web e celular.

## Princípios

- **Modular.** O `core` não conhece nenhuma visão. Cada visão só lê o `core`.
- **Tokens, e não cores soltas.** Toda cor vem de um token de tema, então os dois temas funcionam em qualquer lugar.
- **Telas pequenas primeiro.** Os layouts partem do celular e crescem, e toda ação de arrastar tem uma alternativa por toque.
- **Texto de interface simples.** Os textos da interface evitam travessões desnecessários. A pontuação deve ser simples e natural.
- **Funciona sem servidor.** O modo visitante roda inteiro no navegador. A nuvem é opcional e só serve para sincronizar.
- **Grátis para manter.** O projeto é desenhado para ficar dentro dos planos gratuitos e evita recursos que consomem créditos, como funções serverless.

## Stack (planejada)

Versões e bibliotecas são confirmadas na entrega 1.

| Área | Escolha |
| --- | --- |
| Linguagem | TypeScript |
| Build | Vite |
| Interface | React (o `core`, `filters`, `storage` e `sync` ficam sem framework) |
| Dados locais | IndexedDB com Dexie |
| Arrastar e soltar | dnd-kit |
| Listas longas | TanStack Virtual |
| Testes | Vitest e Testing Library |
| Qualidade | Prettier, ESLint e o compilador do TypeScript |
| Nuvem, opcional | Supabase (Postgres e Auth) |
| Hospedagem | Netlify, como site estático |

## Estrutura do repositório

```
.
├── README.md                 oficial, inglês
├── README.pt-BR.md           português, linkado nos dois sentidos
├── LICENSE
├── CHANGELOG.md
├── docs/
│   ├── en/                   data-model, roadmap, contributing
│   └── pt-BR/                os mesmos arquivos, traduzidos
├── src/
│   ├── core/                 itens, agendas, etiquetas, status e regras
│   ├── storage/              adaptadores local (IndexedDB) e nuvem, importação e exportação JSON
│   ├── sync/                 regras de mesclagem entre dispositivo e nuvem
│   ├── filters/              agenda, etiqueta, período do dia, texto
│   ├── views/
│   │   ├── timeline/
│   │   ├── calendar/
│   │   └── kanban/
│   └── ui/                   componentes compartilhados e tokens de tema
└── tests/
```

## Documentação

- [Modelo de dados](docs/pt-BR/data-model.md)
- [Roteiro](docs/pt-BR/roadmap.md)
- [Como contribuir](docs/pt-BR/contributing.md)

## Licença

MIT. Veja o [LICENSE](LICENSE).
