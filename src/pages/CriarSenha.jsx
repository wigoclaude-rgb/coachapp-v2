import { useState } from 'react'
import { updatePassword, signOut } from 'firebase/auth'
import { ref, update } from 'firebase/database'
import { auth, db } from '../firebase'

/**
 * Primeiro acesso: o aluno entrou com a senha temporária que o personal mandou
 * e precisa criar a própria antes de usar o app. Isso invalida a senha que
 * ficou no histórico do WhatsApp.
 */
export default function CriarSenha({ user, perfil }) {
  const [senha, setSenha] = useState('')
  const [confirma, setConfirma] = useState('')
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)

  const curta = senha.length > 0 && senha.length < 6
  const divergem = confirma.length > 0 && senha !== confirma

  async function salvar(e) {
    e.preventDefault()
    setErro('')
    if (senha.length < 6) return setErro('A senha precisa ter pelo menos 6 caracteres.')
    if (senha !== confirma) return setErro('As duas senhas não são iguais.')

    setSalvando(true)
    try {
      await updatePassword(auth.currentUser, senha)
      await update(ref(db, 'users/' + user.uid), { precisaTrocarSenha: null })
    } catch (err) {
      if (err?.code === 'auth/requires-recent-login') {
        setErro('Sua sessão expirou. Entre de novo com a senha temporária para continuar.')
      } else if (err?.code === 'auth/weak-password') {
        setErro('Senha muito fraca. Use pelo menos 6 caracteres.')
      } else {
        setErro('Não foi possível salvar a senha. Tente novamente.')
      }
      console.warn('Falha ao criar senha:', err)
      setSalvando(false)
    }
  }

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <h1>Crie sua senha</h1>
        <p className="sub">
          Olá{perfil?.nome ? ', ' + perfil.nome.split(' ')[0] : ''}! Esse é seu primeiro acesso.
          Escolha uma senha só sua — a que você recebeu na mensagem deixa de valer.
        </p>

        <form onSubmit={salvar}>
          <label>Nova senha</label>
          <input
            type="password" value={senha} autoFocus autoComplete="new-password"
            onChange={e => setSenha(e.target.value)} required
          />
          {curta && <p className="mini">Faltam {6 - senha.length} caractere(s).</p>}

          <label>Repita a senha</label>
          <input
            type="password" value={confirma} autoComplete="new-password"
            onChange={e => setConfirma(e.target.value)} required
          />
          {divergem && <p className="mini">As senhas ainda não batem.</p>}

          {erro && <div className="erro">{erro}</div>}

          <button className="btn" disabled={salvando}>
            {salvando ? 'Salvando...' : 'Salvar e entrar'}
          </button>
        </form>

        <div className="link-row">
          <a href="#" onClick={e => { e.preventDefault(); signOut(auth) }}>Sair</a>
        </div>
      </div>
    </div>
  )
}
