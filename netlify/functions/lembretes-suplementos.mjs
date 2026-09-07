/*
  O agendador dos lembretes de suplementação.

  É a única parte do CoachApp que roda fora do navegador, e existe por um motivo
  técnico simples: com o app fechado, nada no celular acorda às 05:00. Só um push
  vindo de fora chega — e alguém precisa mandar.

  Roda de minuto em minuto (ver netlify.toml). A cada passagem:
    1. lê quem tem inscrição de push (`pushSubs`)
    2. para cada aluno, no FUSO DELE, decide o que vence agora (lib/lembretes.js)
    3. não envia o que já foi enviado (`lembretesEnviados/{uid}/{dia}`)
    4. envia, e só então grava o registro

  A decisão de "o que vence agora" NÃO está aqui de propósito: mora em
  `src/lib/lembretes.js`, junto do app, e é testada sem servidor nem celular.

  CREDENCIAIS (variáveis de ambiente no Netlify)
    FIREBASE_SERVICE_ACCOUNT  JSON da conta de serviço
    VITE_VAPID_PUBLIC_KEY     a chave pública (a mesma que o front usa)
    VAPID_PRIVATE_KEY         a privada; só aqui, nunca no front

  As outras duas são deduzidas: a URL do banco reaproveita a
  VITE_FIREBASE_DATABASE_URL que o site já tem para buildar, e o assunto VAPID
  tem um padrão. Cada variável a menos é um passo a menos para errar na mão.

  A conta de serviço ignora as regras do Realtime Database. É por isso que ela
  nunca pode chegar ao navegador.
*/

import admin from 'firebase-admin'
import webpush from 'web-push'
import { lembretesDevidos, agrupar } from '../../src/lib/lembretes.js'

const JANELA = 5          // minutos olhados para trás, para recuperar execução perdida
const MAX_ALUNOS = 500    // teto por passagem, para a função não estourar o tempo

let app = null
function firebase() {
  if (app) return app
  const cred = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || '{}')
  app = admin.apps.length
    ? admin.app()
    : admin.initializeApp({
        credential: admin.credential.cert(cred),
        databaseURL: process.env.FIREBASE_DATABASE_URL
          || process.env.VITE_FIREBASE_DATABASE_URL
      })
  return app
}

function configurarWebPush() {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:wigoclaude@gmail.com',
    process.env.VAPID_PUBLIC_KEY || process.env.VITE_VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  )
}

const leia = async (db, caminho) => (await db.ref(caminho).once('value')).val() || {}

/** Houve série hoje? É o que decide o suplemento de "apenas dias de treino". */
function treinouNoDia(execucoes, dia) {
  return Object.values(execucoes || {}).some(e => {
    if (!e?.ts) return false
    const d = new Date(e.ts)
    const local = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0')
      + '-' + String(d.getDate()).padStart(2, '0')
    return local === dia
  })
}

export default async function handler() {
  const inicio = Date.now()
  const faltando = [
    ['FIREBASE_SERVICE_ACCOUNT', process.env.FIREBASE_SERVICE_ACCOUNT],
    ['VAPID_PRIVATE_KEY', process.env.VAPID_PRIVATE_KEY],
    ['VITE_VAPID_PUBLIC_KEY', process.env.VAPID_PUBLIC_KEY || process.env.VITE_VAPID_PUBLIC_KEY],
    ['VITE_FIREBASE_DATABASE_URL', process.env.FIREBASE_DATABASE_URL || process.env.VITE_FIREBASE_DATABASE_URL]
  ].filter(([, v]) => !v).map(([k]) => k)

  // Diz QUAL falta: "credenciais ausentes" manda a pessoa conferir as quatro.
  if (faltando.length) {
    console.error('Lembretes: faltam variáveis no Netlify —', faltando.join(', '))
    return new Response('faltam: ' + faltando.join(', '), { status: 200 })
  }

  configurarWebPush()
  const db = firebase().database()
  const agora = new Date()

  const todasInscricoes = await leia(db, 'pushSubs')
  const uids = Object.keys(todasInscricoes).slice(0, MAX_ALUNOS)

  let enviados = 0, falhas = 0, inscricoesRemovidas = 0

  for (const uid of uids) {
    const aparelhos = Object.entries(todasInscricoes[uid] || {})
    if (aparelhos.length === 0) continue

    // O fuso é do aparelho; se houver vários, o mais recente manda.
    const maisRecente = aparelhos.map(([, a]) => a)
      .sort((a, b) => (b.criadoEm || 0) - (a.criadoEm || 0))[0]
    const tz = maisRecente?.tz || 'UTC'

    const [suplementos, tomados, prefs, execucoes] = await Promise.all([
      leia(db, `suplementos/${uid}`),
      leia(db, `suplementosTomados/${uid}`),
      leia(db, `users/${uid}/notificacoes`),
      leia(db, `execucoes/${uid}`)
    ])
    if (Object.keys(suplementos).length === 0) continue

    const dia = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit'
    }).format(agora)

    const jaEnviados = await leia(db, `lembretesEnviados/${uid}/${dia}`)

    const devidos = lembretesDevidos({
      suplementos, tomados, prefs, jaEnviados, tz,
      instante: agora, janela: JANELA,
      treinouHoje: treinouNoDia(execucoes, dia)
    })
    if (devidos.length === 0) continue

    for (const grupo of agrupar(devidos)) {
      const carga = JSON.stringify({
        titulo: grupo.titulo,
        corpo: grupo.corpo,
        rota: grupo.rota,
        tag: 'sup_' + grupo.horario
      })

      /*
        Grava o registro ANTES de enviar. Se a gravação falhar depois do envio,
        a próxima passagem repetiria a notificação — e o aluno recebendo a mesma
        cobrança de minuto em minuto desliga tudo e não volta. Perder um
        lembrete é melhor do que repetir sem parar.
      */
      await Promise.all(grupo.chaves.map(chave =>
        db.ref(`lembretesEnviados/${uid}/${dia}/${chave}`).transaction(atual => ({
          n: (atual?.n || 0) + 1,
          ts: Date.now(),
          tipo: grupo.tipo
        }))
      ))

      for (const [idAparelho, aparelho] of aparelhos) {
        try {
          await webpush.sendNotification({
            endpoint: aparelho.endpoint,
            keys: { p256dh: aparelho.p256dh, auth: aparelho.auth }
          }, carga)
          enviados++
        } catch (err) {
          falhas++
          // 404/410: o navegador descartou a inscrição. Guardar não adianta mais.
          if (err?.statusCode === 404 || err?.statusCode === 410) {
            await db.ref(`pushSubs/${uid}/${idAparelho}`).remove()
            inscricoesRemovidas++
          } else {
            console.error('Push falhou para', uid, err?.statusCode || err?.message)
          }
        }
      }
    }
  }

  const resumo = `alunos=${uids.length} enviados=${enviados} falhas=${falhas} `
    + `inscricoesRemovidas=${inscricoesRemovidas} ms=${Date.now() - inicio}`
  console.log('Lembretes:', resumo)
  return new Response(resumo, { status: 200 })
}

/* De minuto em minuto. O horário exato quem resolve é a lib, no fuso do aluno. */
export const config = { schedule: '* * * * *' }
