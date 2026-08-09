# Regras do Firebase — aplicar no console

Estes dois arquivos **não são usados pelo código**. Eles precisam ser colados no
console do Firebase para valer. Enquanto isso não for feito, a privacidade do
diário existe só na tela — qualquer aluno consegue ler os dados dos outros
abrindo o DevTools.

---

## 1. Realtime Database

1. Abra o [console do Firebase](https://console.firebase.google.com) e escolha o projeto do CoachApp
2. Menu lateral → **Realtime Database** → aba **Regras**
3. Apague tudo e cole o conteúdo de `database.rules.json`
4. **Publicar**

### O que essas regras garantem

| Nó | Quem lê | Quem escreve |
|---|---|---|
| `diario/{aluno}` | o aluno; o personal **só nos registros com `compartilhado: true`** | só o aluno |
| `fichas/{personal}` | só o personal dono | qualquer um cria uma ficha nova; só o personal altera/apaga |
| `linksFicha/{codigo}` | público (é o link da ficha) | só o personal dono |
| `execucoes`, `treinos`, `cobrancas`, `avaliacoes`, `fotosProgresso` | o aluno e o personal dele | conforme o caso |
| `chats/{conversa}` | só os dois participantes | só os dois participantes |

A ficha precisa de escrita pública porque o aluno preenche **sem estar logado**.
A regra permite **criar** um registro novo, nunca ler ou alterar os existentes:

```
".write": "(!data.exists() && newData.exists()) || (auth != null && auth.uid === $personalId)"
```

---

## 2. Storage

1. Console → **Storage** → aba **Regras**
2. Apague tudo e cole o conteúdo de `storage.rules`
3. **Publicar**

Limita a 5 MB e só aceita arquivo de imagem. Cada pasta só aceita escrita do dono.

---

## Antes de publicar: teste

O console tem um **simulador** na própria aba de Regras. Vale testar dois casos:

1. Leitura de `diario/{uid-de-um-aluno}/{registro}` autenticado como **outro aluno** → deve **negar**
2. Leitura do mesmo caminho como o **personal dele**, num registro com
   `compartilhado: true` → deve **permitir**

---

## Uma limitação honesta

As regras do Storage **não conseguem ler** o campo `compartilhado`, porque ele
mora no Realtime Database e são dois serviços separados. Então, na prática:

- **Quem não tem a URL do arquivo não chega nele** — e a URL só é entregue por
  `diario/`, que respeita o `compartilhado`
- Mas **quem já viu a URL uma vez continua conseguindo abrir**, mesmo que o aluno
  volte o registro para privado depois

Ou seja: tornar privado esconde da tela do personal, mas não invalida um link que
ele já tenha copiado. Fechar isso de verdade exige Cloud Functions com URLs
assinadas, que precisa do plano Blaze. Achei melhor você saber disso do que eu
prometer um "privado" mais forte do que é.
