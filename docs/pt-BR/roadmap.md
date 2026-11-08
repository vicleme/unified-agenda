# Roteiro

[English](../en/roadmap.md) | [Voltar ao README](../../README.pt-BR.md)

Cada entrega termina em algo utilizável. Toda entrega precisa funcionar no celular tanto quanto no computador. Tudo até a entrega 6 roda inteiro no dispositivo, então você pode usar o app de verdade antes de as contas chegarem.

Estado atual: as entregas 0, 1, 2, 3 e 4 estão concluídas. A entrega 5, o calendário, é a próxima.

## Entregas

| # | Entrega | O que você já consegue usar |
| --- | --- | --- |
| 0 | Repositório: estrutura, READMEs em en e pt-BR, LICENSE, convenções | Uma base pronta com o primeiro commit |
| 1 | Core: agendas, itens recursivos (eventos com agendamento, tarefas com janela de início até a entrega, blocos de trabalho, anotações, local, links), armazenamento local (IndexedDB), exportar e importar JSON, tokens de tema com temas claro, escuro e automático, fusos horários, estrutura responsiva, interface em português e inglês, testes e scripts de qualidade (Vitest, Prettier, ESLint). O modelo já nasce preparado para sincronizar (UUIDs, `updatedAt`, `deletedAt`) | Criar e editar tudo, ainda sem visões elaboradas |
| 2 | **Linha do Tempo**: rolagem contínua nos dois sentidos, um bloco por dia, marcas de "continua" para itens de vários dias, dias vazios recolhíveis, faixa de tarefas em aberto em cada dia da janela da tarefa, faixa de atrasados, botão Hoje, seletor de data, botão Voltar ao topo e botão Feita nas tarefas, com Desfazer | Rolar seus dias, com eventos e entregas em aberto juntos |
| 3 | Etiquetas em árvore com escopo, e filtros (etiqueta, tipo, período do dia, texto, vence em até N dias). O filtro por agenda vem com a seleção de agendas da entrega 4 | Organizar e filtrar |
| 4 | Seleção de agendas, grupos, disposição (misturadas, separadas, agrupadas) e visões salvas | A flexibilidade de escolher o que você vê |
| 5 | Calendário (dia, semana, mês) | A visão clássica, já com os filtros |
| 6 | Kanban com grupos e colunas personalizáveis, arrastar e soltar com suporte a toque | Mover cartões entre colunas |
| 7 | **Contas e sincronização**: login com Supabase e cadastro fechado, modo visitante totalmente local, importação dos dados locais para a conta, sincronização com o último a escrever vence, testes de segurança por linha | A mesma agenda na web e no celular |
| 8 | Integração (caixa de entrada, arrastar para agendar), recorrência (blocos de trabalho que se repetem até a entrega, e tarefas que se repetem), lembretes | Refinamentos |
| 9 | Exportar e importar .ics, PWA instalável, uso offline | Portabilidade e instalação no celular |

## Notas sobre celular e toque

- Os layouts partem do celular e crescem. Os alvos de toque ficam confortáveis.
- A Linha do Tempo é a visão natural do celular, por ser uma coluna única que rola.
- No celular o Kanban mostra uma coluna por vez, com deslize entre as colunas.
- Toda ação de arrastar e soltar tem uma alternativa por toque, como um menu "Mover para".
- O PWA instalável chega na entrega 9, mas o layout responsivo é exigido desde a entrega 1.

## Regras de hospedagem e plano gratuito

O projeto não pode gerar gasto. Regras que decorrem dos planos gratuitos, conforme a documentação de novembro de 2026:

- **Netlify (site estático):** o plano gratuito dá 300 créditos por mês, divididos entre todos os sites da conta. Um deploy de produção custa 15 créditos, o tráfego custa 20 créditos por GB, e Deploy Previews e deploys de branch não custam nada. Quando os créditos acabam, os sites são pausados.
- Trabalhe em branches e faça merge na `main` (que publica em produção) só quando uma entrega estiver pronta. Cerca de 10 deploys de produção por mês é um orçamento seguro.
- Não use Netlify Functions, bancos de dados do Netlify nem recursos de IA, porque consomem créditos. Não registre domínios pelo Netlify. O endereço `netlify.app` basta.
- **Supabase (sincronização na nuvem):** o plano gratuito dá 500 MB de banco por projeto, 50 mil usuários ativos por mês e 5 GB de tráfego por mês. Um projeto gratuito é pausado após 7 dias de pouca atividade e pode ser retomado pelo painel. Como o app é local-first, ele continua funcionando no dispositivo enquanto o projeto está pausado.
- O modo visitante nunca fala com o Supabase, então visitantes não consomem a cota. O cadastro fica fechado, então só contas aprovadas gravam dados.

Confira os termos atuais ao criar cada projeto, porque os planos gratuitos mudam.

## Decisões tomadas

- **Rolagem da Linha do Tempo:** a página rola inteira e carrega mais 14 dias perto de cada ponta, sem virtualização da lista (o TanStack Virtual não foi instalado). Os blocos têm alturas diferentes, inserir dias em cima é mais simples com ancoragem manual da rolagem, e dias vazios em sequência viram uma linha só, então o número de blocos fica pequeno. Reavaliar se a rolagem pesar com meses de dados.
- **Marcar tarefa como feita na Linha do Tempo:** o botão dá à tarefa o primeiro status (por ordem) do primeiro grupo de concluídos, e uma mensagem com Desfazer devolve o status anterior por alguns segundos. Sem nenhum status de concluído, o botão não aparece.
- **Filtros da Linha do Tempo:** o painel edita um `ItemFilter` de dados puros e a tela aplica em dois passos: etiqueta, tipo e texto cortam os itens primeiro (a herança de etiquetas olha a lista inteira), depois o período do dia e o "vence em até N dias" cortam cada dia montado. Um período do dia mantém os eventos com horário que o tocam, "Sem hora marcada" mantém eventos de dia inteiro e as faixas de tarefa, e a faixa de atrasadas nunca é cortada pelo "vence em até". O filtro, como a seleção de agendas e a disposição, fica guardado no shell do app, então sobrevive à troca de aba (veja as visões salvas abaixo). No celular o painel é uma folha sobre a tela, em tela larga é um cartão dentro da barra fixa.
- **Seleção de agendas e disposição (entrega 4):** as duas ficam no painel de filtros. Uma agenda escondida conta como mais um filtro, já a disposição (misturadas, separadas ou agrupadas) não esconde nada e não entra na contagem. "Todas as agendas" é guardado como `null`, então as agendas criadas depois aparecem sozinhas. Grupos são atalhos e nunca são salvos.
- **Visões salvas (entrega 4):** uma visão guarda o filtro, as agendas à mostra e a disposição. Escolher uma aplica tudo, e mexer em qualquer controle depois mantém a visão ativa, mas marcada como "alterada", com Atualizar e Restaurar à mão. As visões são gerenciadas dentro do painel de filtros (salvar, atualizar, restaurar, renomear, reordenar, excluir) e são só da Linha do Tempo até o calendário e o Kanban existirem.
- **Herança de etiquetas:** um item conta como tendo as etiquetas do pai enquanto o interruptor `inheritTags` dele estiver ligado, então uma subtarefa ou bloco de trabalho aparece ao filtrar pela etiqueta da tarefa.
- **Local-first:** dados no dispositivo, com exportação e importação em JSON.
- **Períodos do dia:** a madrugada (00h a 06h) é o quarto período, junto com manhã, tarde e noite.
- **Posicionamento:** um item, várias lentes, tudo local.
- **Itens que atravessam períodos:** aparecem em todos os períodos que tocam.
- **Tarefas sem data:** permitidas.
- **Texto de interface:** evitar travessões desnecessários.
- **Fusos horários:** instantes em UTC, itens de dia inteiro sem fuso, uma configuração de fuso de exibição (automático por padrão) e um fuso opcional em cada item com horário.
- **Idiomas da interface:** português (Brasil) e inglês, com detecção automática e escolha manual. Sem biblioteca de i18n por enquanto. Os textos ficam em arquivos de mensagens tipados.
- **Stack:** TypeScript, Vite e React, com `core`, `filters`, `storage` e `sync` sem framework.
- **Hospedagem:** Netlify, como site estático.
- **Nuvem:** Supabase, com modo visitante que fica local e contas criadas pelo dono.
- **Nome do repositório:** `unified-agenda`.

## Decisões em aberto

- Status opcional para eventos (a inclinação atual é que sim).
- Modos de exibição dos subitens por visão (aninhados, achatados, só os pais).
- Se o cadastro continua restrito ao dono ou vira um formulário de pedido de acesso.
- Se o Supabase pede cartão ou permite cobrança por estouro no plano gratuito, a conferir ao criar o projeto.

## Ideias para depois

- Alternância automática de conjuntos de agendas por horário.
