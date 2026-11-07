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
- Cada visão em `src/views` lê apenas de `core` e `filters`. As visões não importam umas das outras.
- Componentes compartilhados e tokens de tema ficam em `src/ui`.
- A nuvem só é acessada pelo adaptador de nuvem em `src/storage`. Nenhum outro módulo fala com o Supabase.

## Temas

- Nunca escreva uma cor direto num componente. Use um token de tema.
- Confira toda tela nova no claro e no escuro.

## Celular

- Desenhe primeiro a tela pequena, depois alargue.
- Mantenha os alvos de toque confortáveis e evite ações que só existem ao passar o mouse.
- Toda ação de arrastar e soltar precisa de uma alternativa por toque.

## Texto de interface

- Evite travessões desnecessários (travessão e meia-risca) nos textos da interface. Prefira vírgulas, pontos e dois-pontos.
- Quando os textos estiverem centralizados, um teste deve varrer as strings da interface atrás desses caracteres.

## Sincronização e segurança

- Toda entidade tem um UUID gerado no dispositivo e os campos `createdAt`, `updatedAt` e `deletedAt`. Excluir preenche `deletedAt` e nunca remove o registro.
- A segurança por linha deve estar ligada em toda tabela da nuvem. Um teste deve provar que uma conta não consegue ler as linhas de outra.
- Nunca faça commit de segredos. Só a URL pública e a chave anônima do Supabase podem aparecer no cliente, e apenas porque a segurança por linha protege os dados.
- O modo visitante nunca pode falar com a nuvem.

## Testes e qualidade

Scripts planejados, confirmados na entrega 1:

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
- Salvaguardas: uma varredura dos textos da interface atrás de travessões e meias-riscas, uma checagem de que o modo visitante não faz nenhuma requisição de rede, e o teste de segurança por linha contra um projeto de teste do Supabase, nunca contra dados reais.
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
