import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { signInWithEmailAndPassword, signOut } from 'firebase/auth'
import { ref, get } from 'firebase/database'
import { auth, db } from '../../firebase'

/*
  Login do painel master. Não é linkado em lugar nenhum do app — chega-se aqui
  digitando a URL.

  Se o e-mail existir mas não for admin, desloga na hora: entrar com conta de
  personal aqui não pode deixar sessão aberta no contexto do painel.
*/
export default function AdminLogin() {
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState('')
  const [uidNegado, setUidNegado] = useState('')
  const [entrando, setEntrando] = useState(false)
  const navigate = useNavigate()

  async function entrar(e) {
    e.preventDefault()
    setErro(''); setEntrando(true)
    try {
      const cred = await signInWithEmailAndPassword(auth, email.trim(), senha)
      const snap = await get(ref(db, 'admins/' + cred.user.uid))
      if (snap.val() !== true) {
        /*
          Autenticou mas não está autorizada. Mostrar o UID aqui é o que torna o
          primeiro acesso possível sem garimpar o Console: é o valor exato que
          precisa virar `admins/{uid} = true`, e ele não é segredo — a pessoa
          acabou de provar que é dona da conta.
        */
        setUidNegado(cred.user.uid)
        await signOut(auth)
        setErro('Esta conta não tem acesso ao painel.')
        setEntrando(false)
        return
      }
      navigate('/admin', { replace: true })
    } catch (err) {
      // Mensagem única de propósito: não confirmar se o e-mail existe.
      setErro('E-mail ou senha incorretos.')
    }
    setEntrando(false)
  }

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <h1>WIGO ADMIN</h1>
        <p className="sub">Painel administrativo do CoachApp.</p>
        <form onSubmit={entrar}>
          <label>E-mail</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="username" />
          <label>Senha</label>
          <input type="password" value={senha} onChange={e => setSenha(e.target.value)} required autoComplete="current-password" />
          {erro && <div className="erro">{erro}</div>}

          {uidNegado && (
            <div className="uid-negado">
              <span className="mini">Para liberar, crie no Realtime Database:</span>
              <code>admins / {uidNegado} / true</code>
              <button
                type="button" className="btn btn-sec btn-sm btn-auto"
                onClick={() => navigator.clipboard.writeText(uidNegado)}
              >
                Copiar UID
              </button>
              <span className="mini">
                O <strong>true</strong> precisa ser booleano, não o texto "true".
              </span>
            </div>
          )}
          <button className="btn" disabled={entrando}>{entrando ? 'Entrando...' : 'Entrar'}</button>
        </form>
      </div>
    </div>
  )
}
