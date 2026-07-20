import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ref, onValue, update } from 'firebase/database'
import { db } from '../firebase'
import { fmtData, fmtHora } from '../lib/util'

export default function Notificacoes({ uid }) {
  const [lista, setLista] = useState([])
  const [aberto, setAberto] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    const unsub = onValue(ref(db, 'notificacoes/' + uid), snap => {
      const val = snap.val() || {}
      const arr = Object.entries(val).map(([id, n]) => ({ id, ...n })).sort((a, b) => b.ts - a.ts).slice(0, 30)
      setLista(arr)
    })
    return unsub
  }, [uid])

  const naoLidas = lista.filter(n => !n.lida).length

  async function abrir(n) {
    await update(ref(db, 'notificacoes/' + uid + '/' + n.id), { lida: true })
    setAberto(false)
    if (n.rota) navigate(n.rota)
  }

  async function marcarTodas() {
    const updates = {}
    lista.forEach(n => { if (!n.lida) updates['notificacoes/' + uid + '/' + n.id + '/lida'] = true })
    if (Object.keys(updates).length) await update(ref(db), updates)
  }

  return (
    <div className="notif-wrap">
      <button className="notif-sino" onClick={() => setAberto(!aberto)} title="Notificações">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.7 21a2 2 0 0 1-3.4 0" />
        </svg>
        {naoLidas > 0 && <span className="notif-badge">{naoLidas}</span>}
      </button>
      {aberto && (
        <div className="notif-painel">
          <div className="notif-topo">
            <strong>Notificações</strong>
            {naoLidas > 0 && <button onClick={marcarTodas}>Marcar todas como lidas</button>}
          </div>
          {lista.length === 0 && <p className="muted" style={{ padding: 14 }}>Nenhuma notificação.</p>}
          {lista.map(n => (
            <div key={n.id} className={'notif-item ' + (n.lida ? '' : 'nao-lida')} onClick={() => abrir(n)}>
              <div>{n.texto}</div>
              <span className="muted">{fmtData(n.ts)} {fmtHora(n.ts)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
