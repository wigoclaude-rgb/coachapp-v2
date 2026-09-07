# CoachApp V2 — memória do projeto

App web para personal trainer. React + Vite + Firebase (Auth + Realtime Database +
Storage). **Não existe backend próprio** — o navegador fala direto com o Firebase, e
quem protege os dados são as regras do Realtime Database.

Deploy: Netlify (`netlify.toml` já faz build e o redirect de SPA).
Versão do app exibida ao usuário: **2.2.0** (ver `src/lib/novidades.js`).

---

## Como rodar

```bash
npm install
npm run dev      # Vite em :5173
npm run build    # gera dist/
```

Precisa de um `.env` na raiz (não versionado) com as 7 chaves de `.env.example`.
Sem ele o Firebase não conecta — `src/firebase.js` lê tudo de `import.meta.env`.

Não há testes, linter nem typecheck configurados no projeto.

---

## Os três papéis

| Papel | Como entra | Onde vive |
|---|---|---|
| **Personal** | cria a própria conta em `/cadastro-personal` | `/personal/*` |
| **Aluno** | o personal cadastra e entrega **código de acesso + senha**; o aluno nunca cria conta sozinho | `/aluno/*` |
| **Admin (master)** | conta separada, listada em `admins/{uid}` | `/admin/*` |

O papel vem de `users/{uid}.role`. O admin **não tem registro em `users/`** de
propósito — por isso as rotas `/admin` ficam fora do gate de login em `App.jsx` e
quem autoriza é o `GuardAdmin`, lendo `admins/{uid}`.

Primeiro acesso do aluno: `perfil.precisaTrocarSenha` trava a aplicação inteira na
tela `CriarSenha` até ele definir a senha dele.

---

## Rotas (`src/App.jsx`)

```
/                       login (ou redireciona pro painel do papel)
/cadastro-personal      cadastro do personal
/ficha/:codigo          ficha pública — o aluno preenche SEM estar logado
/admin/login            login do master
/admin                  painel master
/admin/personals        lista de personais
/admin/personals/:id    ficha de um personal (plano, limite, status)
/admin/suporte          chat de suporte com os personais
/personal/*             painel do personal (abas por estado, não por URL)
/personal-aluno/:id     ficha completa de um aluno
/personal-treino/:id    editor de treino de um aluno
/aluno/*                painel do aluno (abas por estado)
```

**Atenção:** dentro de `/personal` e `/aluno` as abas são estado local (`useState`),
não rotas. Trocar de aba não muda a URL nem entra no histórico do navegador.

---

## Abas

**Personal** (`src/pages/personal/PersonalHome.jsx`, 985 linhas)
Início · Alunos · Financeiro · Chat · Templates · Avaliação física · Meu treino ·
Suplementação · Meu plano · Ajuda do app · Configurações

**Aluno** (`src/pages/aluno/AlunoHome.jsx`, 1336 linhas)
Meu Treino · Evolução · Check-in · Suplementação · Pagamentos · Chat · Configurações

**Ficha do aluno** (`src/pages/personal/AlunoDetalhe.jsx`)
Perfil · Avaliação física · Fotos · Diário · Suplementos · Feedback · Relatórios ·
Treinos antigos

---

## Modelo de dados (Realtime Database)

Tudo na raiz, indexado por uid. As regras estão em `firebase-regras/database.rules.json`
e **precisam ser coladas no console do Firebase à mão** — o repositório não as publica.

| Nó | Conteúdo |
|---|---|
| `users/{uid}` | perfil: `role`, `nome`, `personalId`, `codigo`, `email`, `foto`, `cpf`, `precisaTrocarSenha` |
| `personals/{uid}` | `alunos/{alunoUid}`, `meusTemplates`, `codigoFicha`, chave PIX |
| `admins/{uid}` | `true` para quem é master (só escrita pelo console) |
| `planos/{personalId}` | `plan`, `planStatus`, `studentLimit`, `planExpiresAt` |
| `adminLogs` | auditoria de toda alteração de plano |
| `codigos/{codigo}` | `{ alunoUid, email, personalId }` — leitura pública, é o login do aluno |
| `cpfs/{cpf}` | trava um CPF por aluno |
| `linksFicha/{codigo}` / `fichas/{personalId}` | ficha pública de pré-cadastro |
| `treinos/{alunoUid}` | plano ativo |
| `treinosHistorico/{alunoUid}` | planos arquivados ao salvar um novo |
| `execucoes/{alunoUid}` | cada série concluída (só o aluno escreve) |
| `feedbacks/{alunoUid}` | feedback por exercício (dor, carga pesada) |
| `avaliacoes/{alunoUid}` | avaliação física (só o personal escreve) |
| `fotosProgresso/{alunoUid}` | fotos antes/depois |
| `anexos` / `anexosDados/{alunoUid}` | metadado e conteúdo base64, separados de propósito |
| `diario/{alunoUid}` | check-in privado — **só o aluno lê** |
| `diarioCompartilhado/{alunoUid}` | o que o aluno decide mostrar ao personal |
| `suplementos` / `suplementosTomados/{alunoUid}` | rotina e doses do dia |
| `cobrancas/{alunoUid}` | `valor`, `vencimento`, `status`, `tipo`, `pagamento{data,obs,comprovante}`, `validadaEm`, `validadaPor`, `motivoRecusa` |
| `chats/{conversaId}` | `conversaId` = os dois uids concatenados; a regra usa `.contains(auth.uid)` |
| `presenca/{uid}` | online/visto por último, via `onDisconnect` |
| `notificacoes/{uid}` | sino do topo |
| `config/suporteUid` | uid da conta de suporte |

### Decisões de segurança que não devem ser desfeitas

- **`planos/` fica fora de `users/`.** No Realtime Database, `.write` num nó pai vale
  para todos os filhos e regra de filho não revoga. Como o personal precisa escrever
  no próprio `users/{uid}`, um campo `plan` ali seria gravável por ele — daria
  auto-promoção a Pro pela API. Está documentado em `src/lib/planos.js`.
- **`diario` e `diarioCompartilhado` são nós separados** porque a regra precisa
  distinguir o que é privado do que foi compartilhado; não dá para fazer isso com um
  campo dentro do mesmo nó.
- **`fichas/{personalId}/{fichaId}` aceita escrita anônima só para criar**
  (`!data.exists() && newData.exists()`), nunca ler ou alterar — é o aluno preenchendo
  deslogado.
- **Limitação conhecida e assumida:** as regras do Storage não enxergam o campo
  `compartilhado` (serviços diferentes). Tornar um registro privado esconde da tela do
  personal, mas não invalida uma URL que ele já copiou. Fechar isso exige Cloud
  Functions com URL assinada → plano Blaze. Está escrito em `firebase-regras/LEIA-ME.md`.

---

## Regras de negócio que importam

- **Pagamento é informado, não processado.** O PIX acontece fora do app. O aluno copia a
  chave, paga pelo banco e volta para tocar em "Já paguei" — isso só muda o status para
  `em_analise`. Quem confirma que o dinheiro entrou é o personal. Quatro estados, em
  `src/lib/cobrancas.js`: `pendente` → `em_analise` → `pago` | `recusado`.
- **A trava contra pagamento duplicado é do banco, não da tela.** A regra de
  `cobrancas/$aluno/$cobranca` só aceita a transição partindo de `pendente` ou
  `recusado`. Entre duas requisições simultâneas, a segunda encontra `em_analise` e é
  recusada pelo servidor. O `disabled` do botão é conforto, não garantia.
- **O aluno não escreve `status: 'pago'`.** As regras validam campo a campo: valor,
  vencimento, tipo e `criadaEm` são imutáveis para ele, e `validadaEm`, `validadaPor` e
  `motivoRecusa` só aceitam escrita do personal. Antes de Set/2026 o nó inteiro era
  gravável pelo aluno — dava para se marcar como pago pelo DevTools e destravar o treino.
- **Bloqueio por inadimplência.** Cobrança vencida (`vencida(c)` em `src/lib/util.js`)
  → `bloqueado = true` → a aba Meu Treino vira um aviso. `vencida()` continua contando
  a cobrança em análise como devida, de propósito: se informar o pagamento destravasse,
  o botão "Já paguei" seria a chave do cadeado.
- **Carga só sobe pelo aluno.** Se ele lança peso abaixo do plano, o app pergunta o
  motivo e isso aparece na aba Feedback do personal ("Carga abaixo do plano").
- **Ciclo A/B/C.** O plano é `{ nome, lista: [dias], indiceAtual }`. "Terminei por hoje"
  avança `indiceAtual`. O aluno só troca o treino do dia se o personal permitir.
- **Limite de alunos.** `podeCriarAluno()` em `src/lib/planos.js`: Free = 4, Pro = 999.
  A checagem é de interface — barra a tela, não a API.
- **Cadastro do aluno usa um app Firebase secundário** (`getDatabase(secApp)` em
  `PersonalHome.jsx`) para criar a conta sem deslogar o personal.
- **CPF é a chave anti-duplicata**, não o e-mail. Aluno sem e-mail próprio recebe um
  e-mail interno e fica com `semRecuperacao: true`.
- **Fotos:** as novas vão para o Storage; as antigas são base64 dentro do banco.
  `ehBase64()` em `src/lib/fotos.js` distingue as duas.

---

## Onde fica cada coisa

**`src/lib/` — a lógica pura, sem React.** É aqui que se mexe primeiro.

| Arquivo | Assunto |
|---|---|
| `treinoModel.js` | formato canônico de treino/exercício + migração dos formatos antigos |
| `evolucao.js` | dias treinados, sequência, recordes, heatmap, conquistas |
| `avaliacao.js` | anamnese, PAR-Q, dobras, bioimpedância, IMC, RCQ, composição |
| `suplementos.js` | rotina do dia, aderência, sequência, próxima dose |
| `planos.js` | planos comerciais, status e log de admin |
| `ficha.js` / `cpf.js` | ficha pública e validação de CPF |
| `anexos.js` / `fotos.js` / `medidas.js` | arquivos e medidas |
| `atividades.js` | check-in de atividade (tempo, distância) |
| `cobrancas.js` | estados da cobrança, o que é informável, selos e rótulos |
| `tours.js` / `novidades.js` | tutorial de primeiro acesso e changelog in-app |
| `presenca.js` / `notify.js` / `util.js` | presença, notificações, formatação |

**`src/components/`** — Layout (sidebar + topbar), Chat, TreinoDoDia, ExecucaoTreino,
EditorExercicios, FormAvaliacao, Evolucao, Suplementacao (+ subpasta), Anexos, Tour,
Novidades, Heatmap, LineChart, Icones.

**`src/styles.css`** — 2751 linhas, CSS puro, sem framework. Todo o visual está aqui.

---

## Convenções do código

- **Tudo em português**: nomes de variáveis, funções, componentes e comentários.
- Comentários explicam **por quê**, não o quê — e vários registram decisões de
  arquitetura. Não apague ao refatorar.
- Estado do Firebase com `onValue`, sempre com cleanup no `useEffect`.
- Sem TypeScript, sem PropTypes, sem biblioteca de estado. React puro + hooks.
- Mensagens de commit: uma linha, em português, descrevendo o efeito para quem usa
  ("Bolinha no lugar do botao, e 'Terminei por hoje' destrava o ciclo"), não o arquivo
  mexido.

---

## Para publicar uma novidade no app

Acrescente um bloco **no topo** de `NOVIDADES` em `src/lib/novidades.js` com uma versão
nova. Cada item aceita `para: 'aluno'` ou `para: 'personal'`. Quem entra vê tudo que
saiu desde a última visita. Conta nova não vê nada — recebe o tutorial.

---

## Histórico do projeto

45 commits, de 19/07/2026 a 02/09/2026. As fases:

1. **Jul/19–21 — base.** V2 completa, templates do personal, financeiro com cobranças
   recorrentes, credenciais para variáveis de ambiente, redesign com sidebar, ciclo A/B/C.
2. **Jul/28 — redesign premium** e templates como pacote de treinos.
3. **Ago/05–10 — estrutura de dados.** Linhas de série e bi-set, Storage para fotos,
   ficha de cadastro, diário do aluno, chat com presença e recibo de leitura, CPF como
   chave.
4. **Ago/17–22 — usabilidade.** Autocomplete de exercícios, tela do aluno virou lugar de
   treinar (não painel de estatísticas), feedback por exercício, tutorial de primeiro
   acesso, suplementação com aviso flutuante, treino próprio do personal.
5. **Ago/23 — camada comercial.** Painel master, planos, chat de suporte.
6. **Ago/30–Set/02 — acompanhamento.** Avaliação física completa (anamnese, dobras,
   bioimpedância), anexos, check-in com atividade, série como linha de tabela,
   Evolução e Suplementação viraram telas de acompanhamento.

Os repositórios `Ccoachapp` e `coachapp-backend` são o MVP de julho, congelados;
`coachapp` está vazio. **Só este repositório tem código vivo.**

---

## Estado atual

`main` e a branch de trabalho estão no mesmo commit (`9ee76b8`). Nada pendente.

---

## Pendente de ação manual no console do Firebase

As regras do repositório **não são publicadas pelo deploy**. Depois de subir esta
versão, cole no console, senão o fluxo de pagamento quebra:

1. **Realtime Database → Regras** → `firebase-regras/database.rules.json`.
   Sem isso o aluno continua podendo se marcar como pago pelo DevTools; com a versão
   nova do app e a regra antiga, tudo funciona (a regra antiga é mais permissiva).
2. **Storage → Regras** → `firebase-regras/storage.rules`, que ganhou o caminho
   `comprovantes/{alunoUid}`. Sem isso o envio do comprovante falha — e só ele: o
   código trata a falha e registra o pagamento mesmo assim.
