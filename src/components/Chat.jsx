import { useEffect, useMemo, useRef, useState } from 'react'
import { ref, push, update, onValue } from 'firebase/database'
import { db } from '../firebase'
import { notificar } from '../lib/notify'
import { fmtHora, fmtDataLonga, fmtQuando } from '../lib/util'
import { observarPresenca } from '../lib/presenca'
import Avatar from './Avatar.jsx'
import { IcCheck, IcEnviar } from './Icones.jsx'

/** Agrupa as mensagens por dia, para render com separador de data. */
function porDia(msgs) {
  const grupos = []
  msgs.forEach(m => {
    const dia = new Date(m.ts).toDateString()
    const ultimo = grupos[grupos.length - 1]
    if (ultimo && ultimo.dia === dia) ultimo.msgs.push(m)
    else grupos.push({ dia, ts: m.ts, msgs: [m] })
  })
  return grupos
}

export default function Chat({ chatId, meuUid, outroUid, outroNome, outroFoto, rotaNotif }) {
  const [msgs, setMsgs] = useState([])
  const [texto, setTexto] = useState('')
  const [presenca, setPresenca] = useState({ online: false, visto: null })
  const [reciboAberto, setReciboAberto] = useState(null)
  const [enviando, setEnviando] = useState(false)
  const fim = useRef(null)

  useEffect(() => (
    onValue(ref(db, 'chats/' + chatId), snap => {
      const val = snap.val() || {}
      setMsgs(Object.entries(val).map(([id, m]) => ({ id, ...m })).sort((a, b) => a.ts - b.ts))
    })
  ), [chatId])

  useEffect(() => observarPresenca(outroUid, setPresenca), [outroUid])

  useEffect(() => { fim.current?.scrollIntoView({ behavior: 'smooth' }) }, [msgs.length])

  /*
    Marca como lidas as mensagens que o outro mandou e ainda não tinham recibo.
    É isso que vira o segundo tique do lado dele.
  */
  useEffect(() => {
    const pendentes = msgs.filter(m => m.de !== meuUid && !m.lidaEm)
    if (pendentes.length === 0) return
    const agora = Date.now()
    const alteracoes = {}
    pendentes.forEach(m => {
      alteracoes[m.id + '/lidaEm'] = agora
      alteracoes[m.id + '/lidaPor'] = meuUid
    })
    update(ref(db, 'chats/' + chatId), alteracoes)
      .catch(err => console.warn('Não foi possível marcar como lida:', err?.code || err))
  }, [msgs, chatId, meuUid])

  const grupos = useMemo(() => porDia(msgs), [msgs])

  async function enviar(e) {
    e.preventDefault()
    const limpo = texto.trim()
    if (!limpo || enviando) return
    setEnviando(true)
    setTexto('')
    try {
      await push(ref(db, 'chats/' + chatId), { de: meuUid, texto: limpo, ts: Date.now() })
      if (outroUid) notificar(outroUid, 'Nova mensagem no chat', rotaNotif || '')
    } catch (err) {
      setTexto(limpo) // devolve o texto para não perder o que foi digitado
      console.warn('Falha ao enviar mensagem:', err)
    }
    setEnviando(false)
  }

  const statusTexto = presenca.online
    ? 'Online'
    : presenca.visto ? 'Visto por último ' + fmtQuando(presenca.visto) : 'Offline'

  return (
    <div className="chat-box">
      <header className="chat-cabecalho">
        <Avatar foto={outroFoto} nome={outroNome} tamanho={44} online={presenca.online} />
        <div style={{ minWidth: 0 }}>
          <div className="ch-nome">{outroNome || 'Conversa'}</div>
          <div className={'ch-status ' + (presenca.online ? 'on' : '')}>{statusTexto}</div>
        </div>
      </header>

      <div className="chat-msgs">
        {msgs.length === 0 && (
          <p className="muted" style={{ textAlign: 'center', marginTop: 24 }}>
            Nenhuma mensagem ainda. Envie a primeira.
          </p>
        )}

        {grupos.map(g => (
          <div key={g.dia}>
            <div className="chat-dia"><span>{fmtDataLonga(g.ts)}</span></div>
            {g.msgs.map(m => {
              const minha = m.de === meuUid
              return (
                <div
                  key={m.id}
                  className={'msg ' + (minha ? 'minha' : 'outra')}
                  onClick={() => minha && m.lidaEm && setReciboAberto(reciboAberto === m.id ? null : m.id)}
                >
                  <span className="msg-texto">{m.texto}</span>
                  <span className="msg-meta">
                    {fmtHora(m.ts)}
                    {minha && (
                      <span className={'msg-tique ' + (m.lidaEm ? 'lida' : '')} title={m.lidaEm ? 'Visualizado' : 'Enviado'}>
                        <IcCheck />
                        {m.lidaEm && <IcCheck />}
                      </span>
                    )}
                  </span>

                  {minha && reciboAberto === m.id && m.lidaEm && (
                    <div className="msg-recibo">
                      <IcCheck />
                      <span>
                        Visualizado {fmtDataLonga(m.lidaEm).toLowerCase()} às {fmtHora(m.lidaEm)}
                        {outroNome ? ' por ' + outroNome.split(' ')[0] : ''}
                      </span>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        ))}
        <div ref={fim} />
      </div>

      <form className="chat-input" onSubmit={enviar}>
        <input
          value={texto}
          onChange={e => setTexto(e.target.value)}
          placeholder="Digite sua mensagem..."
          aria-label="Mensagem"
        />
        <button type="submit" className="btn" disabled={!texto.trim() || enviando}>
          <IcEnviar /> Enviar
        </button>
      </form>
    </div>
  )
}
