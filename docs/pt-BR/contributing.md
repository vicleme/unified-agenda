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

- `src/core` não pode importar de nenhuma visão, de `ui` nem de `storage`.
- Cada visão em `src/views` lê apenas de `core` e `filters`. As visões não importam umas das outras.
- Componentes compartilhados e tokens de tema ficam em `src/ui`.

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

## Documentação

- O README oficial é em inglês. Todo documento tem versão pt-BR, e cada par linka o outro.
- Ao mudar um documento, mude a tradução no mesmo commit, ou registre a tradução pendente no pull request.
