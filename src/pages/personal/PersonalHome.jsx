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
import Layout from '../../components/Layout.jsx'
import { IcInicio, IcAlunos, IcFinanceiro, IcChat, IcTemplates, IcConfig, IcRaio, IcRelogio } from '../../components/Icones.jsx'

function gerarCodigo() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let c = ''
  for (let i = 0; i < 6; i++) c += chars[Math.floor(Math.random() * chars.length)]
  return c
}

const TITULOS = {
  inicio: { t: 'Início', s: 'Visão geral do seu negócio' },
  alunos: { t: 'Alunos', s: 'Gerencie seus alunos' },
  financeiro: { t: 'Financeiro', s: 'Cobranças e pagamentos' },
  chat: { t: 'Chat', s: 'Converse com seus alunos' },
  templates: { t: 'Meus Templates', s: 'Modelos de treino reutilizáveis' },
  config: { t: 'Configurações', s: 'Sua conta e preferências' }
}

export default function PersonalHome({ user, perfil, onSair }) {
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

  const itens = [
    { id: 'inicio', label: 'Início', icone: <IcInicio /> },
    { id: 'alunos', label: 'Alunos', icone: <IcAlunos /> },
    { id: 'financeiro', label: 'Financeiro', icone: <IcFinanceiro />, badge: emAnalise },
    { id: 'chat', label: 'Chat', icone: <IcChat /> },
    { id: 'templates', label: 'Meus Templates', icone: <IcTemplates /> },
    { id: 'config', label: 'Configurações', icone: <IcConfig /> }
  ]

  const hojeData = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })
  const meta = TITULOS[aba] || TITULOS.inicio

  function irPara(id) {
    setAba(id)
    if (id === 'chat') setChatAluno(null)
  }

  const inicial = (perfil?.nome || '?').trim().charAt(0).toUpperCase()

  return (
    <Layout
      user={user}
      perfil={perfil}
      onSair={onSair}
      itens={itens}
      abaAtiva={aba}
      onAba={irPara}
      roleLabel="Personal Trainer"
      titulo={meta.t}
      subtitulo={meta.s}
    >
      {/* ===== INÍCIO ===== */}
      {aba === 'inicio' && (
        <>
          <div className="welcome">
            <h1>Olá, {perfil?.nome?.split(' ')[0] || 'Personal'} 👋</h1>
            <p className="sub">{hojeData}</p>
          </div>

          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-topo">
                <span className="stat-num">{totalAlunos}</span>
                <span className="stat-icone"><IcAlunos /></span>
              </div>
              <span className="stat-label">Alunos ativos</span>
            </div>
            <div className="stat-card">
              <div className="stat-topo">
                <span className="stat-num">{execHoje}</span>
                <span className="stat-icone verde"><IcRaio /></span>
              </div>
              <span className="stat-label">Séries feitas hoje</span>
            </div>
            <div className="stat-card">
              <div className="stat-topo">
                <span className="stat-num" style={{ fontSize: 22 }}>{fmtMoeda(aReceber)}</span>
                <span className="stat-icone azul"><IcFinanceiro /></span>
              </div>
              <span className="stat-label">A receber</span>
            </div>
            <div className="stat-card">
              <div className="stat-topo">
                <span className="stat-num">{emAnalise}</span>
                <span className="stat-icone amarelo"><IcRelogio /></span>
              </div>
              <span className="stat-label">Pagamentos p/ validar</span>
            </div>
          </div>

          <div className="acoes-rapidas">
            <button className="acao-card" onClick={() => { setAba('alunos'); setMostrarForm(true); setNOk(null) }}>
              <span className="acao-icone"><IcAlunos /></span>
              <span className="acao-txt">
                <span className="acao-titulo">Cadastrar aluno</span>
                <span className="acao-desc">Adicionar novo aluno</span>
              </span>
            </button>
            <button className="acao-card" onClick={() => setAba('financeiro')}>
              <span className="acao-icone"><IcFinanceiro /></span>
              <span className="acao-txt">
                <span className="acao-titulo">Financeiro</span>
                <span className="acao-desc">Lançar cobrança</span>
              </span>
            </button>
            <button className="acao-card" onClick={() => setAba('templates')}>
              <span className="acao-icone"><IcTemplates /></span>
              <span className="acao-txt">
                <span className="acao-titulo">Templates</span>
                <span className="acao-desc">Modelos de treino</span>
              </span>
            </button>
          </div>

          <div className="card">
            <div className="card-titulo"><h2>Últimas execuções</h2></div>
            {ultimas.length === 0 && (
              <div className="vazio-estado">
                <div className="ve-icone">🏋️</div>
                <p className="muted">Nenhuma série registrada ainda.</p>
              </div>
            )}
            {ultimas.map((e, i) => (
              <div key={i} className="serie-row">
                <span style={{ fontWeight: 600, minWidth: 100 }}>{e.aluno}</span>
                <span>{e.exercicio}</span>
                <span>Série {e.serie}</span>
                <span>{e.peso ? e.peso + ' kg' : ''}</span>
                <span className="muted" style={{ marginLeft: 'auto' }}>{fmtData(e.ts)}</span>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ===== ALUNOS ===== */}
      {aba === 'alunos' && (
        <>
          <div className="card">
            <div className="card-titulo">
              <h2>Meus alunos</h2>
              <button className="btn btn-sm" onClick={() => { setMostrarForm(!mostrarForm); setNOk(null) }}>
                {mostrarForm ? 'Fechar' : '+ Cadastrar aluno'}
              </button>
            </div>

            {mostrarForm && (
              <form onSubmit={cadastrarAluno} style={{ marginBottom: 16, borderBottom: '1px solid var(--borda-2)', paddingBottom: 16 }}>
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
                <div style={{ marginBottom: 10 }}>
                  Aluno {nOk.nome} cadastrado! Código: <strong>{nOk.codigo}</strong>
                </div>
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={() => {
                    const link = `${window.location.origin}/?modo=aluno&codigo=${nOk.codigo}`
                    navigator.clipboard.writeText(link)
                    alert('Link copiado! Envie para ' + nOk.nome)
                  }}
                  style={{ width: 'auto', marginRight: 8 }}
                >
                  📋 Copiar link do aluno
                </button>
                <div className="muted" style={{ marginTop: 8, fontSize: 12, wordBreak: 'break-all' }}>
                  {`${window.location.origin}/?modo=aluno&codigo=${nOk.codigo}`}
                </div>
              </div>
            )}

            {listaAlunos.length === 0 && (
              <div className="vazio-estado">
                <div className="ve-icone">👥</div>
                <p className="muted">Nenhum aluno ainda. Clique em "+ Cadastrar aluno".</p>
              </div>
            )}
          </div>

          {listaAlunos.length > 0 && (
            <div className="alunos-grid">
              {listaAlunos.map(([uid, a]) => (
                <div key={uid} className="aluno-card">
                  <div className="aluno-card-topo">
                    <div className="ava">{(a.nome || '?').charAt(0).toUpperCase()}</div>
                    <div style={{ minWidth: 0 }}>
                      <div className="a-nome">{a.nome}</div>
                      <div className="a-meta">Código: {a.codigo}</div>
                    </div>
                  </div>
                  <div className="aluno-card-acoes">
                    <Link to={'/personal-aluno/' + uid}><button className="btn btn-ghost btn-sm">Perfil</button></Link>
                    <Link to={'/personal-treino/' + uid}><button className="btn btn-sm">Treino</button></Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ===== FINANCEIRO ===== */}
      {aba === 'financeiro' && (
        <Financeiro user={user} alunos={alunos} cobrancas={cobrancas} />
      )}

      {/* ===== CHAT ===== */}
      {aba === 'chat' && (
        <div className="card">
          {!chatAluno && (
            <>
              <div className="card-titulo"><h2>Conversas</h2></div>
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
              <div className="card-titulo">
                <h2>Chat com {chatAluno.nome}</h2>
                <button className="btn btn-sec btn-sm" onClick={() => setChatAluno(null)}>Voltar</button>
              </div>
              <Chat chatId={user.uid + '_' + chatAluno.uid} meuUid={user.uid} outroUid={chatAluno.uid} rotaNotif="/aluno" />
            </>
          )}
        </div>
      )}

      {/* ===== TEMPLATES ===== */}
      {aba === 'templates' && <MeusTemplates user={user} />}

      {/* ===== CONFIG ===== */}
      {aba === 'config' && <Config user={user} perfil={perfil} />}
    </Layout>
  )
}
