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
| `start`, `end` | Data e hora. Ambos opcionais para tarefas. |
| `allDay` | Se o horário do dia é ignorado. |
| `agendaId` | Agenda a que o item pertence. |
| `tagIds` | Zero ou mais etiquetas. |
| `statusId` | Obrigatório para tarefas. Opcional para eventos (por exemplo Adiado, Cancelado). |
| `location` | Texto livre. |
| `links` | Lista de `{ label, url }`. |

Regras:

- Uma lista de marcação é um item com filhos simples (título e caixinha, sem datas). Um filho que ganha data, hora ou etiqueta passa a aparecer nas outras visões, porque já é um item completo.
- O progresso de um pai é calculado a partir dos filhos, recursivamente.
- Tarefas sem data são permitidas e ficam numa caixa de entrada.
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
- Se todas as agendas forem marcadas numa etiqueta restrita, o app oferece convertê-la em global.

### Status

Um status pertence a uma coluna do Kanban, e a coluna pertence a um grupo. O grupo é o que o app entende (por exemplo o que conta como concluído e o que sai da lista de hoje). O nome das colunas é livre.

| Grupo | Colunas iniciais |
| --- | --- |
| Planejados | Idealizado, Pausado, Agendado |
| Começados | Começado, Em andamento |
| Concluídos | Feito, Entregue |

Grupos e colunas podem ser criados, renomeados, reordenados e movidos entre grupos.

### Período do dia

Não é armazenado. É calculado a partir do início e do fim do item. Padrões, todos editáveis:

| Período | Horário |
| --- | --- |
| Madrugada | 00h a 06h |
| Manhã | 06h a 12h |
| Tarde | 12h a 18h |
| Noite | 18h a 24h |

Um item que atravessa períodos (por exemplo 11h a 14h) aparece em todos os períodos que ele toca.

### Visão salva

Um nome mais uma combinação de: agendas e grupos visíveis, disposição (misturadas, separadas ou agrupadas), filtros (etiquetas, tipo, período, texto) e a lente em uso.

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

**Dois modos:**

- **Visitante:** tudo fica no navegador. O app nunca fala com servidor. Os dados do visitante podem ser exportados e, depois, importados para uma conta.
- **Conta:** os mesmos dados locais, mais uma cópia na nuvem (Supabase) que sincroniza entre web e celular. O cadastro é fechado, então as contas são criadas pelo dono.

**Conflitos:** quando o mesmo item mudou em dois dispositivos, vence a versão com o `updatedAt` mais recente (o último a escrever vence). Isso basta para uma pessoa com dois dispositivos. O único risco é perder uma edição quando os dois dispositivos mudam o mesmo item antes de sincronizar.

**Segurança:** na nuvem, cada linha pertence a um usuário, e a segurança por linha (uma regra do banco que diz "esta linha só é visível ao seu dono") é obrigatória. Um teste deve provar que uma conta não consegue ler as linhas de outra.
