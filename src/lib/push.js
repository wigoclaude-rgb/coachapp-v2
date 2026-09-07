/*
  Inscrição de push do navegador.

  O caminho é: registrar o service worker → pedir permissão → criar a inscrição
  no serviço de push do navegador → guardar em `pushSubs/{uid}`. Quem envia é a
  função agendada do Netlify, que lê esse nó.

  IPHONE
    O Safari só entrega push para app ADICIONADO À TELA DE INÍCIO (iOS 16.4+).
    Não é escolha nossa nem contornável: no navegador comum, `PushManager` nem
    existe. Por isso `motivoIndisponivel()` devolve um texto específico — o
    aluno precisa saber que falta instalar, não achar que o app está quebrado.

  UMA INSCRIÇÃO POR APARELHO
    A chave é derivada do endpoint, não sorteada. Assim o mesmo celular
    reinscrito atualiza o registro em vez de criar um segundo, que renderia
    notificação dobrada.
*/

import { ref, set, remove, get } from 'firebase/database'
import { db } from '../firebase'

const CHAVE_VAPID = import.meta.env.VITE_VAPID_PUBLIC_KEY || ''

export const temSuporte = () =>
  typeof window !== 'undefined' &&
  'serviceWorker' in navigator &&
  'PushManager' in window &&
  'Notification' in window

export const ehIOS = () =>
  /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)

/** No iOS, push só existe quando o app foi instalado na tela de início. */
export const instaladoNaTela = () =>
  window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true

/** Texto do porquê de não dar para ativar aqui. Vazio quando dá. */
export function motivoIndisponivel() {
  if (typeof window === 'undefined') return 'Indisponível neste dispositivo.'
  if (ehIOS() && !instaladoNaTela()) {
    return 'No iPhone, os lembretes só funcionam com o CoachApp adicionado à tela de início. '
      + 'Toque em Compartilhar e depois em "Adicionar à Tela de Início".'
  }
  if (!temSuporte()) return 'Este navegador não recebe notificações. Tente pelo Chrome ou Safari atualizado.'
  if (!CHAVE_VAPID) return 'Os lembretes ainda não foram configurados neste servidor.'
  if (Notification.permission === 'denied') {
    return 'As notificações estão bloqueadas para o CoachApp. Libere nas configurações do navegador e volte aqui.'
  }
  return ''
}

export const permissaoAtual = () =>
  typeof Notification === 'undefined' ? 'default' : Notification.permission

export async function registrarServiceWorker() {
  if (!('serviceWorker' in navigator)) return null
  return navigator.serviceWorker.register('/sw.js', { scope: '/' })
}

/* A chave VAPID viaja em base64url e o navegador quer bytes. */
function paraBytes(base64url) {
  const preenchido = base64url.padEnd(base64url.length + (4 - base64url.length % 4) % 4, '=')
  const bin = atob(preenchido.replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(bin, c => c.charCodeAt(0))
}

/* Identidade estável do aparelho, derivada do endpoint. */
function idDoEndpoint(endpoint) {
  let h = 5381
  for (let i = 0; i < endpoint.length; i++) h = ((h * 33) ^ endpoint.charCodeAt(i)) >>> 0
  return 'd' + h.toString(36)
}

const paraBase64 = buffer =>
  btoa(String.fromCharCode(...new Uint8Array(buffer)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

/**
 * Ativa os lembretes neste aparelho. Devolve { ok, erro }.
 * A permissão é pedida aqui — no momento em que o aluno ligou um lembrete, e
 * não ao abrir o app.
 */
export async function ativar(uid) {
  const impedimento = motivoIndisponivel()
  if (impedimento) return { ok: false, erro: impedimento }

  try {
    const permissao = await Notification.requestPermission()
    if (permissao !== 'granted') {
      return {
        ok: false,
        erro: permissao === 'denied'
          ? 'Você bloqueou as notificações. Para receber os lembretes, libere nas configurações do navegador.'
          : 'Permissão não concedida. Toque em "Ativar notificações" e escolha Permitir.'
      }
    }

    const registro = await registrarServiceWorker()
    await navigator.serviceWorker.ready

    // Uma inscrição anterior pode ter sido criada com outra chave VAPID.
    const antiga = await registro.pushManager.getSubscription()
    if (antiga) await antiga.unsubscribe().catch(() => {})

    const inscricao = await registro.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: paraBytes(CHAVE_VAPID)
    })

    const dados = inscricao.toJSON()
    await set(ref(db, 'pushSubs/' + uid + '/' + idDoEndpoint(dados.endpoint)), {
      endpoint: dados.endpoint,
      p256dh: dados.keys?.p256dh || '',
      auth: dados.keys?.auth || '',
      // O fuso do aparelho: é ele que faz "05:00" ser 05:00 para este aluno.
      tz: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
      criadoEm: Date.now()
    })

    return { ok: true, erro: '' }
  } catch (err) {
    console.error('Falha ao ativar notificações:', err)
    return { ok: false, erro: 'Não foi possível ativar os lembretes agora. Tente novamente.' }
  }
}

/** Desliga neste aparelho. Não mexe nos outros em que o aluno esteja inscrito. */
export async function desativar(uid) {
  try {
    const registro = await navigator.serviceWorker?.getRegistration('/')
    const inscricao = await registro?.pushManager.getSubscription()
    if (inscricao) {
      await remove(ref(db, 'pushSubs/' + uid + '/' + idDoEndpoint(inscricao.endpoint)))
      await inscricao.unsubscribe().catch(() => {})
    }
    return { ok: true }
  } catch (err) {
    console.warn('Falha ao desativar notificações:', err)
    return { ok: false }
  }
}

/** Este aparelho já está inscrito? Confere o navegador E o banco. */
export async function estaAtivo(uid) {
  if (!temSuporte() || permissaoAtual() !== 'granted') return false
  try {
    const registro = await navigator.serviceWorker.getRegistration('/')
    const inscricao = await registro?.pushManager.getSubscription()
    if (!inscricao) return false
    const snap = await get(ref(db, 'pushSubs/' + uid + '/' + idDoEndpoint(inscricao.endpoint)))
    return snap.exists()
  } catch {
    return false
  }
}
