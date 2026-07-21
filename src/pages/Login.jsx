import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth'
import { ref, get } from 'firebase/database'
import { auth, db } from '../firebase'

export default function Login() {
  const [modo, setModo] = useState('personal') // personal | aluno | recuperar
  const [email, setEmail] = useState('')
  const [codigo, setCodigo] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState('')
  const [ok, setOk] = useState('')
useEffect(() => {
  const params = new URLSearchParams(window.location.search)
  const modoURL = params.get('modo')
  const codigoURL = params.get('codigo')
  
  if (modoURL === 'aluno') {
    setModo('aluno')
    if (codigoURL) setCodigo(codigoURL)
  }
}, [])
  const [enviando, setEnviando] = useState(false)
  const navigate = useNavigate()

  async function entrarPersonal(e) {
    e.preventDefault()
    setErro(''); setEnviando(true)
    try {
      await signInWithEmailAndPassword(auth, email, senha)
      navigate('/')
    } catch (err) {
      setErro('E-mail ou senha incorretos.')
    }
    setEnviando(false)
  }

  async function entrarAluno(e) {
    e.preventDefault()
    setErro(''); setEnviando(true)
    try {
      const cod = codigo.trim().toUpperCase()
      const snap = await get(ref(db, 'codigos/' + cod))
      if (!snap.exists()) {
        setErro('Código de acesso não encontrado. Confirme com o seu personal.')
        setEnviando(false)
        return
      }
      const dados = snap.val()
      await signInWithEmailAndPassword(auth, dados.email, senha)
      navigate('/')
    } catch (err) {
      setErro('Senha incorreta. Se esqueceu, use "Esqueci a senha".')
    }
    setEnviando(false)
  }

  async function recuperar(e) {
    e.preventDefault()
    setErro(''); setOk(''); setEnviando(true)
    try {
      await sendPasswordResetEmail(auth, email)
      setOk('Enviamos um link de redefinição para o seu e-mail.')
    } catch (err) {
      setErro('Não foi possível enviar. Confira o e-mail digitado.')
    }
    setEnviando(false)
  }

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <h1>COACHAPP</h1>
        <p className="sub">Treinos entre personal e aluno, em um só lugar.</p>

        {modo !== 'recuperar' && (
          <div className="tabs" style={{ marginBottom: 6 }}>
            <button type="button" className={'tab ' + (modo === 'personal' ? 'ativa' : '')} onClick={() => { setModo('personal'); setErro('') }}>Sou Personal</button>
            <button type="button" className={'tab ' + (modo === 'aluno' ? 'ativa' : '')} onClick={() => { setModo('aluno'); setErro('') }}>Sou Aluno</button>
          </div>
        )}

        {modo === 'personal' && (
          <form onSubmit={entrarPersonal}>
            <label>E-mail</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required />
            <label>Senha</label>
            <input type="password" value={senha} onChange={e => setSenha(e.target.value)} required />
            {erro && <div className="erro">{erro}</div>}
            <button className="btn" disabled={enviando}>{enviando ? 'Entrando...' : 'Entrar'}</button>
            <div className="link-row">
              <a href="#" onClick={e => { e.preventDefault(); setModo('recuperar'); setErro('') }}>Esqueci a senha</a><br />
              Novo por aqui? <Link to="/cadastro-personal">Criar conta de personal</Link>
            </div>
          </form>
        )}

        {modo === 'aluno' && (
          <form onSubmit={entrarAluno}>
            <label>Código de acesso</label>
            <input value={codigo} onChange={e => setCodigo(e.target.value)} placeholder="Ex: A7K2M9" required />
            <label>Senha</label>
            <input type="password" value={senha} onChange={e => setSenha(e.target.value)} required />
            {erro && <div className="erro">{erro}</div>}
            <button className="btn" disabled={enviando}>{enviando ? 'Entrando...' : 'Entrar'}</button>
            <div className="link-row">
              <a href="#" onClick={e => { e.preventDefault(); setModo('recuperar'); setErro('') }}>Esqueci a senha</a><br />
              <span className="muted">Seu personal cria a sua conta e envia o código.</span>
            </div>
          </form>
        )}

        {modo === 'recuperar' && (
          <form onSubmit={recuperar}>
            <label>E-mail cadastrado</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required />
            {erro && <div className="erro">{erro}</div>}
            {ok && <div className="ok">{ok}</div>}
            <button className="btn" disabled={enviando}>{enviando ? 'Enviando...' : 'Enviar link de redefinição'}</button>
            <div className="link-row">
              <a href="#" onClick={e => { e.preventDefault(); setModo('personal'); setErro(''); setOk('') }}>Voltar ao login</a>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
