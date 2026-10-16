import { ref, onValue, onDisconnect, set, serverTimestamp } from 'firebase/database'
import { db } from '../firebase'

/*
  Presença online.

  `presenca/{uid}` guarda { online, visto }. O Firebase apaga o online sozinho
  quando a conexão cai (onDisconnect), então não fica ninguém "online" para
  sempre por ter fechado a aba no tapa.

  Precisa de regra no banco — veja firebase-regras/database.rules.json.
*/

/** Marca o usuário como online e agenda o offline para quando cair. */
export function conectarPresenca(uid) {
  if (!uid) return () => {}

  const meu = ref(db, 'presenca/' + uid)
  const conectado = ref(db, '.info/connected')

  const parar = onValue(conectado, snap => {
    if (snap.val() === false) return
    // Só depois que o servidor confirma o desligamento é seguro dizer que está online.
    onDisconnect(meu)
      .set({ online: false, visto: serverTimestamp() })
      .then(() => set(meu, { online: true, visto: serverTimestamp() }))
      .catch(err => console.warn('Presença indisponível:', err?.code || err))
  })

  return () => {
    parar()
    set(meu, { online: false, visto: Date.now() }).catch(() => {})
  }
}

/**
 * Observa a conexão DESTE aparelho com o Firebase. Chama onMudar(true|false).
 *
 * Não confundir com presença: presença é "fulano está no app"; isto é "as
 * minhas escritas estão indo para o servidor agora ou ficando na fila".
 *
 * É o que sustenta o aviso de offline na marcação de série. O Firebase aplica
 * a escrita localmente e enfileira enquanto a página estiver aberta — a série
 * aparece marcada na hora, mas quem está na academia sem sinal precisa saber
 * que ainda não subiu.
 */
export function observarConexao(onMudar) {
  return onValue(
    ref(db, '.info/connected'),
    snap => onMudar(snap.val() === true),
    // Sem leitura do estado de conexão, o silêncio é melhor que um alarme falso.
    () => onMudar(true)
  )
}

/** Observa a presença de outra pessoa. Chama onMudar({ online, visto }). */
export function observarPresenca(uid, onMudar) {
  if (!uid) return () => {}
  return onValue(
    ref(db, 'presenca/' + uid),
    snap => onMudar(snap.val() || { online: false, visto: null }),
    () => onMudar({ online: false, visto: null })
  )
}
