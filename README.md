# CoachApp V2

App web para personal trainer: treinos, execução série por série, avaliação física, financeiro com validação de pagamento, chat e notificações.

Stack: React + Vite + Firebase (Authentication + Realtime Database). Sem backend separado.

## Novidades da V2

PERSONAL
- Dashboard com estatísticas (alunos, séries hoje, a receber, pagamentos p/ validar)
- Personal cadastra o aluno (aluno não cria conta sozinho) e recebe código de acesso
- Menu suspenso com mais de 70 exercícios prontos (pode digitar também)
- Templates de treino (Full Body, A, B, C)
- Link de vídeo do YouTube por exercício
- Histórico de treinos (o anterior é arquivado ao salvar um novo)
- Avaliação física completa (16 medidas) + gráficos de evolução
- Fotos de progresso (antes/depois: frente, lado, costas)
- Relatórios: evolução de carga por exercício, frequência, últimas séries
- Financeiro: lançar cobranças, validar pagamentos, histórico de recebimentos
- Configurações: foto, dados, chave PIX (visível para o aluno), trocar e-mail/senha

ALUNO
- Login por CÓDIGO DE ACESSO + senha
- Treino com vídeo de execução e cronômetro de descanso automático (com aviso sonoro)
- Peso: aluno só aumenta; para reduzir carga, apenas o personal
- Treino BLOQUEADO automaticamente se houver cobrança vencida
- Registrar pagamento -> personal valida -> treino liberado
- Evolução: calendário heatmap, gráficos de medidas, treinos anteriores
- Histórico de pagamentos, chave PIX do personal
- Configurações: foto, objetivo, trocar e-mail/senha
- Notificações (sino no topo): novo treino, cobranças, validações, chat

## Antes de usar (Firebase)

1. Authentication -> Métodos de login -> E-mail/senha ATIVADO (já feito)
2. Realtime Database -> Regras:

```json
{
  "rules": {
    ".read": true,
    ".write": "auth != null",
    "codigos": { ".read": true }
  }
}
```

## Rodar local

```
npm install
npm run dev
```

## Deploy (GitHub + Netlify)

```
git init
git add .
git commit -m "CoachApp V2"
git branch -M main
git remote add origin https://github.com/SEU_USUARIO/coachapp.git
git push -u origin main
```

No Netlify: Add new site -> Import from GitHub -> escolher o repositório -> Deploy.
O arquivo netlify.toml já cuida do build e do SPA routing.

## Fluxo de uso

1. Personal cria a própria conta
2. Em Alunos -> Cadastrar aluno (nome, e-mail, senha inicial) -> sistema gera o código
3. Personal envia código + senha ao aluno
4. Aluno entra na aba "Sou Aluno" com código + senha
5. Personal monta o treino (template ou do zero, com vídeos)
6. Aluno executa série por série (cronômetro de descanso automático)
7. Personal lança cobranças; aluno paga via PIX e registra; personal valida
8. Se vencer sem pagar: treino bloqueia sozinho até a validação

## Observação sobre imagens

As fotos (perfil, antes/depois) são comprimidas no navegador e salvas no Realtime Database.
Isso evita custos com Firebase Storage. Fotos ficam em tamanho reduzido (480px).
