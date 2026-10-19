/*
  Sessão de treino: o que foi feito, de qual treino, de quando até quando.

  POR QUE ISTO EXISTE
  Até aqui o app só guardava execuções soltas (`execucoes/{aluno}`), e "o aluno
  treinou hoje?" era respondido por "existe alguma execução hoje?". Isso trazia
  quatro problemas que a tela não tinha como resolver sozinha:

  1. Uma série solta contava o dia inteiro como treinado — frequência, sequência
     e "treinos no mês" subiam com um toque.
  2. O progresso misturava treinos: a chave era `exercício + série`, então fazer
     supino no B aparecia como feito no C.
  3. Trocar de treino era só `useState` — recarregar a página voltava ao treino
     do ciclo e as séries sumiam da vista.
  4. O ciclo só avançava se a pessoa tocasse "Finalizar". Fechou o app antes?
     No dia seguinte continuava no mesmo treino, para sempre.

  Com a sessão, cada uma dessas perguntas tem um dono.

  O QUE CONTA COMO DIA TREINADO
  Sessão concluída, ou que atingiu metade das séries. Meia série não é treino, e
  exigir 100% puniria quem teve que sair no meio. A regra vale para frequência,
  sequência, treinos no mês, calendário e para o "sem treinar há N dias" do
  personal — todos passam por aqui.

  EXCEÇÃO DELIBERADA: o lembrete de suplemento pós-treino (`lib/lembretes.js` e
  `netlify/functions/lembretes-suplementos.mjs`) continua olhando qualquer
  execução do dia. Quem fez meio treino também precisa do pós-treino, e negar a
  dose por causa de uma régua de frequência seria confundir duas perguntas
  diferentes.
*/

import { diaISO } from './evolucao'

export const EM_ANDAMENTO = 'em_andamento'
export const CONCLUIDA = 'concluida'
export const PARCIAL = 'parcial'

/* Metade das séries. Abaixo disso não é "o dia treinado", é um começo. */
export const FRACAO_MINIMA = 0.5

/* Sessão aberta há mais que isto virou esquecimento, não treino em andamento. */
export const HORAS_ATE_FECHAR = 4
const HORA = 3600000

/* ---------------------------------------------------------------- criar -- */

/**
 * Monta uma sessão nova. `id` vem de fora (gerado por `push` no cliente) para
 * a sessão também nascer sem sinal — o app enfileira a escrita e segue.
 */
export function novaSessao({ id, treinoIdx, treinoNome, seriesTotal, agora = Date.now() }) {
  return {
    id,
    treinoIdx: Number(treinoIdx) || 0,
    // O nome é copiado de propósito: o personal pode renomear o treino depois,
    // e o histórico deve dizer o que o aluno viu na hora, não o nome de agora.
    treinoNome: treinoNome || '',
    inicioEm: agora,
    fimEm: null,
    status: EM_ANDAMENTO,
    encerradaPor: null,
    seriesFeitas: 0,
    seriesTotal: Number(seriesTotal) || 0,
    dia: diaISO(new Date(agora))
  }
}

/**
 * A sessão como ela vai para o banco: sem o `id`.
 *
 * A chave do nó JÁ é o id — gravá-lo também como campo seria a mesma
 * informação em dois lugares, e as regras rejeitam campo desconhecido. Quem lê
 * recebe o id de volta por `listar()`, que o tira da chave.
 *
 * `fimEm` e `encerradaPor` saem quando são nulos: no Realtime Database gravar
 * null apaga a chave, então mandá-los seria pedir para apagar o que não existe.
 */
export function paraBanco(sessao) {
  const { id, fimEm, encerradaPor, ...resto } = sessao
  return {
    ...resto,
    ...(fimEm ? { fimEm } : {}),
    ...(encerradaPor ? { encerradaPor } : {})
  }
}

/* --------------------------------------------------------------- estado -- */

/** `concluida` quando não sobrou série; `parcial` em qualquer outro caso. */
export function statusFinal(seriesFeitas, seriesTotal) {
  const total = Number(seriesTotal) || 0
  const feitas = Number(seriesFeitas) || 0
  return total > 0 && feitas >= total ? CONCLUIDA : PARCIAL
}

/** Fração do treino que foi feita, entre 0 e 1. */
export function fracao(sessao) {
  const total = Number(sessao?.seriesTotal) || 0
  if (total <= 0) return 0
  return Math.min(1, (Number(sessao?.seriesFeitas) || 0) / total)
}

/**
 * Esta sessão faz o dia valer como treinado?
 *
 * Vale também para a sessão ainda aberta: quem já passou da metade treinou,
 * mesmo sem ter tocado em "Finalizar". Esperar o botão faria a Home mentir
 * durante o próprio treino.
 */
export function contaComoDiaTreinado(sessao) {
  if (!sessao) return false
  if (sessao.status === CONCLUIDA) return true
  return fracao(sessao) >= FRACAO_MINIMA
}

/** A sessão aberta, se houver. No máximo uma por aluno. */
export function aberta(sessoes) {
  return listar(sessoes).find(s => s.status === EM_ANDAMENTO) || null
}

/** Sessões como lista, da mais recente para a mais antiga. */
export function listar(sessoes) {
  return Object.entries(sessoes || {})
    .map(([id, s]) => ({ id, ...s }))
    .filter(s => s && typeof s.inicioEm === 'number')
    .sort((a, b) => b.inicioEm - a.inicioEm)
}

/* --------------------------------------------------------- fechamento --- */

/**
 * Sessão esquecida: aberta há mais de 4 horas, ou de um dia anterior.
 *
 * As duas condições existem porque uma não cobre a outra: um treino que começou
 * 23h50 e foi esquecido tem menos de 4 horas na virada do dia, e um treino de
 * 5 horas no mesmo dia também não deveria seguir aberto.
 */
export function deveFecharSozinha(sessao, agora = Date.now()) {
  if (!sessao || sessao.status !== EM_ANDAMENTO) return false
  if (agora - sessao.inicioEm > HORAS_ATE_FECHAR * HORA) return true
  return sessao.dia !== diaISO(new Date(agora))
}

/**
 * Os campos que fecham a sessão. Devolve só o que muda, para a tela gravar
 * com `update` e não reescrever o que não é dela.
 *
 * `fimEm` cai na última série de propósito: no fechamento automático, a hora
 * em que o app foi reaberto não diz nada sobre quando o treino acabou.
 */
export function fechamento(sessao, { seriesFeitas, fimEm, encerradaPor = 'aluno' } = {}) {
  const feitas = seriesFeitas === undefined ? (sessao?.seriesFeitas || 0) : seriesFeitas
  return {
    status: statusFinal(feitas, sessao?.seriesTotal),
    encerradaPor,
    seriesFeitas: feitas,
    fimEm: fimEm || sessao?.inicioEm || Date.now()
  }
}

/* -------------------------------------------------------------- ciclo --- */

/**
 * Próximo treino do ciclo: o seguinte ao último que REALMENTE foi feito.
 *
 * Antes isto era "o índice gravado + 1", e só avançava se a pessoa tocasse
 * "Finalizar". Quem fechava o app antes ficava preso no mesmo treino para
 * sempre. Agora o ciclo anda sozinho a partir do histórico.
 *
 * Sessão parcial abaixo da metade não avança: começar o B e desistir não
 * deveria mandar a pessoa para o C no dia seguinte.
 */
export function proximoIndice(sessoes, totalDias, indiceAtual = 0) {
  const total = Number(totalDias) || 0
  if (total <= 0) return 0
  const ultima = listar(sessoes).find(contaComoDiaTreinado)
  if (!ultima) return Math.min(Math.max(0, indiceAtual), total - 1)
  return ((Number(ultima.treinoIdx) || 0) + 1) % total
}

/**
 * As sessões da volta atual do ciclo.
 *
 * A regra: olhando da mais recente para trás, a volta termina quando um
 * `treinoIdx` se repete — aquela já é a volta anterior.
 *
 * Escolhi isto em vez de "desde a última vez que o treino A começou" porque
 * quem pula um treino, ou faz A → C → B, nunca fecharia uma volta pela regra
 * do A e as letras ficariam verdes para sempre.
 */
export function voltaAtual(sessoes) {
  const vistos = new Set()
  const volta = []
  for (const s of listar(sessoes)) {
    const idx = Number(s.treinoIdx) || 0
    if (vistos.has(idx)) break
    vistos.add(idx)
    volta.push(s)
  }
  return volta
}

/**
 * Como desenhar cada letra do ciclo.
 *
 * `feito` nunca sai da posição no ciclo — era isso que pintava de verde um
 * treino que a pessoa nunca fez, só por estar antes do índice atual.
 */
export function estadosDoCiclo(sessoes, totalDias, { idxDeHoje = null } = {}) {
  const total = Number(totalDias) || 0
  const porIndice = new Map()
  // A mais recente de cada treino na volta manda: refazer o B depois de uma
  // tentativa fraca tem que poder virar verde.
  voltaAtual(sessoes).forEach(s => {
    const i = Number(s.treinoIdx) || 0
    if (!porIndice.has(i)) porIndice.set(i, s)
  })

  return Array.from({ length: total }, (_, i) => {
    const s = porIndice.get(i)
    // Três estados, não quatro: existe sessão e ela conta (feito), existe e não
    // conta (meio), ou não existe (vazio). Se está em andamento ou já fechou não
    // muda o desenho — o que muda é ter passado da metade.
    const estado = !s ? 'vazio' : contaComoDiaTreinado(s) ? 'feito' : 'meio'
    return { indice: i, estado, agora: i === idxDeHoje, sessao: s || null }
  })
}

/* ---------------------------------------------------- dias treinados --- */

/**
 * Dias que têm pelo menos uma sessão valendo como treino, em 'YYYY-MM-DD'.
 * É o que `evolucao.diasTreinados` cruza com as execuções antigas.
 */
export function diasComSessao(sessoes) {
  const dias = new Set()
  listar(sessoes).forEach(s => { if (contaComoDiaTreinado(s)) dias.add(s.dia) })
  return dias
}

/** Dias em que existe sessão, contando ou não. Marca o que já tem dono. */
export function diasQueTemSessao(sessoes) {
  const dias = new Set()
  listar(sessoes).forEach(s => dias.add(s.dia))
  return dias
}

/**
 * OS DIAS TREINADOS. É esta que as telas devem usar — frequência, sequência,
 * treinos no mês, calendário, heatmap e o "sem treinar há N dias" do personal.
 *
 * Antes disto, cinco lugares diferentes montavam o próprio conjunto de dias a
 * partir das execuções (`evolucao.diasTreinados`, duas vezes no `AlunoHome`,
 * `AlunoDetalhe` e o `ultimoTs` do `PersonalHome`). Cada um respondia "o aluno
 * treinou?" à sua maneira, e bastava uma série solta para o dia valer em todos.
 *
 * A regra agora é uma só:
 *   - dia que TEM sessão → conta apenas se alguma sessão dele atingiu a metade
 *     ou foi concluída;
 *   - dia SEM sessão nenhuma → qualquer execução conta, como sempre contou.
 *
 * A segunda metade não é descuido: é o histórico de quem usava o app antes das
 * sessões existirem. Apagar esses dias zeraria a sequência das pessoas por uma
 * mudança técnica.
 *
 * Mora aqui, e não em `evolucao.js`, porque `sessoes.js` já importa `diaISO`
 * dali — a volta criaria um ciclo entre os dois arquivos.
 */
export function diasQueContam(execucoes, sessoes) {
  const porExecucao = new Set()
  Object.values(execucoes || {}).forEach(e => {
    if (e && typeof e.ts === 'number') porExecucao.add(diaISO(new Date(e.ts)))
  })
  if (!sessoes || Object.keys(sessoes).length === 0) return porExecucao

  const temDono = diasQueTemSessao(sessoes)
  const contam = diasComSessao(sessoes)
  const saida = new Set()
  porExecucao.forEach(d => { if (!temDono.has(d) || contam.has(d)) saida.add(d) })
  // Sessão que conta e não deixou execução (caso raro) ainda é um dia treinado.
  contam.forEach(d => saida.add(d))
  return saida
}

/* ------------------------------------------------- progresso da sessão -- */

/**
 * As execuções que pertencem a esta sessão.
 *
 * Execução nova traz `sessaoId` e o casamento é exato. As antigas não têm o
 * campo: elas entram na PRIMEIRA sessão do dia, nunca em todas. Sem essa
 * regra, quem já tinha marcado séries quando a atualização chegou veria os
 * vistos sumirem; e colocá-las em toda sessão do dia traria de volta o bug de
 * o supino do B aparecer feito no C.
 */
export function execucoesDaSessao(execucoes, sessao, sessoes) {
  if (!sessao) return {}
  const primeiraDoDia = listar(sessoes)
    .filter(s => s.dia === sessao.dia)
    .reduce((menor, s) => (!menor || s.inicioEm < menor.inicioEm ? s : menor), null)
  const adotaOrfas = primeiraDoDia?.id === sessao.id

  const saida = {}
  Object.entries(execucoes || {}).forEach(([id, e]) => {
    if (!e || typeof e.ts !== 'number') return
    if (e.sessaoId) { if (e.sessaoId === sessao.id) saida[id] = e; return }
    if (adotaOrfas && diaISO(new Date(e.ts)) === sessao.dia) saida[id] = e
  })
  return saida
}

/**
 * O mapa `exercício_série -> { id, peso, ts }` que a tela usa para saber o que
 * já está marcado. Mesma chave de antes, mas só com o que é da sessão.
 */
export function feitasDaSessao(execucoes, sessao, sessoes) {
  const f = {}
  Object.entries(execucoesDaSessao(execucoes, sessao, sessoes)).forEach(([id, e]) => {
    f[e.exercicio + '_' + e.serie] = { id, peso: e.peso ?? '', ts: e.ts }
  })
  return f
}

/** Sem sessão aberta: o comportamento antigo, as execuções soltas de hoje. */
export function feitasSoltasDeHoje(execucoes, hoje = new Date()) {
  const dia = diaISO(hoje)
  const f = {}
  Object.entries(execucoes || {}).forEach(([id, e]) => {
    if (!e || typeof e.ts !== 'number') return
    if (e.sessaoId) return
    if (diaISO(new Date(e.ts)) !== dia) return
    f[e.exercicio + '_' + e.serie] = { id, peso: e.peso ?? '', ts: e.ts }
  })
  return f
}
