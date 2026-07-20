import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { createUserWithEmailAndPassword } from 'firebase/auth'
import { ref, set } from 'firebase/database'
import { auth, db } from '../firebase'

export default function CadastroPersonal() {
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState('')
  const [enviando, setEnviando] = useState(false)
  const navigate = useNavigate()

  async function cadastrar(e) {
    e.preventDefault()
    setErro(''); setEnviando(true)
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, senha)
      await set(ref(db, 'users/' + cred.user.uid), {
        role: 'personal', nome, email, foto: '', chavePix: '', telefone: ''
      })
      navigate('/')
    } catch (err) {
      if (err.code === 'auth/email-already-in-use') setErro('Este e-mail já está em uso.')
      else if (err.code === 'auth/weak-password') setErro('A senha precisa ter pelo menos 6 caracteres.')
      else setErro('Não foi possível criar a conta. Tente novamente.')
    }
    setEnviando(false)
  }

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <h1>Conta de Personal</h1>
        <p className="sub">Crie sua conta para montar treinos e acompanhar alunos.</p>
        <form onSubmit={cadastrar}>
          <label>Nome</label>
          <input value={nome} onChange={e => setNome(e.target.value)} required />
          <label>E-mail</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} required />
          <label>Senha</label>
          <input type="password" value={senha} onChange={e => setSenha(e.target.value)} required minLength={6} />
          {erro && <div className="erro">{erro}</div>}
          <button className="btn" disabled={enviando}>{enviando ? 'Criando...' : 'Criar conta'}</button>
        </form>
        <div className="link-row"><Link to="/">Voltar ao login</Link></div>
      </div>
    </div>
  )
}
