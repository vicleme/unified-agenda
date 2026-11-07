# Acompanhamento do projeto

Arquivo de trabalho em português, para retomar o desenvolvimento sem depender do histórico de uma conversa. Ele não tem versão em inglês. O estado oficial das decisões está em [roadmap](pt-BR/roadmap.md) e [modelo de dados](pt-BR/data-model.md).

## Como retomar (instruções para o assistente)

Ao receber o zip do repositório e o pedido para continuar:

1. Ler este arquivo, o `README.pt-BR.md`, `docs/pt-BR/roadmap.md`, `docs/pt-BR/data-model.md` e `docs/pt-BR/contributing.md`.
2. Seguir a próxima entrega indicada em "Estado atual", sem refazer decisões já tomadas.
3. Ao terminar, atualizar "Estado atual" e o "Registro de sessões" neste arquivo.
4. Devolver um zip só com os arquivos que mudaram, para o dono colar por cima do projeto.

Convenções do projeto:

- Responder em português do Brasil. Código, commits, README oficial e nomes de arquivos em inglês.
- Commits no formato Conventional Commits, em inglês, com resumo e descrição em campos separados. É uma convenção para ter em mente, sem hooks que barrem commits, e o dono pode juntar várias entregas num commit só.
- Todo documento tem versão en e pt-BR, linkadas entre si. Este arquivo é a exceção.
- Evitar travessões e meias-riscas nos textos da interface, na documentação e nas respostas.
- Cores só por tokens de tema, claro e escuro. Telas pequenas primeiro, e toda ação de arrastar tem alternativa por toque.
- Rodar só testes direcionados no ambiente do assistente (por exemplo `npx vitest related <arquivos> --run` ou `npx vitest run <pasta>`). A suíte completa e o `npm run check` ficam com o dono, na máquina dele, que é mais rápida. Ao entregar, informar quais testes foram rodados e o que ficou para o dono rodar.
- Explicações técnicas bem mastigadas, com analogias e cada termo definido antes de ser usado.

## Estado atual

- **Entrega 0 (repositório e documentação):** concluída.
- **Próxima entrega:** 1, o core com armazenamento local. Ainda não iniciada.
- **Commit inicial:** a registrar aqui quando for feito.
- **Nome do repositório:** `unified-agenda`. Hospedagem prevista: Netlify. Nuvem prevista: Supabase, na entrega 7.

## Decisões vigentes

Resumo, com os detalhes nos documentos oficiais:

- Um único tipo de item (evento ou tarefa), recursivo e sem limite de profundidade.
- Etiquetas em árvore com escopo (globais ou restritas a uma ou mais agendas).
- Períodos do dia calculados: madrugada, manhã, tarde e noite.
- Três lentes: Linha do Tempo, calendário e Kanban.
- Local-first, com modo visitante local e contas aprovadas com sincronização na entrega 7.
- Stack: TypeScript, Vite e React, com `core`, `filters`, `storage` e `sync` sem framework.
- Plano gratuito obrigatório: poucos deploys de produção no Netlify, sem Functions, e Supabase dentro do plano gratuito.

## Próximos passos (entrega 1)

1. Criar o projeto com Vite, React e TypeScript, e confirmar as versões das bibliotecas planejadas (Dexie, Vitest e as demais).
2. Definir os tokens de tema e a alternância claro, escuro e automático.
3. Escrever os modelos do `core` (agenda, item, etiqueta, status) com `id`, `createdAt`, `updatedAt` e `deletedAt`.
4. Implementar o armazenamento local em IndexedDB e a exportação e importação em JSON.
5. Montar a estrutura responsiva (celular primeiro) e as telas básicas de criar e editar agendas e itens.
6. Configurar Vitest, Testing Library, Prettier e ESLint, com os scripts do `package.json` (`test`, `test:watch`, `typecheck`, `lint`, `format`, `format:check` e `check`), e escrever os primeiros testes do `core` e do `storage`.

## Pendências abertas

- Reaproveitar a configuração de Prettier que o dono já usa em outros projetos.
- Status opcional para eventos.
- Modos de exibição dos subitens por visão.
- Cadastro só pelo dono ou formulário de pedido de acesso.
- Conferir, ao criar o projeto no Supabase, se há pedido de cartão ou cobrança por estouro.

## Registro de sessões

- **2026-11-07:** posicionamento definido, pesquisa de ferramentas existentes, stack escolhida, planos gratuitos do Netlify e do Supabase conferidos, documentação atualizada, este arquivo criado, estratégia de testes e qualidade registrada, decisão de não usar hooks de commit e zip completo do repositório entregue.
