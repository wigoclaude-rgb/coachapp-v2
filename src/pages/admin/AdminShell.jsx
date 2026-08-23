import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { signOut } from 'firebase/auth'
import { ref, onValue } from 'firebase/database'
import { auth, db } from '../../firebase'
import { normalizarAssinatura } from '../../lib/planos'

/**
 * Carrega o retrato do negócio: personais, assinaturas e quantos alunos cada um
 * tem de verdade.
 *
 * `studentCount` é CALCULADO a partir de `personals/{uid}/alunos`, nunca lido de
 * um campo. Campo em `users/` é gravável pelo próprio personal — contagem vinda
 * de lá poderia ser forjada para furar o limite do Free.
 */
export function useDadosAdmin() {
  const [users, setUsers] = useState({})
  const [planos, setPlanos] = useState({})
  const [personals, setPersonals] = useState({})
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')

  useEffect(() => {
    const falha = e => {
      setErro('Sem permissão para ler os dados. Confira as regras de admin no Firebase.')
      console.warn('Admin sem leitura:', e?.code || e)
      setCarregando(false)
    }
    const u1 = onValue(ref(db, 'users'), s => { setUsers(s.val() || {}); setCarregando(false) }, falha)
    const u2 = onValue(ref(db, 'planos'), s => setPlanos(s.val() || {}), falha)
    const u3 = onValue(ref(db, 'personals'), s => setPersonals(s.val() || {}), falha)
    return () => { u1(); u2(); u3() }
  }, [])

  const lista = useMemo(() => (
    Object.entries(users)
      .filter(([, u]) => u?.role === 'personal')
      .map(([uid, u]) => ({
        uid,
        nome: u.nome || '(sem nome)',
        email: u.email || '',
        criadoEm: u.criadoEm || null,
        assinatura: normalizarAssinatura(planos[uid]),
        studentCount: Object.keys(personals[uid]?.alunos || {}).length
      }))
      .sort((a, b) => a.nome.localeCompare(b.nome))
  ), [users, planos, personals])

  return { lista, carregando, erro }
}

/** Casca do painel: navegação e sair. Fora do Layout normal do app. */
export default function AdminShell({ titulo, subtitulo, acao, children }) {
  const { pathname } = useLocation()
  const em = rota => pathname === rota || (rota !== '/admin' && pathname.startsWith(rota))

  return (
    <div className="admin-wrap">
      <header className="admin-topo">
        <div className="admin-marca">
          WIGO <span>ADMIN</span>
        </div>
        <nav className="admin-nav">
          <Link className={'admin-link' + (em('/admin') && pathname === '/admin' ? ' ativo' : '')} to="/admin">Início</Link>
          <Link className={'admin-link' + (em('/admin/personals') ? ' ativo' : '')} to="/admin/personals">Personais</Link>
        </nav>
        <button className="btn btn-ghost btn-sm" onClick={() => signOut(auth).then(() => { window.location.href = '/admin/login' })}>
          Sair
        </button>
      </header>

      <main className="admin-corpo">
        <div className="admin-cabecalho">
          <div style={{ minWidth: 0 }}>
            <h1>{titulo}</h1>
            {subtitulo && <p className="muted">{subtitulo}</p>}
          </div>
          {acao}
        </div>
        {children}
      </main>
    </div>
  )
}
