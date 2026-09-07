/*
  Estado de uma cobrança, num lugar só.

  O PIX acontece FORA do CoachApp: o aluno copia a chave, paga pelo banco e volta
  para avisar. Por isso existe um estado entre "em aberto" e "pago" — o intervalo
  em que o aluno já fez a parte dele e o personal ainda não conferiu o extrato.

    pendente ──"Já paguei"──▶ em_analise ──personal confirma──▶ pago
       ▲                           │
       └───── personal recusa ─────┘   (vira `recusado`)

  `recusado` é um estado próprio, e não uma volta para `pendente`, porque o aluno
  precisa saber que o registro dele foi visto e negado — e por quê. Antes, recusar
  devolvia para `pendente` e a tela ficava idêntica à de quem nunca informou nada:
  o aluno não tinha como saber que algo aconteceu.

  Quem impede o aluno de informar duas vezes é a regra do Realtime Database
  (`firebase-regras/database.rules.json`), não esta biblioteca. Aqui só decidimos
  o que a tela mostra.
*/

import { hojeISO, fmtData } from './util'

export const PENDENTE = 'pendente'
export const EM_ANALISE = 'em_analise'
export const PAGO = 'pago'
export const RECUSADO = 'recusado'

/** Estados em que a cobrança ainda é devida. */
export const ABERTOS = [PENDENTE, RECUSADO]

const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
]

/** Status desconhecido ou ausente conta como pendente — cobrança antiga não some da tela. */
export function normalizar(c) {
  const status = [PENDENTE, EM_ANALISE, PAGO, RECUSADO].includes(c?.status) ? c.status : PENDENTE
  return { ...c, status, valor: Number(c?.valor) || 0, vencimento: c?.vencimento || '' }
}

export const ehAberta = c => ABERTOS.includes(normalizar(c).status)

/**
 * Vencida = ainda devida e a data já passou.
 *
 * `em_analise` NÃO conta como vencida aqui: o aluno já fez a parte dele. Mas o
 * bloqueio do treino (em `util.vencida`) continua valendo até o personal
 * confirmar — senão bastaria tocar em "Já paguei" para destravar sem pagar.
 */
export function estaVencida(c, hoje = hojeISO()) {
  const n = normalizar(c)
  return ehAberta(n) && !!n.vencimento && n.vencimento < hoje
}

/** "Setembro/2026" a partir do vencimento. É como a pessoa chama a mensalidade. */
export function referencia(c) {
  const partes = String(c?.vencimento || '').split('-')
  if (partes.length !== 3) return ''
  const mes = Number(partes[1]) - 1
  if (mes < 0 || mes > 11) return ''
  return MESES[mes] + '/' + partes[0]
}

/** "Mensalidade de setembro" / "Cobrança de 03/09" — o título da cobrança na tela. */
export function titulo(c) {
  const ref = referencia(c)
  if (c?.tipo === 'mensal' && ref) return 'Mensalidade de ' + ref.split('/')[0].toLowerCase()
  if (ref) return 'Cobrança de ' + dataBR(c.vencimento)
  return 'Cobrança'
}

/** 2026-09-03 -> 03/09/2026 */
export const dataBR = iso => String(iso || '').split('-').reverse().join('/')

/**
 * Separa a lista bruta do banco no que a tela precisa.
 *
 * `informaveis` é o coração da regra de produto: só recebe o botão "Já paguei" o
 * que está vencido (tudo que está atrasado, porque o aluno pode dever vários
 * meses) e a próxima a vencer (para quem paga adiantado). Mensalidade de daqui a
 * três meses é informativa — antes, todas as doze traziam um botão, e a tela
 * virava uma lista de botões idênticos que não faziam sentido nenhum.
 */
export function organizar(bruto, hoje = hojeISO()) {
  const lista = Object.entries(bruto || {}).map(([id, c]) => ({ id, ...normalizar(c) }))

  const porVencimento = (a, b) => a.vencimento.localeCompare(b.vencimento)

  const abertas = lista.filter(ehAberta).sort(porVencimento)
  const vencidas = abertas.filter(c => estaVencida(c, hoje))
  const aVencer = abertas.filter(c => !estaVencida(c, hoje))

  const emAnalise = lista.filter(c => c.status === EM_ANALISE).sort(porVencimento)
  const pagas = lista.filter(c => c.status === PAGO)
    .sort((a, b) => (b.validadaEm || 0) - (a.validadaEm || 0))

  // A próxima a vencer também entra: pagar adiantado é legítimo.
  const acionaveis = [...vencidas, ...aVencer.slice(0, 1)]
  const informaveis = new Set(acionaveis.map(c => c.id))

  return {
    lista,
    abertas,
    vencidas,
    emAnalise,
    pagas,
    informaveis,
    // O cartão principal: o atraso mais antigo, ou a próxima a vencer.
    atual: acionaveis[0] || null,
    // Os outros atrasos, abaixo do cartão principal. Estes ainda pedem ação.
    outras: acionaveis.slice(1),
    /*
      As demais, só informativas. Os três blocos são disjuntos de propósito: numa
      primeira versão a mesma mensalidade aparecia em "outras cobranças", em
      "próximas" e no histórico, e a tela ficava três vezes mais longa sem dizer
      nada a mais.
    */
    futuras: aVencer.filter(c => !informaveis.has(c.id)),
    totalVencido: vencidas.reduce((s, c) => s + c.valor, 0),
    totalAberto: abertas.reduce((s, c) => s + c.valor, 0)
  }
}

/**
 * O extrato: o que já foi confirmado, do mais recente para o mais antigo.
 *
 * Só as pagas. O que está em aberto, vencido ou aguardando confirmação já ocupa
 * o topo da tela — repetir aqui embaixo não acrescenta informação nenhuma.
 */
export function historico(lista) {
  return lista
    .filter(c => normalizar(c).status === PAGO)
    .sort((a, b) => (b.validadaEm || 0) - (a.validadaEm || 0))
}

/**
 * Rótulo e tom do selo de estado. `tom` casa com as classes `.pag-selo` do CSS.
 * Aluno e personal usam o mesmo — o estado tem que se chamar igual dos dois lados.
 */
export function selo(c, hoje = hojeISO()) {
  const n = normalizar(c)
  if (n.status === PAGO) return { rotulo: 'Pago', tom: 'ok' }
  if (n.status === EM_ANALISE) return { rotulo: 'Aguardando confirmação', tom: 'analise' }
  if (n.status === RECUSADO) return { rotulo: 'Não confirmado', tom: 'erro' }
  if (estaVencida(n, hoje)) return { rotulo: 'Vencida', tom: 'erro' }
  return { rotulo: 'Em aberto', tom: 'neutro' }
}

/** A linha de apoio embaixo do valor: o que aconteceu, ou o que falta acontecer. */
export function legenda(c) {
  const n = normalizar(c)
  if (n.status === PAGO) {
    return n.validadaEm ? 'Pagamento confirmado em ' + fmtData(n.validadaEm) : 'Pagamento confirmado'
  }
  if (n.status === EM_ANALISE) {
    return n.pagamento?.data
      ? 'Você informou em ' + fmtData(n.pagamento.data)
      : 'Pagamento informado'
  }
  if (n.status === RECUSADO) return 'O personal não confirmou este pagamento'
  return 'Vence em ' + dataBR(n.vencimento)
}
