import { useEffect, useMemo, useState } from 'react'
import { ref, onValue } from 'firebase/database'
import { db } from '../../firebase'
import AdminShell, { useDadosAdmin } from './AdminShell.jsx'
import { chatSuporte } from '../../lib/planos'
import { fmtQuando } from '../../lib/util'
import Chat from '../../components/Chat.jsx'

/*
  Suporte: uma conversa por personal.

  Não existe (nem precisa) leitura ampla de `chats`. Como o id da conversa contém
  o UID do admin, a regra `$conversaId.contains(auth.uid)` já libera cada uma —
  então assinamos conversa a conversa, em vez de abrir o nó inteiro.
*/
export default function AdminSuporte({ adminUid }) {
  const { lista, carregando } = useDadosAdmin()
  const [conversas, setConversas] = useState({})
  const [aberto, setAberto] = useState(null)

  const ids = useMemo(() => lista.map(p => p.uid).sort().join(','), [lista])

  useEffect(() => {
    const uids = ids ? ids.split(',') : []
    if (uids.length === 0) return
    const inscricoes = uids.map(uid =>
      onValue(ref(db, 'chats/' + chatSuporte(adminUid, uid)), s => {
        const msgs = Object.values(s.val() || {}).sort((a, b) => a.ts - b.ts)
        setConversas(c => ({ ...c, [uid]: msgs }))
      }, () => {})
    )
    return () => inscricoes.forEach(cancelar => cancelar())
  }, [ids, adminUid])

  /* Quem escreveu por último e ainda não foi respondido aparece primeiro. */
  const ordenada = useMemo(() => (
    lista
      .map(p => {
        const msgs = conversas[p.uid] || []
        const ultima = msgs[msgs.length - 1] || null
        return {
          ...p,
          msgs,
          ultima,
          esperando: !!ultima && ultima.de !== adminUid
        }
      })
      .sort((a, b) => {
        if (a.esperando !== b.esperando) return a.esperando ? -1 : 1
        return (b.ultima?.ts || 0) - (a.ultima?.ts || 0)
      })
  ), [lista, conversas, adminUid])

  const semResposta = ordenada.filter(p => p.esperando).length
  const alvo = ordenada.find(p => p.uid === aberto)

  if (alvo) {
    return (
      <AdminShell
        titulo={alvo.nome}
        subtitulo={alvo.email}
        acao={<button className="btn btn-ghost btn-sm" onClick={() => setAberto(null)}>Voltar</button>}
      >
        <div className="card sem-padding">
          <Chat
            chatId={chatSuporte(adminUid, alvo.uid)}
            meuUid={adminUid}
            outroUid={alvo.uid}
            outroNome={alvo.nome}
            rotaNotif="/personal"
          />
        </div>
      </AdminShell>
    )
  }

  return (
    <AdminShell
      titulo="Suporte"
      subtitulo={semResposta > 0 ? `${semResposta} esperando resposta` : 'Nada pendente'}
    >
      {carregando && <p className="muted">Carregando...</p>}

      {!carregando && ordenada.length === 0 && (
        <div className="card">
          <div className="vazio-estado">
            <h2>Nenhum personal ainda</h2>
            <p className="muted">Quando alguém criar conta, a conversa aparece aqui.</p>
          </div>
        </div>
      )}

      {ordenada.map(p => (
        <button key={p.uid} className={'sup-conversa' + (p.esperando ? ' esperando' : '')} onClick={() => setAberto(p.uid)}>
          <div className="sc-txt">
            <span className="sc-nome">
              {p.nome}
              {p.esperando && <span className="sc-ponto" aria-label="esperando resposta" />}
            </span>
            <span className="sc-previa">
              {p.ultima
                ? (p.ultima.de === adminUid ? 'Você: ' : '') + p.ultima.texto
                : 'Nenhuma mensagem ainda'}
            </span>
          </div>
          {p.ultima && <span className="sc-quando">{fmtQuando(p.ultima.ts)}</span>}
        </button>
      ))}
    </AdminShell>
  )
}
