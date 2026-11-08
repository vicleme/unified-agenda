# Unified Agenda

> Um item, várias lentes, tudo local.

[English](README.md) | **Português (Brasil)**

Uma agenda web local-first em que eventos e tarefas são a mesma coisa. Você enxerga esse único item por várias lentes: uma Linha do Tempo com rolagem dia após dia, um calendário e um quadro Kanban. Funciona no computador e no celular, e contas aprovadas podem sincronizar entre dispositivos.

**Status:** as entregas 1 (core com armazenamento local), 2 (Linha do Tempo), 3 (etiquetas e filtros) e 4 (seleção de agendas, grupos, disposição e visões salvas) estão concluídas. Já dá para criar e editar agendas, eventos, tarefas e subitens, escolher o fuso de exibição e os períodos do dia, e guardar tudo num backup JSON. A Linha do Tempo rola dia após dia, mostra as tarefas em aberto e as atrasadas em cada dia e deixa marcar uma tarefa como feita direto na linha dela. As etiquetas formam uma árvore com escopo, e a Linha do Tempo tem um painel de filtros (texto, tipo, período do dia, etiquetas e "vence em até N dias"). O mesmo painel escolhe quais agendas mostrar (por agenda ou por grupo), organiza cada dia misturado, por agenda ou por grupo, e guarda suas combinações favoritas como visões salvas com nome, lembradas enquanto você troca de aba. O calendário e o Kanban ainda são telas vazias e vêm a seguir. Veja o [roteiro](docs/pt-BR/roadmap.md).

## Por que isto existe

Existem ótimas ferramentas para cada pedaço desta ideia, mas cada pedaço mora em um produto diferente:

- Alguns apps mostram eventos e tarefas com data numa mesma lista, mas dão pouca estrutura interna à tarefa.
- Alguns oferecem várias visões sobre os mesmos dados, mas são bancos de dados genéricos, não agendas.
- Alguns têm etiquetas e subtarefas aninhadas, mas limitam a profundidade ou deixam as melhores visões no plano pago.
- Alguns guardam seus dados no seu dispositivo, mas têm poucas visões e pouca organização.

O objetivo aqui é uma receita só: **um modelo de item, várias lentes por cima, e seus dados sob o seu controle**. O diferencial é a combinação, e não uma visão isolada.

## Destaques

- **Evento e tarefa são a mesma coisa.** Um evento tem início e fim (data e hora). Uma tarefa tem uma janela, do dia em que foi passada até a entrega, então ela fica visível em todos os dias em que você está vivendo com ela. Uma tarefa também pode existir sem data, e você pode reservar blocos de trabalho para ela.
- **Aninhamento sem limite.** Todo subitem é um item completo (datas, etiquetas, status), em qualquer profundidade. A lista de marcação é só o caso leve.
- **Etiquetas em árvore, com escopo.** As etiquetas formam uma árvore (por exemplo Cuidado, depois Jardinagem, depois Regas). Cada etiqueta é global ou restrita a uma ou mais agendas. Filtrar por um pai inclui os descendentes.
- **Períodos do dia.** Filtre por madrugada, manhã, tarde e noite. Os períodos são calculados a partir dos horários, e não armazenados.
- **Seleção e agrupamento de agendas.** Mostre todas, nenhuma ou um conjunto escolhido, em grupos, misturadas ou lado a lado. Salve combinações como visões com nome.
- **Três lentes.** Linha do Tempo (rolagem contínua, dia após dia, com botão para marcar tarefas como feitas e desfazer), calendário (dia, semana, mês) e Kanban (grupos e colunas personalizáveis, arrastar e soltar).
- **Itens completos.** Anotações (Markdown), local, links e lista de marcação.
- **Temas claro, escuro e automático.**
- **Bom no celular.** Pensado para telas pequenas e toque desde a primeira entrega.
- **Local-first, com sincronização opcional.** Os dados ficam no seu dispositivo (IndexedDB), com exportação e importação em JSON. O modo visitante não exige conta e nunca fala com servidor. Contas aprovadas também sincronizam entre web e celular.

## Princípios

- **Modular.** O `core` não conhece nenhuma visão. Cada visão só lê o `core`.
- **Tokens, e não cores soltas.** Toda cor vem de um token de tema, então os dois temas funcionam em qualquer lugar.
- **Telas pequenas primeiro.** Os layouts partem do celular e crescem, e toda ação de arrastar tem uma alternativa por toque.
- **Texto de interface simples.** Os textos da interface evitam travessões desnecessários. A pontuação deve ser simples e natural.
- **Dois idiomas de interface.** A interface existe em português (Brasil) e em inglês, escolhida automaticamente pelo navegador e que pode ser trocada a qualquer momento.
- **Funciona sem servidor.** O modo visitante roda inteiro no navegador. A nuvem é opcional e só serve para sincronizar.
- **Grátis para manter.** O projeto é desenhado para ficar dentro dos planos gratuitos e evita recursos que consomem créditos, como funções serverless.

## Stack (planejada)

As versões das ferramentas foram confirmadas na entrega 1a: React 19, Vite 8, TypeScript 6.0, Vitest 5, ESLint 10 e Prettier 3. O TypeScript fica na 6.0 porque o typescript-eslint ainda não suporta a 6.1 ou mais nova. O Dexie está confirmado (4.4.7). O dnd-kit é confirmado quando for usado pela primeira vez. O TanStack Virtual ficou de fora da Linha do Tempo de propósito (veja o roteiro) e continua como opção se as listas longas pesarem.

| Área | Escolha |
| --- | --- |
| Linguagem | TypeScript |
| Build | Vite |
| Interface | React (o `core`, `filters`, `storage` e `sync` ficam sem framework) |
| Dados locais | IndexedDB com Dexie |
| Arrastar e soltar | dnd-kit |
| Listas longas | Rolagem simples, com dias vazios dobrados (TanStack Virtual só se precisar) |
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
├── package.json              scripts e dependências
├── index.html, vite.config.ts, netlify.toml
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

## Como rodar

Você precisa do Node.js 20.19 ou mais novo (ou 22.12 ou mais novo).

```
npm install
npm run dev
```

`npm run check` roda a checagem de tipos, o linter, a conferência de formato e todos os testes. Os dados ficam no seu navegador (IndexedDB). Use o botão Gerenciar para criar agendas e itens, e a aba Backup para salvar ou restaurar tudo.

## Documentação

- [Modelo de dados](docs/pt-BR/data-model.md)
- [Roteiro](docs/pt-BR/roadmap.md)
- [Como contribuir](docs/pt-BR/contributing.md)

## Licença

MIT. Veja o [LICENSE](LICENSE).
