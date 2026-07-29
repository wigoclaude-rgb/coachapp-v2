import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { createUserWithEmailAndPassword, signOut, getAuth } from 'firebase/auth'
import { initializeApp, getApps } from 'firebase/app'
import { ref, onValue, set } from 'firebase/database'
import { db, firebaseConfig } from '../../firebase'
import { fmtData, fmtMoeda, vencida } from '../../lib/util'
import Chat from '../../components/Chat.jsx'
import Config from '../Config.jsx'
import MeusTemplates from './MeusTemplates.jsx'
import Financeiro from './Financeiro.jsx'
import Layout from '../../components/Layout.jsx'
import {
  IcInicio, IcAlunos, IcFinanceiro, IcChat, IcTemplates, IcConfig,
  IcRaio, IcRelogio, IcMais, IcBusca, IcHalter, IcAlerta, IcCopiar, IcCheck
} from '../../components/Icones.jsx'

function gerarCodigo() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let c = ''
  for (let i = 0; i < 6; i++) c += chars[Math.floor(Math.random() * chars.length)]
  return c
}

const TITULOS = {
  inicio: { t: 'Início', s: 'Resumo do seu dia' },
  alunos: { t: 'Alunos', s: 'Gerencie sua carteira' },
  financeiro: { t: 'Financeiro', s: 'Cobranças e pagamentos' },
  chat: { t: 'Chat', s: 'Converse com seus alunos' },
  templates: { t: 'Templates', s: 'Planos reutilizáveis' },
  config: { t: 'Configurações', s: 'Sua conta e preferências' }
}

const DIA = 86400000

const FILTROS = [
  { id: 'todos', label: 'Todos' },
  { id: 'ativos', label: 'Ativos (7 dias)' },
  { id: 'inativos', label: 'Sem treinar' },
  { id: 'sem_plano', label: 'Sem plano' },
  { id: 'atraso', label: 'Em atraso' }
]

export default function PersonalHome({ user, perfil, onSair }) {
  const [aba, setAba] = useState('inicio')
  const [alunos, setAlunos] = useState({})
  const [execucoes, setExecucoes] = useState({})
  const [cobrancas, setCobrancas] = useState({})
  const [treinos, setTreinos] = useState({})
  const [chatAluno, setChatAluno] = useState(null)

  const [busca, setBusca] = useState('')
  const [filtro, setFiltro] = useState('todos')

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
    const u4 = onValue(ref(db, 'treinos'), s => setTreinos(s.val() || {}))
    return () => { u1(); u2(); u3(); u4() }
  }, [user.uid])

  /* ---------- Consolidação por aluno ---------- */
  const fichas = useMemo(() => {
    const agora = Date.now()
    const inicioHoje = new Date(); inicioHoje.setHours(0, 0, 0, 0)

    return Object.entries(alunos).map(([uid, a]) => {
      const exs = Object.values(execucoes[uid] || {})
      const ultimoTs = exs.reduce((m, e) => Math.max(m, e.ts || 0), 0) || null
      const seriesHoje = exs.filter(e => e.ts >= inicioHoje.getTime()).length

      const cobs = Object.entries(cobrancas[uid] || {}).map(([id, c]) => ({ id, ...c }))
      const emAtraso = cobs.some(c => vencida(c))
      const aguardando = cobs.some(c => c.status === 'em_analise')
      const abertas = cobs.filter(c => c.status === 'pendente')
      const proxVenc = abertas.map(c => c.vencimento).sort()[0] || null
      const aReceber = cobs.filter(c => c.status !== 'pago').reduce((s, c) => s + (Number(c.valor) || 0), 0)

      const plano = treinos[uid] || null
      const temPlano = !!(plano && (Array.isArray(plano.lista) ? plano.lista.length : plano.exercicios))

      const diasParado = ultimoTs ? Math.floor((agora - ultimoTs) / DIA) : null
      const ativo = diasParado !== null && diasParado <= 7

      return { uid, ...a, ultimoTs, diasParado, ativo, seriesHoje, emAtraso, aguardando, proxVenc, aReceber, temPlano }
    })
  }, [alunos, execucoes, cobrancas, treinos])

  const totalAlunos = fichas.length
  const treinaramHoje = fichas.filter(f => f.seriesHoje > 0).length
  const aReceberTotal = fichas.reduce((s, f) => s + f.aReceber, 0)
  const paraValidar = fichas.filter(f => f.aguardando).length
  const semPlano = fichas.filter(f => !f.temPlano)
  const inadimplentes = fichas.filter(f => f.emAtraso)
  const parados = fichas.filter(f => f.diasParado === null || f.diasParado > 7)

  const proximosVencimentos = fichas
    .filter(f => f.proxVenc && !f.emAtraso)
    .sort((a, b) => a.proxVenc.localeCompare(b.proxVenc))
    .slice(0, 5)

  const atividades = useMemo(() => {
    const lista = []
    Object.entries(execucoes).forEach(([uid, exs]) => {
      if (!alunos[uid]) return
      Object.values(exs || {}).forEach(e => lista.push({ ...e, aluno: alunos[uid].nome || 'Aluno' }))
    })
    return lista.sort((a, b) => b.ts - a.ts).slice(0, 12)
  }, [execucoes, alunos])

  /* ---------- CRM ---------- */
  const visiveis = useMemo(() => {
    const q = busca.trim().toLowerCase()
    return fichas
      .filter(f => {
        if (q && !(f.nome || '').toLowerCase().includes(q) && !(f.codigo || '').toLowerCase().includes(q)) return false
        if (filtro === 'ativos') return f.ativo
        if (filtro === 'inativos') return !f.ativo
        if (filtro === 'sem_plano') return !f.temPlano
        if (filtro === 'atraso') return f.emAtraso
        return true
      })
      .sort((a, b) => {
        if (a.emAtraso !== b.emAtraso) return a.emAtraso ? -1 : 1
        if (a.temPlano !== b.temPlano) return a.temPlano ? 1 : -1
        return (b.ultimoTs || 0) - (a.ultimoTs || 0)
      })
  }, [fichas, busca, filtro])

  async function cadastrarAluno(e) {
    e.preventDefault()
    setNErro(''); setNOk(null); setCriando(true)
    try {
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
    { id: 'financeiro', label: 'Financeiro', icone: <IcFinanceiro />, badge: paraValidar },
    { id: 'chat', label: 'Chat', icone: <IcChat /> },
    { id: 'templates', label: 'Templates', icone: <IcTemplates /> },
    { id: 'config', label: 'Configurações', icone: <IcConfig /> }
  ]

  const hojeData = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })
  const meta = TITULOS[aba] || TITULOS.inicio

  function irPara(id) {
    setAba(id)
    if (id === 'chat') setChatAluno(null)
  }

  function abrirCadastro() {
    setAba('alunos'); setMostrarForm(true); setNOk(null)
  }

  function rotuloUltimo(f) {
    if (f.diasParado === null) return 'Nunca treinou'
    if (f.diasParado === 0) return 'Treinou hoje'
    if (f.diasParado === 1) return 'Ontem'
    return `Há ${f.diasParado} dias`
  }

  return (
    <Layout
      user={user} perfil={perfil} onSair={onSair} itens={itens}
      abaAtiva={aba} onAba={irPara}
      roleLabel="Personal Trainer" titulo={meta.t} subtitulo={meta.s}
    >
      {/* ===== INÍCIO ===== */}
      {aba === 'inicio' && (
        <>
          <div className="welcome">
            <h1>Olá, {perfil?.nome?.split(' ')[0] || 'Personal'}</h1>
            <p className="sub" style={{ textTransform: 'capitalize' }}>{hojeData}</p>
          </div>

          <div className="acoes-rapidas">
            <button className="acao-chip" onClick={abrirCadastro}><IcMais /> Cadastrar aluno</button>
            <button className="acao-chip" onClick={() => setAba('alunos')}><IcHalter /> Criar treino</button>
            <button className="acao-chip" onClick={() => setAba('financeiro')}><IcFinanceiro /> Registrar pagamento</button>
            <button className="acao-chip" onClick={() => setAba('chat')}><IcChat /> Enviar mensagem</button>
            <button className="acao-chip" onClick={() => setAba('templates')}><IcTemplates /> Criar template</button>
          </div>

          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-topo">
                <span className="stat-num">{totalAlunos}</span>
                <span className="stat-icone primaria"><IcAlunos /></span>
              </div>
              <span className="stat-label">Alunos na carteira</span>
            </div>
            <div className="stat-card">
              <div className="stat-topo">
                <span className="stat-num">{treinaramHoje}</span>
                <span className="stat-icone verde"><IcRaio /></span>
              </div>
              <span className="stat-label">Treinaram hoje</span>
            </div>
            <div className="stat-card">
              <div className="stat-topo">
                <span className="stat-num menor">{fmtMoeda(aReceberTotal)}</span>
                <span className="stat-icone azul"><IcFinanceiro /></span>
              </div>
              <span className="stat-label">A receber</span>
            </div>
            <div className="stat-card">
              <div className="stat-topo">
                <span className="stat-num">{paraValidar}</span>
                <span className="stat-icone amarelo"><IcRelogio /></span>
              </div>
              <span className="stat-label">Pagamentos para validar</span>
            </div>
          </div>

          <div className="grid-dashboard">
            <div className="card">
              <div className="card-titulo">
                <h2>Atividade recente</h2>
                <span className="mini">Últimas séries dos seus alunos</span>
              </div>
              {atividades.length === 0 && (
                <div className="vazio-estado">
                  <div className="ve-icone"><IcRaio /></div>
                  <p className="muted">Nenhuma série registrada ainda.</p>
                </div>
              )}
              {atividades.map((e, i) => (
                <div key={i} className="atividade-item">
                  <span className="at-icone"><IcCheck /></span>
                  <div className="at-txt">
                    <div className="at-titulo">{e.aluno}</div>
                    <div className="at-sub">{e.exercicio} · série {e.serie}{e.peso ? ` · ${e.peso} kg` : ''}</div>
                  </div>
                  <span className="at-hora">{fmtData(e.ts)}</span>
                </div>
              ))}
            </div>

            <div>
              <div className="card">
                <div className="card-titulo"><h2>Precisa da sua atenção</h2></div>

                {semPlano.length === 0 && inadimplentes.length === 0 && parados.length === 0 && (
                  <p className="muted">Tudo em dia. Nenhuma pendência.</p>
                )}

                {semPlano.length > 0 && (
                  <div className="atividade-item">
                    <span className="at-icone"><IcHalter /></span>
                    <div className="at-txt">
                      <div className="at-titulo">{semPlano.length} sem plano de treino</div>
                      <div className="at-sub">{semPlano.slice(0, 3).map(f => f.nome).join(', ')}</div>
                    </div>
                    <button className="btn btn-ghost btn-sm" onClick={() => { setAba('alunos'); setFiltro('sem_plano') }}>Ver</button>
                  </div>
                )}

                {inadimplentes.length > 0 && (
                  <div className="atividade-item">
                    <span className="at-icone"><IcAlerta /></span>
                    <div className="at-txt">
                      <div className="at-titulo">{inadimplentes.length} em atraso</div>
                      <div className="at-sub">{inadimplentes.slice(0, 3).map(f => f.nome).join(', ')}</div>
                    </div>
                    <button className="btn btn-ghost btn-sm" onClick={() => { setAba('alunos'); setFiltro('atraso') }}>Ver</button>
                  </div>
                )}

                {parados.length > 0 && (
                  <div className="atividade-item">
                    <span className="at-icone"><IcRelogio /></span>
                    <div className="at-txt">
                      <div className="at-titulo">{parados.length} sem treinar há mais de 7 dias</div>
                      <div className="at-sub">{parados.slice(0, 3).map(f => f.nome).join(', ')}</div>
                    </div>
                    <button className="btn btn-ghost btn-sm" onClick={() => { setAba('alunos'); setFiltro('inativos') }}>Ver</button>
                  </div>
                )}
              </div>

              <div className="card">
                <div className="card-titulo"><h2>Próximos vencimentos</h2></div>
                {proximosVencimentos.length === 0 && <p className="muted">Nenhum vencimento em aberto.</p>}
                {proximosVencimentos.map(f => (
                  <div key={f.uid} className="atividade-item">
                    <span className="ava">{(f.nome || '?').charAt(0).toUpperCase()}</span>
                    <div className="at-txt">
                      <div className="at-titulo">{f.nome}</div>
                      <div className="at-sub">{fmtMoeda(f.aReceber)}</div>
                    </div>
                    <span className="at-hora">{f.proxVenc.split('-').reverse().slice(0, 2).join('/')}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}

      {/* ===== ALUNOS ===== */}
      {aba === 'alunos' && (
        <>
          <div className="barra-filtros">
            <div className="campo-busca">
              <IcBusca />
              <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar por nome ou código" />
            </div>
            <button className="btn btn-sm" onClick={() => { setMostrarForm(!mostrarForm); setNOk(null) }}>
              {mostrarForm ? 'Fechar' : <><IcMais /> Cadastrar aluno</>}
            </button>
          </div>

          <div className="barra-filtros">
            {FILTROS.map(f => (
              <button key={f.id} className={'filtro-chip ' + (filtro === f.id ? 'ativo' : '')} onClick={() => setFiltro(f.id)}>
                {f.label}
              </button>
            ))}
          </div>

          {mostrarForm && (
            <div className="card">
              <div className="card-titulo"><h2>Novo aluno</h2></div>
              <form onSubmit={cadastrarAluno}>
                <div className="linha-2">
                  <div>
                    <label>Nome</label>
                    <input value={nNome} onChange={e => setNNome(e.target.value)} required />
                  </div>
                  <div>
                    <label>E-mail</label>
                    <input type="email" value={nEmail} onChange={e => setNEmail(e.target.value)} required />
                  </div>
                </div>
                <label>Senha inicial (o aluno pode trocar depois)</label>
                <input value={nSenha} onChange={e => setNSenha(e.target.value)} required minLength={6} />
                {nErro && <div className="erro">{nErro}</div>}
                <button className="btn" disabled={criando}>{criando ? 'Cadastrando...' : 'Cadastrar aluno'}</button>
              </form>
            </div>
          )}

          {nOk && (
            <div className="card destaque-card">
              <div style={{ fontWeight: 600, marginBottom: 4 }}>{nOk.nome} cadastrado</div>
              <p className="mini">Envie o link abaixo — o código já vem preenchido no login.</p>
              <div className="codigo-box">{nOk.codigo}</div>
              <button
                type="button" className="btn btn-sec btn-sm" style={{ marginTop: 12 }}
                onClick={() => {
                  navigator.clipboard.writeText(`${window.location.origin}/?modo=aluno&codigo=${nOk.codigo}`)
                  alert('Link copiado. Envie para ' + nOk.nome)
                }}
              >
                <IcCopiar /> Copiar link de acesso
              </button>
            </div>
          )}

          {visiveis.length === 0 ? (
            <div className="card">
              <div className="vazio-estado">
                <div className="ve-icone"><IcAlunos /></div>
                <h2>{fichas.length === 0 ? 'Nenhum aluno ainda' : 'Nada encontrado'}</h2>
                <p className="muted">
                  {fichas.length === 0 ? 'Cadastre seu primeiro aluno para começar.' : 'Ajuste a busca ou o filtro.'}
                </p>
              </div>
            </div>
          ) : (
            <div className="lista-alunos">
              <div className="la-cabecalho">
                <span>Aluno</span>
                <span className="la-col-ocultavel">Último treino</span>
                <span className="la-col-ocultavel">Situação</span>
                <span />
              </div>
              {visiveis.map(f => (
                <div key={f.uid} className="la-linha">
                  <div className="la-aluno">
                    <span className="ava">{(f.nome || '?').charAt(0).toUpperCase()}</span>
                    <div style={{ minWidth: 0 }}>
                      <div className="la-nome">{f.nome}</div>
                      <div className="la-sub">Código {f.codigo}</div>
                    </div>
                  </div>
                  <div className="la-col-ocultavel la-sub">{rotuloUltimo(f)}</div>
                  <div className="la-col-ocultavel" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {f.emAtraso && <span className="badge vermelho"><i className="ponto" /> Em atraso</span>}
                    {f.aguardando && <span className="badge amarelo">Validar</span>}
                    {!f.temPlano && <span className="badge">Sem plano</span>}
                    {f.temPlano && !f.emAtraso && !f.aguardando && (
                      <span className={'badge ' + (f.ativo ? 'verde' : '')}>{f.ativo ? 'Ativo' : 'Parado'}</span>
                    )}
                  </div>
                  <div className="la-acoes">
                    <Link to={'/personal-aluno/' + f.uid}><button className="btn btn-ghost btn-sm">Perfil</button></Link>
                    <Link to={'/personal-treino/' + f.uid}><button className="btn btn-sec btn-sm">Treino</button></Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ===== FINANCEIRO ===== */}
      {aba === 'financeiro' && <Financeiro user={user} alunos={alunos} cobrancas={cobrancas} />}

      {/* ===== CHAT ===== */}
      {aba === 'chat' && (
        <div className="card">
          {!chatAluno ? (
            <>
              <div className="card-titulo"><h2>Conversas</h2></div>
              {fichas.length === 0 && <p className="muted">Nenhum aluno ainda.</p>}
              {fichas.map(f => (
                <div key={f.uid} className="conversa-item" onClick={() => setChatAluno({ uid: f.uid, nome: f.nome })}>
                  <span className="ava">{(f.nome || '?').charAt(0).toUpperCase()}</span>
                  <div className="cv-txt">
                    <div className="cv-nome">{f.nome}</div>
                    <div className="cv-previa">{rotuloUltimo(f)}</div>
                  </div>
                </div>
              ))}
            </>
          ) : (
            <>
              <div className="card-titulo">
                <h2>{chatAluno.nome}</h2>
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
