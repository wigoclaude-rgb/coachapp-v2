import { ref, runTransaction, remove } from 'firebase/database'
import { db } from '../firebase'
import { TOMADO, PARCIAL, NAO_TOMADO, caminhoDose, diaISO } from './suplementos'

/*
  Escrita de dose, num lugar só.

  Quatro telas registram dose (a suplementação do aluno, a do personal para si,
  e os avisos flutuantes das duas home). Cada uma tinha seu próprio
  `update({ vezes: feitas + 1 })`, lido de um estado React que pode estar
  desatualizado — dois toques rápidos liam o mesmo `feitas` e gravavam o mesmo
  número, ou pulavam um.

  Aqui a conta é feita pelo servidor, dentro de uma transação: ele lê o valor
  atual, aplica, e se alguém escreveu no meio do caminho refaz sozinho. É o que
  torna o duplo toque inofensivo de verdade, e não só na aparência.
*/

/**
 * Grava o que aconteceu com a dose.
 *
 * `estado` é a declaração do aluno. Para `tomado` com várias doses ao dia, cada
 * chamada soma uma — só vira `tomado` quando completa; antes disso fica `parcial`.
 */
export function registrarDose({ alunoId, supId, dia = diaISO(), estado, vezesAoDia = 1 }) {
  const hoje = diaISO()
  const alvo = ref(db, caminhoDose(alunoId, dia, supId))

  return runTransaction(alvo, atual => {
    const feitas = Number(atual?.vezes) || 0

    if (estado === NAO_TOMADO) {
      return { estado: NAO_TOMADO, vezes: 0, ts: Date.now(), retroativo: dia !== hoje }
    }
    if (estado === PARCIAL) {
      return { estado: PARCIAL, vezes: Math.max(1, Math.min(feitas, vezesAoDia)), ts: Date.now(), retroativo: dia !== hoje }
    }

    // tomado: soma uma dose. O teto evita que o toque repetido passe do previsto.
    const vezes = Math.min(feitas + 1, vezesAoDia)
    return {
      estado: vezes >= vezesAoDia ? TOMADO : PARCIAL,
      vezes,
      ts: Date.now(),
      retroativo: dia !== hoje
    }
  })
}

/** Desfaz uma dose. Chegando a zero, o registro some e o dia volta a "não registrado". */
export function desfazerDose({ alunoId, supId, dia = diaISO(), vezesAoDia = 1 }) {
  const alvo = ref(db, caminhoDose(alunoId, dia, supId))

  return runTransaction(alvo, atual => {
    if (!atual) return null
    // Quem estava em "não tomei" ou numa dose única volta direto para não registrado.
    const feitas = Number(atual.vezes) || 0
    if (atual.estado === NAO_TOMADO || feitas <= 1) return null
    const vezes = feitas - 1
    return { ...atual, estado: vezes >= vezesAoDia ? TOMADO : PARCIAL, vezes, ts: Date.now() }
  })
}

/** Apaga a declaração do dia: volta a "não registrado", sem inventar nada. */
export function limparDose({ alunoId, supId, dia }) {
  return remove(ref(db, caminhoDose(alunoId, dia, supId)))
}

/** Mensagem que o aluno resolve sozinho. O detalhe técnico fica no console. */
export function mensagemErroDose(err) {
  const t = String(err?.code || err?.message || err).toUpperCase()
  if (t.includes('PERMISSION_DENIED')) {
    return 'O banco recusou a gravação. As regras de "suplementosTomados" precisam estar publicadas no Firebase.'
  }
  return 'Não foi possível salvar. Verifique sua conexão e tente de novo.'
}
