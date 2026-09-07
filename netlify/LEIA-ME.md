# Lembretes de suplementação — o que falta configurar

O código está pronto e no repositório. **Nada é enviado até estes cinco passos
serem feitos**, porque as chaves não podem morar no Git.

Sem eles o app não quebra: o aluno vê "Os lembretes ainda não foram configurados
neste servidor" e o resto da suplementação funciona igual.

---

## Por que existe uma função de servidor num app sem backend

Com o app fechado, nada no celular acorda às 05:00. A única API do navegador que
faria isso (Notification Triggers) nunca saiu de teste no Chrome. Então alguém
de fora precisa mandar o push — e esse alguém é
`netlify/functions/lembretes-suplementos.mjs`, que roda de minuto em minuto.

A decisão de *o que* enviar não está lá: mora em `src/lib/lembretes.js`, junto do
app, e é testada sem servidor nem celular.

---

## 1. Gerar o par de chaves VAPID

São a identidade do seu servidor perante o serviço de push do navegador.

```bash
npx web-push generate-vapid-keys
```

Guarde as duas. A pública vai para o front **e** para a função; a privada vai
**só** para a função — quem tiver as duas consegue enviar notificação em nome do
CoachApp.

## 2. Criar a conta de serviço do Firebase

Console → ⚙️ Configurações do projeto → **Contas de serviço** → *Gerar nova chave
privada*. Baixa um JSON.

Essa credencial **ignora todas as regras do Realtime Database** — é o que permite
à função ler os suplementos de todos os alunos. Por isso ela nunca pode chegar ao
navegador nem ao repositório.

## 3. Colocar as variáveis no Netlify

Site → *Site configuration* → **Environment variables**:

| Variável | Valor |
|---|---|
| `VITE_VAPID_PUBLIC_KEY` | a chave pública do passo 1 |
| `VAPID_PUBLIC_KEY` | a mesma chave pública |
| `VAPID_PRIVATE_KEY` | a chave privada do passo 1 |
| `VAPID_SUBJECT` | `mailto:seu@email.com` |
| `FIREBASE_SERVICE_ACCOUNT` | o JSON do passo 2, **numa linha só** |
| `FIREBASE_DATABASE_URL` | a mesma URL que o app já usa |

`VITE_VAPID_PUBLIC_KEY` precisa existir no momento do **build** — variável com
prefixo `VITE_` é lida pelo Vite e embutida no bundle. As outras são lidas em
tempo de execução pela função.

## 4. Publicar as regras do Realtime Database

Console → Realtime Database → Regras → colar `firebase-regras/database.rules.json`.

Ganhou dois nós: `pushSubs` (a inscrição de cada aparelho, que só o dono escreve)
e `lembretesEnviados` (o registro do que já saiu, que ninguém escreve pelo app —
só a função, que ignora as regras).

## 5. Conferir depois do deploy

- Netlify → *Functions* → `lembretes-suplementos` deve aparecer como agendada
- Os logs mostram uma linha por execução:
  `Lembretes: alunos=3 enviados=1 falhas=0 inscricoesRemovidas=0 ms=412`
- No app: Suplementação → **Ativar** em "Notificações neste aparelho", depois
  cadastre um suplemento com horário daqui a 2 minutos

---

## Custo

A função roda a cada minuto: ~43.200 execuções/mês, contra 125.000 do plano
grátis. Se apertar, mude o `schedule` no fim do arquivo para `*/5 * * * *` —
cai para ~8.600 e o lembrete chega com até 5 minutos de atraso. A janela de
recuperação da lib já é de 5 minutos, então nada se perde.

---

## iPhone

O Safari só entrega push para app **adicionado à tela de início** (iOS 16.4+).
É regra da Apple, não escolha nossa: no navegador comum o `PushManager` nem
existe. O app detecta isso e explica ao aluno o que fazer, em vez de deixá-lo
achando que está quebrado.

No Android e no desktop funciona pelo navegador, sem instalar.

---

## O que a notificação NÃO faz

Não marca a dose direto pelo botão. Fazer isso exigiria guardar uma credencial
de escrita do Firebase dentro do service worker — um token vivo fora da sessão,
para economizar um toque. A notificação abre o app já na dose, e o registro
acontece ali, com o aluno logado.
