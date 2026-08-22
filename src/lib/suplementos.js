/*
  Suplementação do aluno.

  Dois nós, com donos diferentes:
    suplementos/{alunoUid}/{id}            — o que tomar (aluno OU personal cadastra)
    suplementosTomados/{alunoUid}/{dia}    — o que foi tomado (só o aluno marca)

  Separar é o que permite o personal indicar sem poder marcar por ele. Quem toma
  é o aluno; se o personal pudesse confirmar, a aderência viraria ficção — o
  mesmo motivo pelo qual ele não marca série na prévia do treino.
*/

export const DIAS_SEMANA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']

export const QUEM_INDICOU = [
  { id: 'nutricionista', rotulo: 'Nutricionista' },
  { id: 'personal', rotulo: 'Personal' },
  { id: 'medico', rotulo: 'Médico' },
  { id: 'proprio', rotulo: 'Por conta própria' }
]

/** 2026-08-22 — chave do dia, no fuso local. */
export const diaISO = (d = new Date()) =>
  d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')

export const suplementoVazio = () => ({
  nome: '',
  marca: '',
  dose: '',
  vezesAoDia: 1,
  frequencia: 'diario',
  dias: [],
  horario: '',
  indicadoPor: 'proprio',
  observacao: '',
  ativo: true
})

/** Preenche o que faltar, para registro antigo não quebrar a tela. */
export function normalizarSuplemento(s) {
  if (!s) return null
  return {
    ...suplementoVazio(),
    ...s,
    vezesAoDia: Math.max(1, Number(s.vezesAoDia) || 1),
    dias: Array.isArray(s.dias) ? s.dias : [],
    ativo: s.ativo !== false
  }
}

/** Se o suplemento entra no dia pedido. */
export function tocaHoje(sup, d = new Date()) {
  if (!sup?.ativo) return false
  if (sup.frequencia === 'dias') return (sup.dias || []).includes(d.getDay())
  return true
}

/** Quantas vezes foi tomado num dia. */
export const vezesNoDia = (tomados, supId, dia) =>
  Number(tomados?.[dia]?.[supId]?.vezes) || 0

/** Falta tomar hoje? */
export function faltaHoje(sup, supId, tomados, d = new Date()) {
  if (!tocaHoje(sup, d)) return false
  return vezesNoDia(tomados, supId, diaISO(d)) < sup.vezesAoDia
}

/**
 * Dias seguidos cumprindo a dose cheia, contando de hoje para trás.
 * Dia em que o suplemento não toca é pulado, não quebra a sequência —
 * quem toma só de segunda a sexta não perde a conta no domingo.
 */
export function sequencia(sup, supId, tomados, hoje = new Date()) {
  if (!sup) return 0
  const cursor = new Date(hoje)
  cursor.setHours(0, 0, 0, 0)

  // Hoje ainda incompleto não zera a conta: o dia não acabou.
  if (tocaHoje(sup, cursor) && vezesNoDia(tomados, supId, diaISO(cursor)) < sup.vezesAoDia) {
    cursor.setDate(cursor.getDate() - 1)
  }

  let n = 0
  for (let i = 0; i < 400; i++) {
    if (tocaHoje(sup, cursor)) {
      if (vezesNoDia(tomados, supId, diaISO(cursor)) >= sup.vezesAoDia) n++
      else break
    }
    cursor.setDate(cursor.getDate() - 1)
  }
  return n
}

/**
 * Aderência nos últimos `janela` dias: cumpridos / esperados.
 * `null` quando nada era esperado no período — sem isso o suplemento recém
 * cadastrado apareceria com 0%, que é injusto e assusta o aluno.
 */
export function aderencia(sup, supId, tomados, janela = 30, hoje = new Date()) {
  if (!sup) return null
  let esperados = 0
  let cumpridos = 0
  const cursor = new Date(hoje)
  cursor.setHours(0, 0, 0, 0)

  /*
    Compara dia com dia, não instante com instante: cadastrado às 10h, o `inicio`
    seria maior que a meia-noite de hoje e o proprio dia do cadastro ficaria de
    fora da conta — para sempre, não só hoje.
  */
  const inicioDia = sup.inicio ? new Date(sup.inicio) : null
  inicioDia?.setHours(0, 0, 0, 0)

  for (let i = 0; i < janela; i++) {
    if (inicioDia && cursor.getTime() >= inicioDia.getTime() && tocaHoje(sup, cursor)) {
      esperados++
      if (vezesNoDia(tomados, supId, diaISO(cursor)) >= sup.vezesAoDia) cumpridos++
    }
    cursor.setDate(cursor.getDate() - 1)
  }
  if (esperados === 0) return null
  return Math.round((cumpridos / esperados) * 100)
}

/** "2 scoops · 2x ao dia · seg, qua, sex" */
export function resumoSuplemento(sup) {
  const partes = []
  if (sup.dose) partes.push(sup.dose)
  if (sup.vezesAoDia > 1) partes.push(sup.vezesAoDia + 'x ao dia')
  if (sup.frequencia === 'dias' && sup.dias?.length) {
    partes.push(sup.dias.slice().sort().map(d => DIAS_SEMANA[d]).join(', '))
  } else {
    partes.push('todo dia')
  }
  return partes.join(' · ')
}
