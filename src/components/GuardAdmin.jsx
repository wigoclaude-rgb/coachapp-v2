import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { onAuthStateChanged, signOut } from 'firebase/auth'
import { ref, get } from 'firebase/database'
import { auth, db } from '../firebase'

/*
  Porteiro de /admin/*.

  Duas condições, as duas obrigatórias: estar autenticado no Firebase Auth E ter
  `admins/{uid} === true` no banco. O nó só é criado pelo Console — nenhum
  cliente escreve em `admins/`, então não há caminho de auto-promoção.

  Enquanto verifica, não renderiza nada do painel. Personal ou aluno que digitar
  a URL vê "Acesso negado" e não recebe dado nenhum: os componentes filhos só
  montam depois do `ok`.
*/
export default function GuardAdmin({ children }) {
  const [estado, setEstado] = useState('checando')  // checando | ok | negado | deslogado
  const [uid, setUid] = useState(null)

  useEffect(() => {
    return onAuthStateChanged(auth, async u => {
      if (!u) { setUid(null); setEstado('deslogado'); return }
      setUid(u.uid)
      try {
        const snap = await get(ref(db, 'admins/' + u.uid))
        setEstado(snap.val() === true ? 'ok' : 'negado')
      } catch {
        // Regra nega leitura de quem não é admin — negar é a resposta certa.
        setEstado('negado')
      }
    })
  }, [])

  if (estado === 'checando') return <div className="loading">Verificando acesso...</div>
  if (estado === 'deslogado') return <Navigate to="/admin/login" replace />

  if (estado === 'negado') {
    return (
      <div className="auth-wrap">
        <div className="auth-card">
          <h1>Acesso negado</h1>
          <p className="sub">Esta área é restrita. Sua conta não tem permissão.</p>
          <button className="btn" onClick={() => signOut(auth).then(() => { window.location.href = '/' })}>
            Voltar ao início
          </button>
        </div>
      </div>
    )
  }

  return typeof children === 'function' ? children(uid) : children
}
