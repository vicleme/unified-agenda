# Modelo de dados

[English](../en/data-model.md) | [Voltar ao README](../../README.pt-BR.md)

Uma analogia: o **item** é o cartão, e a Linha do Tempo, o calendário e o Kanban são lentes sobre o mesmo cartão. Mudar o status no quadro muda o que o calendário mostra, e mudar o horário no calendário muda o cartão.

## Entidades

### Agenda

Um contêiner com nome e cor base (por exemplo Faculdade, Freela, Doméstico). Um item pertence a exatamente uma agenda.

### Grupo de agendas

Um conjunto nomeado de agendas (por exemplo Pessoal = Doméstico + Saúde). Uma ação mostra ou oculta o grupo inteiro.

### Item

Um único tipo recursivo para eventos, tarefas e entradas de lista de marcação.

| Campo | Observações |
| --- | --- |
| `id` | Identificador único. |
| `parentId` | Opcional. Aponta para outro item, em qualquer profundidade. |
| `order` | Posição entre os irmãos. |
| `kind` | `event` ou `task`. |
| `title` | Obrigatório. |
| `notes` | Texto livre com Markdown. |
| `schedule` | Para eventos e blocos de trabalho. Vazio significa sem agendamento (caixa de entrada). Caso contrário, um agendamento de dia inteiro ou com horário, veja [Datas, horários e fusos horários](#datas-horários-e-fusos-horários). Tarefas não o usam. |
| `from` | Só tarefas. O primeiro dia em que a tarefa está pendente. Vazio significa o dia em que foi criada. Veja [Janela da tarefa](#janela-da-tarefa). |
| `due` | Só tarefas. A entrega, um dia ou um dia com hora. Veja [Janela da tarefa](#janela-da-tarefa). |
| `agendaId` | Agenda a que o item pertence. |
| `tagIds` | Zero ou mais etiquetas. |
| `inheritTags` | Ligado por padrão. Enquanto ligado, o item também vale as etiquetas do pai (e do avô, enquanto cada nível mantiver ligado). Só importa para item que tem pai. Backups antigos sem o campo valem como ligado. |
| `statusId` | Obrigatório para tarefas. Opcional para eventos (por exemplo Adiado, Cancelado). |
| `location` | Texto livre. |
| `links` | Lista de `{ label, url }`. |

Regras:

- Uma lista de marcação é um item com filhos simples (título e caixinha, sem datas). Um filho que ganha data, hora ou etiqueta passa a aparecer nas outras visões, porque já é um item completo.
- O progresso de um pai é calculado a partir dos descendentes, recursivamente. Só tarefas contam, e o resultado conta folhas, então 3 de 5 é 60% em qualquer profundidade. Uma tarefa com filhos contados ignora o próprio status. Um evento nunca soma ao progresso, mas pode conter tarefas que somam. Itens sem nenhuma tarefa abaixo não têm progresso.
- Um item não pode virar filho de si mesmo nem de um dos próprios descendentes.
- Tarefas sem entrega são permitidas e ficam numa caixa de entrada.
- Uma tarefa é datada pela janela (`from` e `due`), e um evento pelo `schedule`. Misturar os dois é erro de validação.
- Árvores profundas ficam recolhidas por padrão e são renderizadas sob demanda, para manter bases grandes rápidas.

### Etiqueta

| Campo | Observações |
| --- | --- |
| `id`, `name` | Identidade e rótulo. |
| `parentId` | Opcional. As etiquetas formam uma árvore de profundidade ilimitada. |
| `agendaIds` | Lista vazia significa **global**. Lista preenchida significa que a etiqueta é **restrita** a essas agendas. |
| `color` | Um tom base. As variantes clara e escura são derivadas. |

Regras de escopo:

- A subetiqueta herda o escopo do pai e só pode ser **igual ou mais estreita**, nunca mais larga.
- Restringir um pai também restringe as filhas que ficariam fora, com um aviso listando o que mudou.
- Ao escolher etiquetas para um item, aparecem as globais mais as restritas à agenda daquele item.
- Em filtros com várias agendas selecionadas, aparecem as etiquetas válidas em pelo menos uma delas, e as que existem só em parte da seleção ganham uma marca.
- Ao mover um item para uma agenda que não inclui alguma etiqueta dele, o app pergunta o que fazer: ampliar o escopo da etiqueta, remover a etiqueta do item ou manter assim mesmo. Perguntar é o padrão.
- Filtrar por uma etiqueta pai inclui todos os descendentes. Filtrar por uma folha inclui só ela.
- Herança entre itens: as etiquetas de um item são as próprias mais as do pai, enquanto o interruptor `inheritTags` dele estiver ligado. A herança é dinâmica (uma etiqueta acrescentada depois ao pai chega aos filhos), não uma cópia. Assim, um bloco de trabalho ou subtarefa aparece ao filtrar pela etiqueta da tarefa, e um filho que não pertence ao projeto do pai desliga o interruptor.
- Se todas as agendas forem marcadas numa etiqueta restrita, o app oferece convertê-la em global.

### Status

Um status pertence a uma coluna do Kanban, e a coluna pertence a um grupo. O grupo é o que o app entende (por exemplo o que conta como concluído e o que sai da lista de hoje). Cada grupo tem um papel, `planned`, `started` ou `done`, e o app lê o papel, nunca o nome. Os nomes de grupos e colunas são livres.

| Grupo | Colunas iniciais |
| --- | --- |
| Planejados | Idealizado, Pausado, Agendado |
| Começados | Começado, Em andamento |
| Concluídos | Feito, Entregue |

Grupos e colunas podem ser criados, renomeados, reordenados e movidos entre grupos.

### Período do dia

Não é armazenado. É calculado a partir do início e do fim do item, no fuso de exibição. Padrões, todos editáveis (guardados como a hora em que começam a manhã, a tarde e a noite):

| Período | Horário |
| --- | --- |
| Madrugada | 00h a 06h |
| Manhã | 06h a 12h |
| Tarde | 12h a 18h |
| Noite | 18h a 24h |

Um item que atravessa períodos (por exemplo 11h a 14h) aparece em todos os períodos que ele toca. Um item que termina exatamente onde um período começa (11h a 12h) não entra nesse período. Itens de dia inteiro e sem agendamento não têm período. Em um dia de mudança de horário, os períodos seguem o relógio de parede.

## Datas, horários e fusos horários

Um agendamento tem uma de duas formas:

| Forma | Campos | Significado |
| --- | --- | --- |
| Dia inteiro | `allDay: true`, `start`, `end` opcional (datas, `AAAA-MM-DD`, último dia incluído) | Sem fuso horário. "Dia 12" é dia 12 onde você estiver. |
| Com horário | `allDay: false`, `start`, `end` opcional (instantes em UTC, ISO 8601) | Um momento absoluto, exibido no fuso de exibição. `timeZone` opcional (um nome IANA como `Europe/Lisbon`) para itens que pertencem a outra cidade. |

Configurações:

- **Fuso de exibição:** `auto` (segue o aparelho, o padrão) ou um nome IANA. Os dias da Linha do Tempo, os períodos do dia e o calendário o usam.
- **Limites dos períodos:** as três horas de início, validadas para que `0 < manhã < tarde < noite < 24`.

Observações:

- Guarda-se o nome IANA, e não uma diferença fixa de horas, porque o horário de verão muda a diferença ao longo do ano.
- Uma leitura de relógio que não existe (o relógio pulou para a frente) avança pelo tamanho do salto. Uma leitura que acontece duas vezes (o relógio voltou) resolve para a primeira ocorrência.
- Um dia pode ter 23 ou 25 horas.
- O `core` nunca lê o fuso do aparelho por conta própria. Toda função que precisa de um fuso o recebe como parâmetro.

### Janela da tarefa

Analogia: o professor passou um trabalho no dia 3 e a entrega é dia 24. Do dia 3 ao dia 24 ele está na sua mesa, então você deve vê-lo em todos esses dias, e não só no dia de entregar.

Uma tarefa tem uma **janela**: os dias em que ela conta como pendente. A janela guarda só datas, sem hora do dia, porque "passou na segunda" não tem horário que importe.

| Campo | Significado |
| --- | --- |
| `from` | Primeiro dia da janela. Opcional. Vazio significa o dia em que a tarefa foi criada, no fuso de exibição. |
| `due` | A entrega. `{ allDay: true, date }` (o padrão) ou `{ allDay: false, at, timeZone? }` para um prazo com hora, como 23h59 num portal. `at` é um instante em UTC. |

Regras:

- A janela vai de `from` até o dia da entrega, os dois incluídos. O dia de uma entrega com hora é o dia em que ela cai no fuso de exibição, como todo o resto da tela.
- A tarefa fica pendente em todos os dias da janela até ser concluída. Depois do dia da entrega ela passa para a faixa de atrasadas, que continua até a conclusão.
- `from` exige `due`, e `from` não pode vir depois do dia da entrega.
- Sem `from`, uma tarefa criada depois do próprio dia de entrega recebe uma janela só daquele dia, para não ficar escondida.
- A janela não ocupa lugar na Linha do Tempo. Ela é uma faixa discreta de "em aberto" no topo de cada dia, separada dos eventos com hora, com o dia da entrega em destaque.
- Uma entrega de dia inteiro está atrasada quando o dia acaba. Uma entrega com hora está atrasada logo depois do horário.
- Marcar uma tarefa como feita na Linha do Tempo só muda o `statusId` dela, para o primeiro status (por ordem) do primeiro grupo cujo papel é concluído. Ela sai das faixas de em aberto e de atrasadas na próxima leitura, e o status anterior pode ser devolvido logo depois. O formulário de edição e, mais adiante, o Kanban mudam o mesmo campo.

### Bloco de trabalho

Tempo reservado para cuidar de uma tarefa, como "terças das 14h às 16h". É um evento comum, com horário, colocado **dentro da tarefa** (`parentId`), então aparece no calendário e na Linha do Tempo no horário dele. Eventos nunca contam no progresso, então os blocos de trabalho não mexem na barra de progresso da tarefa. Uma tarefa pode ter vários blocos, e apagar um não toca na tarefa.

### Recorrência (entrega 8)

Uma regra de repetição (como "toda terça") guardada no item, com as ocorrências calculadas na hora e sem uma cópia salva por dia. Ela vai servir aos blocos de trabalho, que podem repetir até o dia da entrega, e às tarefas que se repetem por si. O modelo atual não precisa mudar para recebê-la.

### Visão salva

O que a pessoa escolheu ver na Linha do Tempo, guardado com um nome. Campos: `name`, `order` (posição na lista), `filter`, `agendaIds` e `layout`, mais os campos de sincronização. Guarda só ids e valores simples, então sincroniza como todo o resto. Por enquanto as visões são da Linha do Tempo, e a lente em uso não é salva.

Os filtros são um único `ItemFilter` de dados puros (`src/filters/types.ts`): `tagIds`, `kinds`, `periods` (períodos do dia e `untimed`), `text` e `dueWithinDays`. Ele guarda só listas, texto e um número, então uma visão salva pode guardá-lo como JSON. Vazio quer dizer que a peneira está desligada. O `SavedViewFilter` do `core` tem o mesmo formato, escrito lá porque o `core` não pode importar de `filters`, e um teste mantém os dois iguais.

- **Agendas:** `agendaIds` é uma lista de ids de agendas, ou `null` para todas as agendas, inclusive as criadas depois (o padrão). Lista vazia quer dizer nenhuma. Agendas excluídas são ignoradas ao ler a lista, e se todas as agendas que ela cita sumiram, a Linha do Tempo volta a mostrar todas, em vez de uma tela vazia. Grupos nunca são salvos: um grupo é só um atalho que marca as agendas dele.
- **Disposição:** `mixed` (uma lista por dia), `separate` (uma seção por agenda) ou `grouped` (uma seção por grupo, mais "Sem grupo"). Ela não esconde nada, então não é filtro.
- **Nomes:** obrigatórios, até 80 caracteres, sem repetir o de outra visão ativa (ignorando caixa e os espaços das pontas).
- **Limpeza:** excluir uma agenda a tira das visões que a listam (uma visão que só listava essa agenda volta a todas as agendas), e excluir uma etiqueta a tira dos filtros delas.
- **"Alterada":** uma visão conta como igual enquanto a tela mostra o que ela guardou. As listas são comparadas sem olhar a ordem, e "todas as agendas" é igual a uma lista com todas elas.

### Tokens de tema

Toda cor vem de tokens como fundo, superfície, texto e borda, com um valor por tema. As cores de agenda e de etiqueta são guardadas como um tom base, com variantes clara e escura derivadas e checadas quanto ao contraste. Estados como atrasado, hoje e concluído também são tokens.

## Campos de sincronização

Toda entidade (agenda, grupo de agendas, item, etiqueta, status, visão salva) carrega os mesmos quatro campos, desde a entrega 1, para que a sincronização possa ser acrescentada depois sem migrar dados:

| Campo | Observações |
| --- | --- |
| `id` | Um UUID gerado no dispositivo, nunca por um servidor. |
| `createdAt` | Quando foi criada. |
| `updatedAt` | Quando mudou pela última vez. Usado para decidir qual versão vence. |
| `deletedAt` | Vazio enquanto a entidade existe. Excluir preenche esse campo em vez de remover o registro, para que o outro dispositivo saiba da exclusão. Essa marca se chama tombstone (lápide). |

## Armazenamento, contas e sincronização

Local-first. Os dados sempre ficam no dispositivo (IndexedDB), com exportação e importação em JSON.

### Banco local

O IndexedDB é o banco de dados que já vem dentro do navegador. O app o acessa pelo Dexie, em `src/storage`.

| Tabela | Guarda | Indexado para consultas |
| --- | --- | --- |
| `agendas`, `agendaGroups` | Agendas e seus grupos | `order` |
| `items` | Eventos, tarefas e blocos de trabalho | `parentId`, `agendaId`, `statusId`, `tagIds` (uma entrada por etiqueta) |
| `tags` | Etiquetas | `parentId` |
| `savedViews` | Visões salvas da Linha do Tempo (versão 2 do banco) | `order` |
| `statusGroups`, `statuses` | Grupos e colunas do Kanban | `order`, `groupId` |
| `meta` | Dados pequenos do app: as configurações e a marca de "padrões criados" | `key` |

- Toda tabela de entidade também indexa `updatedAt` e `deletedAt`, para a sincronização.
- Excluir marca o `deletedAt` e mantém o registro. As listas escondem as entidades excluídas, a menos que se peça.
- Os grupos e colunas iniciais do Kanban são criados na primeira vez que o app abre, e nunca mais, mesmo que todos os grupos sejam apagados de propósito.
- Os campos de data dos itens não são indexados. As visões filtram na memória com as funções puras do `core`.
- As configurações são conferidas ao carregar e ao salvar. Um valor guardado que deixou de ser válido volta ao padrão.

### Arquivo de backup

Exportação e importação em JSON, num arquivo só, com nome como `unified-agenda-2026-11-07.json`.

```json
{
  "format": "unified-agenda-backup",
  "version": 1,
  "exportedAt": "2026-11-07T20:00:00.000Z",
  "settings": { "displayTimeZone": "auto", "periodBounds": { "...": 6 } },
  "data": { "agendas": [], "agendaGroups": [], "items": [], "tags": [], "savedViews": [], "statusGroups": [], "statuses": [] }
}
```

- A exportação é uma foto consistente dos dados. Por padrão ela mantém as entidades excluídas (lápides), para que, ao importar em outro lugar, se saiba que foram excluídas.
- **A importação é tudo ou nada.** O arquivo inteiro é conferido antes: tipos, datas, fusos horários, ids repetidos e as regras de item do `core`. Se algo estiver errado, o resultado lista cada problema com o lugar dele (por exemplo `data.items[3].title`) e nada é gravado. Campos extras desconhecidos são descartados.
- A gravação em si é uma transação só, então uma falha no meio deixa os dados como estavam.
- **Mesclar** acrescenta o que é novo. Para um id que existe dos dois lados, vence a versão com o `updatedAt` mais recente, e um empate mantém a local. Nada é removido. As configurações vêm do arquivo só quando este dispositivo não tem nenhuma salva.
- **Substituir** deixa o dispositivo igual ao arquivo, apagando todo o resto, configurações inclusive. O arquivo precisa se bastar: um item que aponta para uma agenda, pai, status ou etiqueta que não está no arquivo é recusado.
- Importar num app recém-instalado deve usar substituir, porque mesclar deixaria os grupos padrão do Kanban ao lado dos que vêm no arquivo. O app consegue saber que os dados são novos, porque nada foi criado ainda.
- `savedViews` é opcional na importação: um arquivo antigo sem ela vale como "sem visões", e substituir a partir dele apaga as visões do aparelho. Uma visão que aponta para agenda ou etiqueta fora do arquivo é recusada ao substituir. Por isso a `version` do formato continua 1.
- A `version` do arquivo é separada da versão do esquema do banco. Uma nova versão de arquivo acrescenta um leitor para a antiga.

**Dois modos:**

- **Visitante:** tudo fica no navegador. O app nunca fala com servidor. Os dados do visitante podem ser exportados e, depois, importados para uma conta.
- **Conta:** os mesmos dados locais, mais uma cópia na nuvem (Supabase) que sincroniza entre web e celular. O cadastro é fechado, então as contas são criadas pelo dono.

**Conflitos:** quando o mesmo item mudou em dois dispositivos, vence a versão com o `updatedAt` mais recente (o último a escrever vence). Isso basta para uma pessoa com dois dispositivos. O único risco é perder uma edição quando os dois dispositivos mudam o mesmo item antes de sincronizar.

**Segurança:** na nuvem, cada linha pertence a um usuário, e a segurança por linha (uma regra do banco que diz "esta linha só é visível ao seu dono") é obrigatória. Um teste deve provar que uma conta não consegue ler as linhas de outra.
