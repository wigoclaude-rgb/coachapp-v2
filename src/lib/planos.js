import { ref, push, update, get } from 'firebase/database'
import { db } from '../firebase'

/*
  Plano comercial do personal.

  Mora em `planos/{personalId}`, e NÃO dentro de `users/{personalId}`, por um
  motivo de segurança que não dá para contornar: no Realtime Database, `.write`
  concedido num nó pai vale para todos os filhos, e regra de filho não revoga.
  Como o personal precisa escrever no próprio `users/{uid}` (nome, foto, senha),
  qualquer campo ali seria gravável por ele — inclusive `plan: "pro"`.

  Em nó separado, a regra é simples: leitura para o dono e para o admin, escrita
  só para o admin. O personal não consegue se promover nem pela API.
*/

export const PLANOS = {
  free: { id: 'free', rotulo: 'Free', limite: 4, preco: 0 },
  pro: { id: 'pro', rotulo: 'Pro', limite: 999, preco: 49.9 }
}

export const STATUS = [
  { id: 'active', rotulo: 'Ativo' },
  { id: 'past_due', rotulo: 'Em atraso' },
  { id: 'canceled', rotulo: 'Cancelado' },
  { id: 'blocked', rotulo: 'Bloqueado' }
]

export const rotuloStatus = id => STATUS.find(s => s.id === id)?.rotulo || id

/** Quem nunca foi tocado pelo admin é Free ativo com 4 alunos. */
export function normalizarAssinatura(a) {
  const plan = a?.plan === 'pro' ? 'pro' : 'free'
  return {
    plan,
    planStatus: a?.planStatus || 'active',
    studentLimit: Number(a?.studentLimit) > 0 ? Number(a.studentLimit) : PLANOS[plan].limite,
    planExpiresAt: a?.planExpiresAt || null,
    planUpdatedAt: a?.planUpdatedAt || null,
    adminNote: a?.adminNote || ''
  }
}

/** Conta bloqueada não deveria conseguir operar. */
export const contaBloqueada = a => a?.planStatus === 'blocked'

/** Vencida = tem data e ela já passou. Sem data, nunca vence. */
export function assinaturaVencida(a) {
  if (!a?.planExpiresAt) return false
  return a.planExpiresAt < Date.now()
}

/** Pode cadastrar mais um aluno? */
export function podeCriarAluno(assinatura, quantosJaTem) {
  const a = normalizarAssinatura(assinatura)
  if (contaBloqueada(a)) return { pode: false, motivo: 'bloqueado' }
  if (quantosJaTem >= a.studentLimit) return { pode: false, motivo: 'limite' }
  return { pode: true, motivo: null }
}

/*
  Id da conversa de suporte entre o personal e o CoachApp.

  Os dois UIDs entram no id porque a regra de `chats` libera quem está contido
  nele — assim os dois leem a mesma conversa sem precisar de regra nova. A ordem
  é fixa (suporte primeiro) para os dois lados montarem exatamente o mesmo id.
*/
export const chatSuporte = (suporteUid, personalUid) => suporteUid + '_' + personalUid

/* ---------------- escrita (só o admin chega aqui) ---------------- */

/** Grava o log antes de qualquer coisa dar errado depois. */
export async function registrarLog({ adminUid, targetPersonalId, action, from, to, note }) {
  return push(ref(db, 'adminLogs'), {
    at: Date.now(),
    adminUid,
    targetPersonalId,
    action,
    from: from ?? null,
    to: to ?? null,
    note: note || ''
  })
}

/**
 * Aplica mudanças na assinatura e deixa rastro. `mudancas` é parcial.
 * Trocar de plano leva o limite junto — Pro com limite 4 seria um bug silencioso.
 */
export async function alterarAssinatura({ adminUid, personalId, acao, mudancas, nota }) {
  const atual = normalizarAssinatura(
    (await get(ref(db, 'planos/' + personalId))).val()
  )

  const novo = { ...mudancas, planUpdatedAt: Date.now() }
  if (mudancas.plan && mudancas.studentLimit === undefined) {
    novo.studentLimit = PLANOS[mudancas.plan].limite
  }

  await update(ref(db, 'planos/' + personalId), novo)

  const campo = Object.keys(mudancas)[0]
  await registrarLog({
    adminUid,
    targetPersonalId: personalId,
    action: acao,
    from: atual[campo] ?? null,
    to: mudancas[campo] ?? null,
    note: nota
  })
}
