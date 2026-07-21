import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { createUserWithEmailAndPassword, signOut, getAuth } from 'firebase/auth'
import { initializeApp, getApps } from 'firebase/app'
import { ref, onValue, set } from 'firebase/database'
import { db, firebaseConfig } from '../../firebase'
import { fmtData, fmtMoeda, vencida, hojeISO } from '../../lib/util'
import { notificar } from '../../lib/notify'
import Chat from '../../components/Chat.jsx'
import Config from '../Config.jsx'
import MeusTemplates from './MeusTemplates.jsx'
import Financeiro from './Financeiro.jsx'

function gerarCodigo() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let c = ''
  for (let i = 0; i < 6; i++) c += chars[Math.floor(Math.random() * chars.length)]
  return c
}

export default function PersonalHome({ user, perfil }) {
  const [aba, setAba] = useState('inicio')
  const [alunos, setAlunos] = useState({})
  const [execucoes, setExecucoes] = useState({})
  const [cobrancas, setCobrancas] = useState({})
  const [chatAluno, setChatAluno] = useState(null)

  // cadastro de aluno
  const [nNome, setNNome] = useState('')
  const [nEmail, setNEmail] = useState('')
  const [nSenha, setNSenha] = useState('')
  const [nErro, setNErro] = useState('')
  const [nOk, setNOk] = useState(null)
  const [criando, setCriando] = useState(false)
  const [mostrarForm, setMostrarForm] = useState(false)

  useEffect(() => {
    const u1 = onValue(ref(db, 'personals/' + user.uid + '/alunos'), s => setAlunos(s.val() || {}))
    const u2 = onValue(ref(db, 'execucoes'), s => setExecucoes(s.val() || {}))
    const u3 = onValue(ref(db, 'cobrancas'), s => setCobrancas(s.val() || {}))
    return () => { u1(); u2(); u3() }
  }, [user.uid])

  const listaAlunos = Object.entries(alunos)
  const meusIds = new Set(Object.keys(alunos))

  // Estatísticas
  const totalAlunos = listaAlunos.length
  const hoje = new Date().toDateString()
  let execHoje = 0, ultimas = []
  Object.entries(execucoes).forEach(([aid, exs]) => {
    if (!meusIds.has(aid)) return
    Object.values(exs || {}).forEach(e => {
      if (new Date(e.ts).toDateString() === hoje) execHoje++
      ultimas.push({ ...e, aluno: alunos[aid]?.nome || 'Aluno' })
    })
  })
  ultimas = ultimas.sort((a, b) => b.ts - a.ts).slice(0, 10)

  let aReceber = 0, emAnalise = 0
  Object.entries(cobrancas).forEach(([aid, cs]) => {
    if (!meusIds.has(aid)) return
    Object.values(cs || {}).forEach(c => {
      if (c.status !== 'pago') aReceber += Number(c.valor) || 0
      if (c.status === 'em_analise') emAnalise++
    })
  })

  async function cadastrarAluno(e) {
    e.preventDefault()
    setNErro(''); setNOk(null); setCriando(true)
    try {
      // App secundário para não deslogar o personal
      const nomeSec = 'secundario'
      const secApp = getApps().find(a => a.name === nomeSec) || initializeApp(firebaseConfig, nomeSec)
      const secAuth = getAuth(secApp)
      const cred = await createUserWithEmailAndPassword(secAuth, nEmail, nSenha)
      const alunoUid = cred.user.uid
      await signOut(secAuth)

      const codigo = gerarCodigo()
      await set(ref(db, 'users/' + alunoUid), {
        role: 'aluno', nome: nNome, email: nEmail, personalId: user.uid,
        codigo, foto: '', objetivo: '', telefone: ''
      })
      await set(ref(db, 'codigos/' + codigo), { alunoUid, email: nEmail, personalId: user.uid })
      await set(ref(db, 'personals/' + user.uid + '/alunos/' + alunoUid), { nome: nNome, email: nEmail, codigo })

      setNOk({ nome: nNome, codigo })
      setNNome(''); setNEmail(''); setNSenha('')
    } catch (err) {
      if (err.code === 'auth/email-already-in-use') setNErro('Este e-mail já está em uso.')
      else if (err.code === 'auth/weak-password') setNErro('A senha precisa ter pelo menos 6 caracteres.')
      else setNErro('Não foi possível cadastrar. Tente novamente.')
    }
    setCriando(false)
  }

  return (
    <div className="container">
      <div className="tabs">
        <button className={'tab ' + (aba === 'inicio' ? 'ativa' : '')} onClick={() => setAba('inicio')}>Início</button>
        <button className={'tab ' + (aba === 'alunos' ? 'ativa' : '')} onClick={() => setAba('alunos')}>Alunos</button>
        <button className={'tab ' + (aba === 'financeiro' ? 'ativa' : '')} onClick={() => setAba('financeiro')}>Financeiro</button>
        <button className={'tab ' + (aba === 'chat' ? 'ativa' : '')} onClick={() => { setAba('chat'); setChatAluno(null) }}>Chat</button>
<button className={'tab ' + (aba === 'templates' ? 'ativa' : '')} onClick={() => setAba('templates')}>Meus Templates</button>
        <button className={'tab ' + (aba === 'config' ? 'ativa' : '')} onClick={() => setAba('config')}>Configurações</button>
      </div>

      {aba === 'inicio' && (
        <>
          <div className="stats-grid">
            <div className="stat-card"><span className="stat-num">{totalAlunos}</span><span className="stat-label">Alunos ativos</span></div>
            <div className="stat-card"><span className="stat-num">{execHoje}</span><span className="stat-label">Séries feitas hoje</span></div>
            <div className="stat-card"><span className="stat-num">{fmtMoeda(aReceber)}</span><span className="stat-label">A receber</span></div>
            <div className="stat-card"><span className="stat-num">{emAnalise}</span><span className="stat-label">Pagamentos p/ validar</span></div>
          </div>
          <div className="card">
            <h2>Últimas execuções</h2>
            {ultimas.length === 0 && <p className="muted">Nenhuma série registrada ainda.</p>}
            {ultimas.map((e, i) => (
              <div key={i} className="serie-row">
                <span style={{ fontWeight: 600, minWidth: 100 }}>{e.aluno}</span>
                <span>{e.exercicio}</span>
                <span>Série {e.serie}</span>
                <span>{e.peso ? e.peso + ' kg' : ''}</span>
                <span className="muted">{fmtData(e.ts)}</span>
              </div>
            ))}
          </div>
        </>
      )}

      {aba === 'alunos' && (
        <>
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2>Meus alunos</h2>
              <button className="btn btn-sm" onClick={() => { setMostrarForm(!mostrarForm); setNOk(null) }}>
                {mostrarForm ? 'Fechar' : 'Cadastrar aluno'}
              </button>
            </div>

            {mostrarForm && (
              <form onSubmit={cadastrarAluno} style={{ marginTop: 10, marginBottom: 16, borderBottom: '1px solid #ececee', paddingBottom: 16 }}>
                <label>Nome do aluno</label>
                <input value={nNome} onChange={e => setNNome(e.target.value)} required />
                <label>E-mail do aluno (usado para recuperar senha)</label>
                <input type="email" value={nEmail} onChange={e => setNEmail(e.target.value)} required />
                <label>Senha inicial (o aluno pode trocar depois)</label>
                <input value={nSenha} onChange={e => setNSenha(e.target.value)} required minLength={6} />
                {nErro && <div className="erro">{nErro}</div>}
                <button className="btn" disabled={criando}>{criando ? 'Cadastrando...' : 'Cadastrar aluno'}</button>
              </form>
            )}

            {nOk && (
              <div className="ok" style={{ marginBottom: 14 }}>
                Aluno {nOk.nome} cadastrado. Código de acesso: <strong>{nOk.codigo}</strong> — envie o código e a senha para ele entrar.
              </div>
            )}

            {listaAlunos.length === 0 && <p className="muted">Nenhum aluno ainda. Clique em "Cadastrar aluno".</p>}
            {listaAlunos.map(([uid, a]) => (
              <div key={uid} className="aluno-item">
                <div>
                  <div className="nome">{a.nome}</div>
                  <div className="muted">Código: {a.codigo} · {a.email}</div>
                </div>
                <div className="aluno-acoes">
                  <Link to={'/personal-aluno/' + uid}><button className="btn btn-sec btn-sm">Perfil</button></Link>
                  <Link to={'/personal-treino/' + uid}><button className="btn btn-sm">Treino</button></Link>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {aba === 'financeiro' && (
        <Financeiro user={user} alunos={alunos} cobrancas={cobrancas} />
      )}

      {aba === 'chat' && (
        <div className="card">
          {!chatAluno && (
            <>
              <h2>Conversas</h2>
              {listaAlunos.length === 0 && <p className="muted">Nenhum aluno ainda.</p>}
              {listaAlunos.map(([uid, a]) => (
                <div key={uid} className="aluno-item">
                  <div className="nome">{a.nome}</div>
                  <button className="btn btn-sm" onClick={() => setChatAluno({ uid, nome: a.nome })}>Abrir chat</button>
                </div>
              ))}
            </>
          )}
          {chatAluno && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <h2>Chat com {chatAluno.nome}</h2>
                <button className="btn btn-sec btn-sm" onClick={() => setChatAluno(null)}>Voltar</button>
              </div>
              <Chat chatId={user.uid + '_' + chatAluno.uid} meuUid={user.uid} outroUid={chatAluno.uid} rotaNotif="/aluno" />
            </>
          )}
        </div>
      )}

      {aba === 'config' && <Config user={user} perfil={perfil} />}
    </div>
  )
}
