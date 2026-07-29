import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ref, onValue, update } from 'firebase/database'
import { db } from '../firebase'
import { fmtData, fmtHora } from '../lib/util'
import { IcSino } from './Icones.jsx'

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
        <IcSino />
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
