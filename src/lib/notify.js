import { ref, push } from 'firebase/database'
import { db } from '../firebase'

export function notificar(uid, texto, rota) {
  if (!uid) return
  return push(ref(db, 'notificacoes/' + uid), {
    texto, rota: rota || '', ts: Date.now(), lida: false
  })
}
