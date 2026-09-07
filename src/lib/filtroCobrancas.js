/*
  Filtro de cobranças, separado da tela.

  Três telas filtram cobrança — o Financeiro do personal, o histórico do aluno e,
  de lado, a lista de alunos. Se cada uma escrever seu próprio `filter`, "vencida"
  passa a significar coisas diferentes em cada canto. A regra mora aqui.

  A busca é do personal (nome do aluno); no histórico do aluno ela não aparece,
  porque só existe uma pessoa ali.
*/

import { hojeISO } from './util'
import { normalizar, estaVencida, PENDENTE, EM_ANALISE, PAGO, RECUSADO } from './cobrancas'

export const STATUS_FILTRO = [
  { id: 'todos', rotulo: 'Todas' },
  { id: 'aberto', rotulo: 'Em aberto' },
  { id: 'vencida', rotulo: 'Vencidas' },
  { id: 'analise', rotulo: 'Aguardando' },
  { id: 'pago', rotulo: 'Pagas' },
  { id: 'recusado', rotulo: 'Recusadas' }
]

export const PERIODOS = [
  { id: 'tudo', rotulo: 'Todo o período' },
  { id: 'mes', rotulo: 'Este mês' },
  { id: 'passado', rotulo: 'Mês passado' },
  { id: 'tri', rotulo: 'Últimos 3 meses' },
  { id: 'ano', rotulo: 'Este ano' },
  { id: 'datas', rotulo: 'Escolher datas' }
]

export const ORDENS = [
  { id: 'venc_desc', rotulo: 'Vencimento (mais recente)' },
  { id: 'venc_asc', rotulo: 'Vencimento (mais antigo)' },
  { id: 'valor_desc', rotulo: 'Maior valor' },
  { id: 'valor_asc', rotulo: 'Menor valor' },
  { id: 'aluno', rotulo: 'Nome do aluno' }
]

export const filtroVazio = () => ({
  busca: '', status: 'todos', periodo: 'tudo',
  de: '', ate: '', min: '', max: '', ordem: 'venc_desc'
})

/** Quantos critérios estão ativos — vira o número no botão "Limpar". */
export function quantosAtivos(f) {
  const v = filtroVazio()
  return Object.keys(v).filter(k => k !== 'ordem' && f[k] && f[k] !== v[k]).length
}

const doMes = (ano, mes) => {
  const m = String(mes + 1).padStart(2, '0')
  const ultimo = new Date(ano, mes + 1, 0).getDate()
  return { de: ano + '-' + m + '-01', ate: ano + '-' + m + '-' + String(ultimo).padStart(2, '0') }
}

/** Traduz o período escolhido para um intervalo de datas ISO. */
export function intervaloDe(f, hoje = hojeISO()) {
  const [ano, mes] = hoje.split('-').map(Number)
  if (f.periodo === 'mes') return doMes(ano, mes - 1)
  if (f.periodo === 'passado') {
    const d = new Date(ano, mes - 2, 1)
    return doMes(d.getFullYear(), d.getMonth())
  }
  if (f.periodo === 'tri') {
    const d = new Date(ano, mes - 3, 1)
    return { de: doMes(d.getFullYear(), d.getMonth()).de, ate: doMes(ano, mes - 1).ate }
  }
  if (f.periodo === 'ano') return { de: ano + '-01-01', ate: ano + '-12-31' }
  if (f.periodo === 'datas') return { de: f.de || '', ate: f.ate || '' }
  return { de: '', ate: '' }
}

/** A cobrança bate com o status escolhido? */
export function casaStatus(c, status, hoje = hojeISO()) {
  if (status === 'todos') return true
  const n = normalizar(c)
  if (status === 'vencida') return estaVencida(n, hoje)
  // "Em aberto" é o que ainda é devido e ainda não venceu — vencida tem chip próprio.
  if (status === 'aberto') return (n.status === PENDENTE || n.status === RECUSADO) && !estaVencida(n, hoje)
  if (status === 'analise') return n.status === EM_ANALISE
  if (status === 'pago') return n.status === PAGO
  if (status === 'recusado') return n.status === RECUSADO
  return true
}

const semAcento = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

/**
 * Aplica o filtro e ordena. Cada item precisa de `vencimento`, `valor`, `status`
 * e — quando houver busca — `aluno`.
 */
export function aplicar(lista, f, hoje = hojeISO()) {
  const { de, ate } = intervaloDe(f, hoje)
  const q = semAcento(f.busca).trim()
  const min = f.min === '' ? null : Number(f.min)
  const max = f.max === '' ? null : Number(f.max)

  const filtrada = lista.filter(c => {
    if (!casaStatus(c, f.status, hoje)) return false
    if (de && (c.vencimento || '') < de) return false
    if (ate && (c.vencimento || '') > ate) return false
    const valor = Number(c.valor) || 0
    if (min !== null && !Number.isNaN(min) && valor < min) return false
    if (max !== null && !Number.isNaN(max) && valor > max) return false
    if (q && !semAcento(c.aluno).includes(q)) return false
    return true
  })

  const porVenc = (a, b) => (a.vencimento || '').localeCompare(b.vencimento || '')
  const ordenadores = {
    venc_desc: (a, b) => porVenc(b, a),
    venc_asc: porVenc,
    valor_desc: (a, b) => (Number(b.valor) || 0) - (Number(a.valor) || 0),
    valor_asc: (a, b) => (Number(a.valor) || 0) - (Number(b.valor) || 0),
    aluno: (a, b) => semAcento(a.aluno).localeCompare(semAcento(b.aluno)) || porVenc(a, b)
  }
  return filtrada.sort(ordenadores[f.ordem] || ordenadores.venc_desc)
}

/** Somatórios do que está na tela — o filtro sem total não responde nada. */
export function totais(lista, hoje = hojeISO()) {
  const soma = sel => lista.filter(sel).reduce((s, c) => s + (Number(c.valor) || 0), 0)
  return {
    quantidade: lista.length,
    total: soma(() => true),
    recebido: soma(c => normalizar(c).status === PAGO),
    aReceber: soma(c => normalizar(c).status !== PAGO),
    vencido: soma(c => estaVencida(c, hoje)),
    aguardando: soma(c => normalizar(c).status === EM_ANALISE)
  }
}

/** Anos presentes na lista, do mais novo — vira os chips do histórico do aluno. */
export function anosDe(lista) {
  return [...new Set(lista.map(c => String(c.vencimento || '').slice(0, 4)).filter(Boolean))]
    .sort((a, b) => b.localeCompare(a))
}
