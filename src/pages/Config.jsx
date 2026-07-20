import { useState } from 'react'
import { updatePassword, updateEmail } from 'firebase/auth'
import { ref, update } from 'firebase/database'
import { auth, db } from '../firebase'
import FotoInput from '../components/FotoInput.jsx'

export default function Config({ user, perfil }) {
  const [nome, setNome] = useState(perfil.nome || '')
  const [telefone, setTelefone] = useState(perfil.telefone || '')
  const [objetivo, setObjetivo] = useState(perfil.objetivo || '')
  const [chavePix, setChavePix] = useState(perfil.chavePix || '')
  const [novoEmail, setNovoEmail] = useState('')
  const [novaSenha, setNovaSenha] = useState('')
  const [msg, setMsg] = useState('')
  const [erro, setErro] = useState('')
  const ehPersonal = perfil.role === 'personal'

  async function salvarDados(e) {
    e.preventDefault()
    setMsg(''); setErro('')
    const dados = { nome, telefone }
    if (ehPersonal) dados.chavePix = chavePix
    else dados.objetivo = objetivo
    await update(ref(db, 'users/' + user.uid), dados)
    setMsg('Dados salvos.')
  }

  async function salvarFoto(img) {
    await update(ref(db, 'users/' + user.uid), { foto: img })
  }

  async function trocarEmail(e) {
    e.preventDefault()
    setMsg(''); setErro('')
    try {
      await updateEmail(auth.currentUser, novoEmail)
      await update(ref(db, 'users/' + user.uid), { email: novoEmail })
      setMsg('E-mail atualizado.')
      setNovoEmail('')
    } catch (err) {
      setErro('Por segurança, saia e entre novamente antes de trocar o e-mail.')
    }
  }

  async function trocarSenha(e) {
    e.preventDefault()
    setMsg(''); setErro('')
    try {
      await updatePassword(auth.currentUser, novaSenha)
      setMsg('Senha atualizada.')
      setNovaSenha('')
    } catch (err) {
      setErro('Por segurança, saia e entre novamente antes de trocar a senha.')
    }
  }

  return (
    <>
      <div className="card">
        <h2>Foto do perfil</h2>
        <FotoInput atual={perfil.foto} onFoto={salvarFoto} circular rotulo="Trocar foto" />
      </div>

      <div className="card">
        <h2>Meus dados</h2>
        <form onSubmit={salvarDados}>
          <label>Nome</label>
          <input value={nome} onChange={e => setNome(e.target.value)} required />
          <label>Telefone</label>
          <input value={telefone} onChange={e => setTelefone(e.target.value)} placeholder="(00) 00000-0000" />
          {ehPersonal && (
            <>
              <label>Chave PIX (o aluno verá essa chave para pagar)</label>
              <input value={chavePix} onChange={e => setChavePix(e.target.value)} placeholder="CPF, e-mail, telefone ou aleatória" />
            </>
          )}
          {!ehPersonal && (
            <>
              <label>Objetivo</label>
              <input value={objetivo} onChange={e => setObjetivo(e.target.value)} placeholder="Ex: hipertrofia, emagrecimento" />
            </>
          )}
          {msg && <div className="ok">{msg}</div>}
          {erro && <div className="erro">{erro}</div>}
          <button className="btn">Salvar dados</button>
        </form>
      </div>

      <div className="card">
        <h2>Trocar e-mail</h2>
        <p className="muted">E-mail atual: {perfil.email}</p>
        <form onSubmit={trocarEmail}>
          <label>Novo e-mail</label>
          <input type="email" value={novoEmail} onChange={e => setNovoEmail(e.target.value)} required />
          <button className="btn btn-sec">Atualizar e-mail</button>
        </form>
      </div>

      <div className="card">
        <h2>Trocar senha</h2>
        <form onSubmit={trocarSenha}>
          <label>Nova senha</label>
          <input type="password" value={novaSenha} onChange={e => setNovaSenha(e.target.value)} required minLength={6} />
          <button className="btn btn-sec">Atualizar senha</button>
        </form>
      </div>
    </>
  )
}
