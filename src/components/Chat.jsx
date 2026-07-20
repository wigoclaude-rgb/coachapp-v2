import { useEffect, useRef, useState } from 'react'
import { ref, push, onValue } from 'firebase/database'
import { db } from '../firebase'
import { notificar } from '../lib/notify'
import { fmtHora } from '../lib/util'

export default function Chat({ chatId, meuUid, outroUid, rotaNotif }) {
  const [msgs, setMsgs] = useState([])
  const [texto, setTexto] = useState('')
  const fim = useRef(null)

  useEffect(() => {
    const unsub = onValue(ref(db, 'chats/' + chatId), snap => {
      const val = snap.val() || {}
      setMsgs(Object.entries(val).map(([id, m]) => ({ id, ...m })).sort((a, b) => a.ts - b.ts))
    })
    return unsub
  }, [chatId])

  useEffect(() => { fim.current?.scrollIntoView({ behavior: 'smooth' }) }, [msgs])

  async function enviar(e) {
    e.preventDefault()
    if (!texto.trim()) return
    await push(ref(db, 'chats/' + chatId), { de: meuUid, texto: texto.trim(), ts: Date.now() })
    if (outroUid) notificar(outroUid, 'Nova mensagem no chat', rotaNotif || '')
    setTexto('')
  }

  return (
    <div className="chat-box">
      <div className="chat-msgs">
        {msgs.length === 0 && <p className="muted" style={{ textAlign: 'center', marginTop: 20 }}>Nenhuma mensagem ainda. Envie a primeira.</p>}
        {msgs.map(m => (
          <div key={m.id} className={'msg ' + (m.de === meuUid ? 'minha' : 'outra')}>
            {m.texto}
            <span className="hora">{fmtHora(m.ts)}</span>
          </div>
        ))}
        <div ref={fim} />
      </div>
      <form className="chat-input" onSubmit={enviar}>
        <input value={texto} onChange={e => setTexto(e.target.value)} placeholder="Escreva uma mensagem" />
        <button type="submit">Enviar</button>
      </form>
    </div>
  )
}
