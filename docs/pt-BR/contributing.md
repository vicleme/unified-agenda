# Como contribuir

[English](../en/contributing.md) | [Voltar ao README](../../README.pt-BR.md)

## Commits

Use [Conventional Commits](https://www.conventionalcommits.org/pt-br/), escritos em inglês.

```
feat(core): add recursive item model
fix(timeline): keep the Today button visible on small screens
docs: translate the roadmap to pt-BR
chore: initial project scaffold
```

Tipos comuns: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `style`.

## Modularidade

- `src/core` não pode importar de nenhuma visão, de `ui`, de `storage` nem de `sync`.
- `core`, `filters`, `storage` e `sync` ficam sem framework (TypeScript puro, sem React).
- Cada visão lê apenas de `core` e `filters` para as regras dela. Uma visão que também precisa ler ou gravar dados guardados fica em `src/ui` e passa pelos hooks de dados (`useData`, `useItems` e os outros), como a Linha do Tempo faz hoje. As visões não importam umas das outras. Quando o calendário e o Kanban chegarem, a Linha do Tempo pode ir para `src/views/timeline` se aparecer um jeito limpo de compartilhar esses hooks.
- Componentes compartilhados e tokens de tema ficam em `src/ui`.
- `src/core` e as outras pastas sem framework não podem importar React, e o `core` não pode importar de `ui`, `views`, `storage` ou `sync`. O ESLint garante isso.
- A nuvem só é acessada pelo adaptador de nuvem em `src/storage`. Nenhum outro módulo fala com o Supabase.

## Temas

- Nunca escreva uma cor direto num componente. Use um token de tema.
- Confira toda tela nova no claro e no escuro.

## Celular

- Desenhe primeiro a tela pequena, depois alargue.
- Mantenha os alvos de toque confortáveis e evite ações que só existem ao passar o mouse.
- Toda ação de arrastar e soltar precisa de uma alternativa por toque.
- Quando uma lista repete a mesma ação em cada linha, mostre um texto curto no botão (Editar, Mover) e deixe o nome completo, com o item, no `aria-label`. A linha fica compacta e o leitor de tela continua sabendo para qual item o botão serve.

## Texto de interface

- Evite travessões desnecessários (travessão e meia-risca) nos textos da interface. Prefira vírgulas, pontos e dois-pontos.
- Todo texto de interface fica em `src/ui/i18n/messages`, um arquivo por idioma. Nunca escreva texto visível direto num componente.
- O inglês (`en.ts`) é a referência. Um texto novo entra em todos os idiomas na mesma mudança. O compilador do TypeScript falha quando um idioma esquece uma chave, e um teste confere que todos os idiomas têm as mesmas chaves, sem nenhuma vazia.
- Um teste varre as mensagens de cada idioma atrás de travessões e meias-riscas.
- Os componentes leem os textos por `useI18n()`. Os nomes dos idiomas ficam na própria língua (Português, English).
- Datas, horas e números usarão `Intl` com o idioma ativo, nunca formatos escritos à mão.

## Datas e fusos horários

- Itens com horário são guardados como instantes em UTC. Itens de dia inteiro são datas simples `AAAA-MM-DD`, sem fuso.
- Nunca use `getHours()`, `getDate()`, `toLocaleString()` e métodos parecidos no `core`, porque dependem do fuso do aparelho. Use os auxiliares de `src/core/zone.ts` e passe o fuso como parâmetro.
- Teste os casos de borda: o dia em que o relógio muda, um item que atravessa a meia-noite e o mesmo instante em dois fusos.

## Armazenamento local

- Nunca edite uma versão do banco que já foi publicada. Uma mudança de esquema acrescenta `db.version(n + 1)` com os novos índices e um passo `.upgrade()` que move os dados antigos.
- Indexe só campos usados em consulta. As datas ficam sem índice e as visões filtram na memória com o `core`.
- Exclua marcando `deletedAt`. Nunca remova um registro fora de uma importação em modo substituir.
- `src/storage` importa o `core`, nunca React, `ui` ou `views`. Os testes usam `fake-indexeddb` e dão a cada teste um nome de banco próprio.
- Tudo o que vem de um arquivo ou do armazenamento é conferido antes de ser aceito. O leitor de backup recusa o arquivo inteiro no primeiro campo errado, e campos desconhecidos são descartados.

## Sincronização e segurança

- Toda entidade tem um UUID gerado no dispositivo e os campos `createdAt`, `updatedAt` e `deletedAt`. Excluir preenche `deletedAt` e nunca remove o registro.
- A segurança por linha deve estar ligada em toda tabela da nuvem. Um teste deve provar que uma conta não consegue ler as linhas de outra.
- Nunca faça commit de segredos. Só a URL pública e a chave anônima do Supabase podem aparecer no cliente, e apenas porque a segurança por linha protege os dados.
- O modo visitante nunca pode falar com a nuvem.

## Testes e qualidade

Scripts, disponíveis desde a entrega 1a:

| Script | O que faz |
| --- | --- |
| `npm test` | Roda a suíte completa de testes uma vez (Vitest). |
| `npm run test:watch` | Roda de novo os testes afetados a cada salvamento. |
| `npm run typecheck` | Roda o compilador do TypeScript sem gerar arquivos. |
| `npm run lint` | Roda o ESLint. |
| `npm run format` | Formata o código com o Prettier. |
| `npm run format:check` | Confere a formatação sem alterar arquivos. |
| `npm run check` | Roda typecheck, lint, conferência de formato e testes, nesta ordem. |

Execuções direcionadas, para retorno rápido durante uma iteração:

```
npx vitest run tests/core
npx vitest related src/core/item.ts --run
```

O segundo comando roda só os testes que dependem dos arquivos indicados.

O que testar:

- `core` e `filters`: testes unitários das regras puras, como herança de escopo das etiquetas, períodos do dia, progresso recursivo e filtros. É onde fica a maior parte da cobertura.
- `storage` e `sync`: testes unitários contra um IndexedDB falso, incluindo o último a escrever vence e as lápides.
- Visões: testes de componente com Testing Library para as interações principais, incluindo a alternativa por toque a cada ação de arrastar.
- Testes de tela que renderizam o provider de dados (`renderApp` em `tests/helpers.tsx`) deixam o provider assentar antes de o banco de teste fechar, o que mantém o terminal livre de avisos de `act(...)`. Um teste que termina logo depois de renderizar pode chamar `settleApp(db)` por conta própria.
- Salvaguardas: uma varredura das mensagens de todos os idiomas da interface atrás de travessões e meias-riscas, a conferência de que todos os idiomas têm as mesmas chaves, uma checagem de que o modo visitante não faz nenhuma requisição de rede, e o teste de segurança por linha contra um projeto de teste do Supabase, nunca contra dados reais.
- Testes ponta a ponta com Playwright são uma opção para depois, rodados na máquina do dono.

Não há hooks de commit. Conventional Commits é uma convenção para ter em mente, e não uma regra imposta por ferramentas, e um commit pode juntar várias pequenas entregas.

Combinado de trabalho: nas sessões com o assistente rodam só os testes direcionados. A suíte completa e o `npm run check` rodam na máquina do dono antes de cada commit.

## Hospedagem e plano gratuito

- Trabalhe em branches. Faça merge na `main` só quando uma entrega estiver pronta, porque cada deploy de produção no Netlify consome créditos e os deploys de branch são grátis.
- Não adicione Netlify Functions, bancos de dados do Netlify nem recursos de IA. Não registre domínios pelo Netlify.
- Confira os termos atuais do plano gratuito ao criar um novo projeto no Netlify ou no Supabase.

## Documentação

- O README oficial é em inglês. Todo documento tem versão pt-BR, e cada par linka o outro.
- Ao mudar um documento, mude a tradução no mesmo commit, ou registre a tradução pendente no pull request.
- A exceção é o [docs/progress.md](../progress.md), um registro de trabalho em português que não tem versão em inglês.
