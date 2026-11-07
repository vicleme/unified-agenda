# Roteiro

[English](../en/roadmap.md) | [Voltar ao README](../../README.pt-BR.md)

Cada entrega termina em algo utilizável. Toda entrega precisa funcionar no celular tanto quanto no computador.

## Entregas

| # | Entrega | O que você já consegue usar |
| --- | --- | --- |
| 0 | Repositório: estrutura, READMEs em en e pt-BR, LICENSE, convenções | Uma base pronta com o primeiro commit |
| 1 | Core: agendas, itens recursivos (início e fim, anotações, local, links), armazenamento local, tokens de tema e temas claro, escuro e automático, estrutura responsiva | Criar e editar tudo, ainda sem visões elaboradas |
| 2 | **Linha do Tempo**: rolagem contínua nos dois sentidos, um bloco por dia, marcas de "continua" para itens de vários dias, dias vazios recolhíveis, faixa de atrasados, botão Hoje | Rolar seus dias, com eventos e entregas juntos |
| 3 | Etiquetas em árvore com escopo, e filtros (agenda, etiqueta, tipo, período do dia, texto) | Organizar e filtrar |
| 4 | Seleção de agendas, grupos, disposição (misturadas, separadas, agrupadas) e visões salvas | A flexibilidade de escolher o que você vê |
| 5 | Calendário (dia, semana, mês) | A visão clássica, já com os filtros |
| 6 | Kanban com grupos e colunas personalizáveis, arrastar e soltar com suporte a toque | Mover cartões entre colunas |
| 7 | Integração (caixa de entrada, arrastar para agendar), recorrência, lembretes | Refinamentos |
| 8 | Exportar e importar JSON e .ics, PWA instalável, uso offline | Portabilidade e instalação no celular |

## Notas sobre celular e toque

- Os layouts partem do celular e crescem. Os alvos de toque ficam confortáveis.
- A Linha do Tempo é a visão natural do celular, por ser uma coluna única que rola.
- No celular o Kanban mostra uma coluna por vez, com deslize entre as colunas.
- Toda ação de arrastar e soltar tem uma alternativa por toque, como um menu "Mover para".
- O PWA instalável chega na entrega 8, mas o layout responsivo é exigido desde a entrega 1.

## Decisões tomadas

- **Local-first:** dados no navegador, com exportação e importação em JSON.
- **Períodos do dia:** a madrugada (00h a 06h) é o quarto período, junto com manhã, tarde e noite.
- **Posicionamento:** um item, várias lentes, tudo local.
- **Itens que atravessam períodos:** aparecem em todos os períodos que tocam.
- **Tarefas sem data:** permitidas.
- **Texto de interface:** evitar travessões desnecessários.

## Decisões em aberto

- Stack de tecnologia. Esta decisão desbloqueia a entrega 1. A inclinação é por ferramentas leves, em linha com o princípio de não depender de nada externo.
- Status opcional para eventos (a inclinação atual é que sim).
- Modos de exibição dos subitens por visão (aninhados, achatados, só os pais).

## Ideias para depois

- Alternância automática de conjuntos de agendas por horário.
- Sincronização opcional sem servidor do projeto, por exemplo WebDAV.
