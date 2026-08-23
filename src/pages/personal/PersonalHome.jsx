import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { createUserWithEmailAndPassword, signOut, getAuth, deleteUser } from 'firebase/auth'
import { initializeApp, getApps } from 'firebase/app'
import { ref, onValue, set, push, update, remove, get, getDatabase } from 'firebase/database'
import { db, firebaseConfig } from '../../firebase'
import { fmtData, fmtMoeda, vencida } from '../../lib/util'
import { CAMPOS_FICHA, fichaParaAluno, fichaParaMedidas } from '../../lib/ficha'
import { cpfValido, soDigitos, formatarCPF } from '../../lib/cpf'
import { PLANOS, normalizarAssinatura, podeCriarAluno, rotuloStatus } from '../../lib/planos'
import Chat from '../../components/Chat.jsx'
import Avatar from '../../components/Avatar.jsx'
import Config from '../Config.jsx'
import MeusTemplates from './MeusTemplates.jsx'
import Financeiro from './Financeiro.jsx'
import Layout from '../../components/Layout.jsx'
import Tour from '../../components/Tour.jsx'
import Suplementacao from '../../components/Suplementacao.jsx'
import TreinoDoDia from '../../components/TreinoDoDia.jsx'
import Diario from '../aluno/Diario.jsx'
// `diaISO` daqui vira `diaSup` por simetria com o AlunoHome, onde há colisão de nome.
import { normalizarSuplemento, faltaHoje, vezesNoDia, diaISO as diaSup } from '../../lib/suplementos'
import {
  TOUR_PERSONAL_INICIO, TOUR_PERSONAL_ALUNOS,
  TOUR_PERSONAL_TEMPLATES, TOUR_PERSONAL_FINANCEIRO
} from '../../lib/tours'
import {
  IcInicio, IcAlunos, IcFinanceiro, IcChat, IcTemplates, IcConfig,
  IcRaio, IcRelogio, IcMais, IcBusca, IcHalter, IcAlerta, IcCopiar, IcCheck, IcVoltar,
  IcSuplemento, IcFechar, IcTreino
} from '../../components/Icones.jsx'

// Sem I, O, 0 e 1 — some a chance do aluno digitar errado o que veio na mensagem.
function gerarCodigo(tamanho = 6) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let c = ''
  for (let i = 0; i < tamanho; i++) c += chars[Math.floor(Math.random() * chars.length)]
  return c
}

/** Mensagem pronta de acesso, no formato que vai para o WhatsApp. */
function mensagemAcesso({ nome, codigo, senha }) {
  const primeiro = (nome || '').trim().split(' ')[0] || 'tudo bem'
  return [
    `Olá, ${primeiro}! Seu acesso ao CoachApp:`,
    `${window.location.origin}/?modo=aluno&codigo=${codigo}`,
    '',
    `Código de acesso: ${codigo}`,
    `Senha: ${senha}`,
    '',
    'No primeiro acesso o app vai pedir para você criar a sua própria senha.'
  ].join('\n')
}

const TITULOS = {
  inicio: { t: 'Início', s: 'Resumo do seu dia' },
  alunos: { t: 'Alunos', s: 'Gerencie sua carteira' },
  financeiro: { t: 'Financeiro', s: 'Cobranças e pagamentos' },
  chat: { t: 'Chat', s: 'Converse com seus alunos' },
  templates: { t: 'Templates', s: 'Planos reutilizáveis' },
  meutreino: { t: 'Meu treino', s: 'Seu plano e sua evolução' },
  suplementos: { t: 'Suplementação', s: 'O que você toma e a constância' },
  plano: { t: 'Meu plano', s: 'Seu limite de alunos' },
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
  const [rever, setRever] = useState(false)
  const [aba, setAba] = useState('inicio')
  const [alunos, setAlunos] = useState({})
  const [execucoes, setExecucoes] = useState({})
  const [cobrancas, setCobrancas] = useState({})
  const [treinos, setTreinos] = useState({})
  const [chatAluno, setChatAluno] = useState(null)

  // Suplementação do próprio personal — mesma tela do aluno, dados dele.
  const [suplementos, setSuplementos] = useState({})
  const [supTomados, setSupTomados] = useState({})
  const [supDispensado, setSupDispensado] = useState(false)
  const [subMeuTreino, setSubMeuTreino] = useState('hoje')
  const navigate = useNavigate()

  const [busca, setBusca] = useState('')
  const [filtro, setFiltro] = useState('todos')

  const [nNome, setNNome] = useState('')
  const [nEmail, setNEmail] = useState('')
  const [nCpf, setNCpf] = useState('')
  const [nErro, setNErro] = useState('')
  const [nOk, setNOk] = useState(null)
  const [criando, setCriando] = useState(false)
  const [mostrarForm, setMostrarForm] = useState(false)
  const [copiado, setCopiado] = useState('')

  const [assinaturaBruta, setAssinaturaBruta] = useState(null)
  const [fichasRecebidas, setFichasRecebidas] = useState({})
  const [codigoFicha, setCodigoFicha] = useState('')

  useEffect(() => {
    const u1 = onValue(ref(db, 'personals/' + user.uid + '/alunos'), s => setAlunos(s.val() || {}))
    const u2 = onValue(ref(db, 'fichas/' + user.uid), s => setFichasRecebidas(s.val() || {}))
    const u3 = onValue(ref(db, 'personals/' + user.uid + '/codigoFicha'), s => setCodigoFicha(s.val() || ''))
    const u4 = onValue(ref(db, 'suplementos/' + user.uid), s => setSuplementos(s.val() || {}))
    const u5 = onValue(ref(db, 'suplementosTomados/' + user.uid), s => setSupTomados(s.val() || {}))
    // Só leitura: quem grava aqui é o painel master.
    const u6 = onValue(ref(db, 'planos/' + user.uid), s => setAssinaturaBruta(s.val()))
    return () => { u1(); u2(); u3(); u4(); u5(); u6() }
  }, [user.uid])

  const supPendentes = useMemo(() => (
    Object.entries(suplementos)
      .map(([id, s]) => ({ id, ...normalizarSuplemento(s) }))
      .filter(s => faltaHoje(s, s.id, supTomados))
  ), [suplementos, supTomados])

  /** Marca a dose direto do aviso flutuante, sem sair da tela onde está. */
  async function marcarSuplemento(sup) {
    const dia = diaSup()
    const feitas = vezesNoDia(supTomados, sup.id, dia)
    if (feitas >= sup.vezesAoDia) return
    try {
      await update(ref(db, `suplementosTomados/${user.uid}/${dia}/${sup.id}`), {
        vezes: feitas + 1, ts: Date.now()
      })
    } catch (err) {
      console.warn('Falha ao marcar suplemento:', err)
    }
  }

  const idsAlunos = useMemo(() => Object.keys(alunos).sort().join(','), [alunos])

  /*
    Assina execuções, cobranças e treinos por aluno.
    Ler os nós inteiros (`execucoes`, `cobrancas`, `treinos`) traria os dados de
    todos os personais do app e impediria fechar as regras do banco.
  */
  useEffect(() => {
    const uids = idsAlunos ? idsAlunos.split(',') : []
    if (uids.length === 0) {
      setExecucoes({}); setCobrancas({}); setTreinos({})
      return
    }

    const guardar = setar => (uid, valor) =>
      setar(anterior => (valor ? { ...anterior, [uid]: valor } : (() => {
        const { [uid]: _, ...resto } = anterior
        return resto
      })()))

    const porExec = guardar(setExecucoes)
    const porCob = guardar(setCobrancas)
    const porTreino = guardar(setTreinos)

    const inscricoes = uids.flatMap(uid => [
      onValue(ref(db, 'execucoes/' + uid), s => porExec(uid, s.val())),
      onValue(ref(db, 'cobrancas/' + uid), s => porCob(uid, s.val())),
      onValue(ref(db, 'treinos/' + uid), s => porTreino(uid, s.val()))
    ])
    return () => inscricoes.forEach(cancelar => cancelar())
  }, [idsAlunos])

  /** Cria (uma vez) o código curto do link público da ficha. */
  async function garantirCodigoFicha() {
    if (codigoFicha) return codigoFicha
    const cod = gerarCodigo(8)
    await set(ref(db, 'linksFicha/' + cod), {
      personalId: user.uid, nome: perfil.nome || 'seu personal', criadoEm: Date.now()
    })
    await set(ref(db, 'personals/' + user.uid + '/codigoFicha'), cod)
    return cod
  }

  async function copiarLinkFicha() {
    const cod = await garantirCodigoFicha()
    await navigator.clipboard.writeText(`${window.location.origin}/ficha/${cod}`)
    setCopiado('ficha')
    setTimeout(() => setCopiado(''), 2500)
  }

  const listaFichas = useMemo(() => (
    Object.entries(fichasRecebidas)
      .map(([id, f]) => ({ id, ...f }))
      .filter(f => f.status !== 'usada')
      .sort((a, b) => (b.ts || 0) - (a.ts || 0))
  ), [fichasRecebidas])

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
  const assinatura = normalizarAssinatura(assinaturaBruta)
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

  /**
   * Cria a conta do aluno com senha temporária. O personal não escolhe a senha,
   * e o aluno é obrigado a trocá-la no primeiro acesso (`precisaTrocarSenha`).
   */
  async function criarConta({ nome, email, cpf = '', extras = {}, medidas = null, fichaId = null }) {
    /*
      Trava do plano antes de qualquer coisa — nada de criar conta no Auth e
      descobrir o limite depois. A checagem é do lado do cliente: as regras do
      Realtime Database não contam filhos, então isso barra a interface, não a API.
    */
    const { pode, motivo } = podeCriarAluno(assinatura, totalAlunos)
    if (!pode) throw new Error(motivo === 'bloqueado' ? 'CONTA_BLOQUEADA' : 'LIMITE_PLANO')

    // O CPF é a chave que impede a mesma pessoa entrar duas vezes com e-mails diferentes.
    if (cpf) {
      if (!cpfValido(cpf)) throw new Error('CPF_INVALIDO')
      const jaTem = await get(ref(db, 'cpfs/' + soDigitos(cpf)))
      if (jaTem.exists()) throw new Error('CPF_EM_USO')
    }

    // App secundário para não deslogar o personal ao criar o usuário.
    const nomeSec = 'secundario'
    const secApp = getApps().find(a => a.name === nomeSec) || initializeApp(firebaseConfig, nomeSec)
    const secAuth = getAuth(secApp)

    const senha = gerarCodigo(8)
    const codigo = gerarCodigo()

    /*
      O Firebase Auth exige e-mail único, mas quem trava o cadastro aqui é o CPF.
      Sem e-mail, ou com um e-mail que já pertence a outra conta (casal que divide
      o mesmo), caímos num endereço interno. O aluno entra pelo código de qualquer
      jeito; o e-mail digitado fica guardado como contato.
    */
    const emailInterno = `aluno-${codigo.toLowerCase()}@coachapp.local`
    let emailLogin = email || emailInterno
    let cred
    try {
      cred = await createUserWithEmailAndPassword(secAuth, emailLogin, senha)
    } catch (err) {
      if (err?.code !== 'auth/email-already-in-use' && err?.code !== 'auth/invalid-email') throw err
      emailLogin = emailInterno
      cred = await createUserWithEmailAndPassword(secAuth, emailLogin, senha)
    }
    const alunoUid = cred.user.uid
    const semRecuperacao = emailLogin === emailInterno

    /*
      A partir daqui a conta de login já existe. Se qualquer gravação falhar,
      apagamos a conta antes de sair — senão o e-mail fica preso numa conta sem
      perfil e toda tentativa seguinte responde "e-mail já está em uso".
    */
    try {
      const digitos = soDigitos(cpf)

      /*
        O perfil é gravado pelo banco do app secundário, onde quem está logado é
        o próprio aluno recém-criado. Assim a regra `auth.uid === $uid` aprova.
        Pelo app principal a gravação seria negada: quem está logado é o personal,
        e a regra pede um personalId que só passa a existir depois desta linha.
      */
      const secDb = getDatabase(secApp)
      await set(ref(secDb, 'users/' + alunoUid), {
        role: 'aluno', nome, personalId: user.uid, codigo,
        email: emailLogin,          // o que autentica no Firebase
        emailContato: email || '',  // o que a pessoa digitou, para você falar com ela
        semRecuperacao,             // true quando o login usa o e-mail interno
        foto: '', objetivo: '', telefone: '', cpf: digitos,
        ...extras,
        precisaTrocarSenha: true,
        criadoEm: Date.now()
      })
      await set(ref(db, 'codigos/' + codigo), { alunoUid, email: emailLogin, personalId: user.uid })
      if (digitos) await set(ref(db, 'cpfs/' + digitos), { alunoUid, personalId: user.uid })
      await set(ref(db, 'personals/' + user.uid + '/alunos/' + alunoUid), {
        nome, email: email || '', codigo
      })

      if (medidas && Object.keys(medidas).length) {
        await push(ref(db, 'avaliacoes/' + alunoUid), { ts: Date.now(), medidas, origem: 'ficha' })
      }
      if (fichaId) {
        await update(ref(db, 'fichas/' + user.uid + '/' + fichaId), { status: 'usada', alunoUid })
      }

      await signOut(secAuth)
      return { nome, codigo, senha, semRecuperacao }
    } catch (err) {
      await deleteUser(cred.user).catch(() => {})
      await signOut(secAuth).catch(() => {})
      throw err
    }
  }

  function traduzirErro(err) {
    if (err?.message === 'CPF_INVALIDO') return 'CPF inválido. Confira os números digitados.'
    if (err?.message === 'CPF_EM_USO') return 'Já existe um aluno cadastrado com este CPF.'
    if (err?.message === 'LIMITE_PLANO') {
      return `Seu plano permite ${assinatura.studentLimit} aluno${assinatura.studentLimit === 1 ? '' : 's'} e você já chegou lá. Veja "Meu plano" para liberar mais.`
    }
    if (err?.message === 'CONTA_BLOQUEADA') {
      return 'Sua conta está bloqueada. Fale com o suporte para regularizar.'
    }
    if (err?.code === 'PERMISSION_DENIED' || err?.message?.includes('permission_denied')) {
      return 'O banco recusou a gravação. Confira as regras do Firebase — nada foi salvo.'
    }
    return 'Não foi possível cadastrar. Nada foi salvo, pode tentar de novo.'
  }

  async function cadastrarAluno(e) {
    e.preventDefault()
    setNErro(''); setNOk(null); setCriando(true)
    try {
      const dados = await criarConta({
        nome: nNome.trim(),
        email: nEmail.trim().toLowerCase(),
        cpf: nCpf
      })
      setNOk(dados)
      setNNome(''); setNEmail(''); setNCpf(''); setMostrarForm(false)
    } catch (err) {
      setNErro(traduzirErro(err))
      console.warn('Falha ao cadastrar aluno:', err)
    }
    setCriando(false)
  }

  async function criarDaFicha(ficha) {
    setNErro(''); setNOk(null); setCriando(true)
    try {
      const perfilAluno = fichaParaAluno(ficha.respostas)
      const { nome, email, cpf, ...extras } = perfilAluno
      const dados = await criarConta({
        nome, email, cpf, extras,
        medidas: fichaParaMedidas(ficha.respostas),
        fichaId: ficha.id
      })
      setNOk(dados)
    } catch (err) {
      setNErro(traduzirErro(err))
      console.warn('Falha ao criar aluno da ficha:', err)
    }
    setCriando(false)
  }

  async function descartarFicha(id) {
    if (!confirm('Descartar esta ficha? Os dados enviados serão apagados.')) return
    await remove(ref(db, 'fichas/' + user.uid + '/' + id))
  }

  const itens = [
    { id: 'inicio', label: 'Início', icone: <IcInicio /> },
    { id: 'alunos', label: 'Alunos', icone: <IcAlunos /> },
    { id: 'financeiro', label: 'Financeiro', icone: <IcFinanceiro />, badge: paraValidar },
    { id: 'chat', label: 'Chat', icone: <IcChat /> },
    { id: 'templates', label: 'Templates', icone: <IcTemplates /> },
    { id: 'meutreino', label: 'Meu treino', icone: <IcTreino /> },
    { id: 'suplementos', label: 'Suplementação', icone: <IcSuplemento />, badge: supPendentes.length },
    { id: 'plano', label: 'Meu plano', icone: <IcRaio /> },
    { id: 'config', label: 'Configurações', icone: <IcConfig /> }
  ]

  const hojeData = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })
  const meta = TITULOS[aba] || TITULOS.inicio

  /* Tour da aba atual. A chave leva "p_" para não colidir com a do aluno. */
  const TOURS = {
    inicio: TOUR_PERSONAL_INICIO,
    alunos: TOUR_PERSONAL_ALUNOS,
    templates: TOUR_PERSONAL_TEMPLATES,
    financeiro: TOUR_PERSONAL_FINANCEIRO
  }
  const tourDaAba = TOURS[aba]
  const perfilTour = rever ? { ...perfil, tours: {} } : perfil

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
      abaAtiva={aba} onAba={a => { irPara(a); setRever(false) }}
      roleLabel="Personal Trainer" titulo={meta.t} subtitulo={meta.s}
      onAjuda={tourDaAba ? () => setRever(true) : undefined}
    >
      {/* Mesmo aviso do aluno: acompanha em todas as abas até a dose ser marcada. */}
      {supPendentes.length > 0 && aba !== 'suplementos' && !supDispensado && (() => {
        const sup = supPendentes[0]
        const feitas = vezesNoDia(supTomados, sup.id, diaSup())
        const outros = supPendentes.length - 1
        return (
          <div className="sup-flutuante" role="status">
            <button className="sf-x" onClick={() => setSupDispensado(true)} title="Esconder até a próxima vez que abrir">
              <IcFechar />
            </button>
            <div className="sf-topo">
              <span className="sf-icone"><IcSuplemento /></span>
              <div className="sf-txt">
                <strong>Já tomou a {sup.nome}?</strong>
                <span>
                  {sup.dose || 'dose de hoje'}
                  {sup.vezesAoDia > 1 ? ` · ${feitas} de ${sup.vezesAoDia}` : ''}
                  {outros > 0 ? ` · mais ${outros}` : ''}
                </span>
              </div>
            </div>
            <div className="sf-acoes">
              <button className="btn btn-sm" onClick={() => marcarSuplemento(sup)}>
                <IcCheck /> Já tomei
              </button>
              <button className="btn btn-ghost btn-sm" onClick={() => irPara('suplementos')}>
                Ver suplementação
              </button>
            </div>
          </div>
        )
      })()}

      {tourDaAba && (
        <Tour
          key={aba + (rever ? '-rever' : '')}
          passos={tourDaAba} chave={'p_' + aba}
          user={user} perfil={perfilTour}
          onFim={() => setRever(false)}
        />
      )}

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
            <button className="btn btn-sec btn-sm" onClick={copiarLinkFicha}>
              {copiado === 'ficha' ? <><IcCheck /> Link copiado</> : <><IcCopiar /> Link da ficha</>}
            </button>
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
                    <label>E-mail (opcional)</label>
                    <input type="email" value={nEmail} onChange={e => setNEmail(e.target.value)} />
                  </div>
                </div>
                <label>CPF (opcional)</label>
                <input
                  value={formatarCPF(nCpf)}
                  onChange={e => setNCpf(formatarCPF(e.target.value))}
                  inputMode="numeric"
                  placeholder="000.000.000-00"
                />
                <p className="mini">
                  O CPF evita cadastrar a mesma pessoa duas vezes. A senha é gerada pelo app
                  e o aluno troca no primeiro acesso — você não precisa inventar uma.
                </p>
                {nErro && <div className="erro">{nErro}</div>}
                <button className="btn" disabled={criando}>{criando ? 'Cadastrando...' : 'Cadastrar aluno'}</button>
              </form>
            </div>
          )}

          {nErro && !mostrarForm && <div className="erro">{nErro}</div>}

          {nOk && (
            <div className="card destaque-card">
              <div className="card-titulo">
                <h2>{nOk.nome} cadastrado</h2>
                <button className="btn btn-ghost btn-sm" onClick={() => setNOk(null)}>Fechar</button>
              </div>
              <p className="mini">Mande esta mensagem para o aluno. A senha vale só até ele criar a dele.</p>
              <pre className="mensagem-acesso">{mensagemAcesso(nOk)}</pre>
              {nOk.semRecuperacao && (
                <p className="aviso-sutil">
                  Sem e-mail próprio, este aluno não consegue usar o "Esqueci a senha".
                  Se ele perder a senha, você precisa cadastrá-lo de novo. Peça um e-mail
                  quando puder e atualize em Configurações.
                </p>
              )}
              <button
                type="button" className="btn btn-sm"
                onClick={() => {
                  navigator.clipboard.writeText(mensagemAcesso(nOk))
                  setCopiado('acesso')
                  setTimeout(() => setCopiado(''), 2500)
                }}
              >
                {copiado === 'acesso' ? <><IcCheck /> Copiado</> : <><IcCopiar /> Copiar mensagem de acesso</>}
              </button>
            </div>
          )}

          {listaFichas.length > 0 && (
            <>
              <div className="section-title">
                Fichas recebidas · {listaFichas.length}
              </div>
              {listaFichas.map(f => {
                const r = f.respostas || {}
                return (
                  <div key={f.id} className="card ficha-recebida">
                    <div className="card-titulo">
                      <div style={{ minWidth: 0 }}>
                        <h2>{r.nome || 'Sem nome'}</h2>
                        <p className="mini">{r.email} · enviada em {fmtData(f.ts)}</p>
                      </div>
                      <span className="badge primaria">Nova</span>
                    </div>

                    <div className="ficha-resumo">
                      {CAMPOS_FICHA
                        .filter(c => !['nome', 'email'].includes(c.id) && String(r[c.id] ?? '').trim())
                        .map(c => (
                          <div key={c.id} className="ficha-item">
                            <span className="fi-rotulo">{c.rotulo}</span>
                            <span className="fi-valor">{r[c.id]}</span>
                          </div>
                        ))}
                    </div>

                    <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
                      <button className="btn btn-sm" disabled={criando} onClick={() => criarDaFicha(f)}>
                        {criando ? 'Criando...' : <><IcMais /> Criar aluno com estes dados</>}
                      </button>
                      <button className="btn btn-perigo-sutil btn-sm" onClick={() => descartarFicha(f.id)}>
                        Descartar
                      </button>
                    </div>
                  </div>
                )
              })}
            </>
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
        !chatAluno ? (
          <div className="card">
            <div className="card-titulo"><h2>Conversas</h2></div>
            {fichas.length === 0 && <p className="muted">Nenhum aluno ainda.</p>}
            {fichas.map(f => (
              <div
                key={f.uid} className="conversa-item"
                onClick={() => setChatAluno({ uid: f.uid, nome: f.nome, foto: f.foto })}
              >
                <Avatar foto={f.foto} nome={f.nome} tamanho={44} />
                <div className="cv-txt">
                  <div className="cv-nome">{f.nome}</div>
                  <div className="cv-previa">{rotuloUltimo(f)}</div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="card sem-padding">
            <button className="btn btn-ghost btn-sm chat-voltar" onClick={() => setChatAluno(null)}>
              <IcVoltar /> Conversas
            </button>
            <Chat
              chatId={user.uid + '_' + chatAluno.uid}
              meuUid={user.uid}
              outroUid={chatAluno.uid}
              outroNome={chatAluno.nome}
              outroFoto={chatAluno.foto}
              rotaNotif="/aluno"
            />
          </div>
        )
      )}

      {/* ===== TEMPLATES ===== */}
      {aba === 'templates' && <MeusTemplates user={user} />}

      {/* ===== MEU TREINO (do próprio personal) ===== */}
      {aba === 'meutreino' && (
        <>
          <div className="tabs" style={{ marginBottom: 14 }}>
            <button
              className={'tab ' + (subMeuTreino === 'hoje' ? 'ativa' : '')}
              onClick={() => setSubMeuTreino('hoje')}
            >
              Treino de hoje
            </button>
            <button
              className={'tab ' + (subMeuTreino === 'corpo' ? 'ativa' : '')}
              onClick={() => setSubMeuTreino('corpo')}
            >
              Relatório
            </button>
          </div>

          {subMeuTreino === 'hoje' ? (
            <TreinoDoDia
              uid={user.uid}
              nome={perfil.nome}
              podeMarcar
              embutido
              onProgramar={() => navigate('/personal-treino/' + user.uid)}
            />
          ) : (
            <Diario user={user} perfil={perfil} />
          )}
        </>
      )}

      {/* ===== SUPLEMENTAÇÃO (do próprio personal) ===== */}
      {aba === 'suplementos' && (
        <Suplementacao alunoId={user.uid} podeMarcar quemSou="proprio" />
      )}

      {/* ===== CONFIG ===== */}
      {/* ===== MEU PLANO ===== */}
      {aba === 'plano' && (() => {
        const limite = assinatura.studentLimit
        const pct = limite > 0 ? Math.min(100, Math.round((totalAlunos / limite) * 100)) : 0
        const cheio = totalAlunos >= limite
        const ehPro = assinatura.plan === 'pro'
        return (
          <>
            <div className="card">
              <div className="card-titulo">
                <div style={{ minWidth: 0 }}>
                  <h2>Plano {PLANOS[assinatura.plan].rotulo}</h2>
                  <p className="mini">
                    {assinatura.planStatus === 'active'
                      ? 'Sua conta está ativa.'
                      : `Situação: ${rotuloStatus(assinatura.planStatus)}.`}
                    {assinatura.planExpiresAt ? ` Válido até ${fmtData(assinatura.planExpiresAt)}.` : ''}
                  </p>
                </div>
                <span className={'plano-selo ' + assinatura.plan}>{PLANOS[assinatura.plan].rotulo}</span>
              </div>

              <div className="plano-uso">
                <div className="tr-numeros">
                  <strong>{totalAlunos}</strong>
                  <span>de {limite === 999 ? '∞' : limite} alunos</span>
                </div>
                {limite !== 999 && (
                  <div className="tr-barra">
                    <div className="tr-barra-fill" style={{ width: pct + '%' }} />
                  </div>
                )}
              </div>

              {cheio && !ehPro && (
                <div className="aviso-sutil" style={{ marginTop: 16 }}>
                  Você chegou ao limite do Free. Para cadastrar mais alunos, mude para o Pro.
                </div>
              )}
            </div>

            {!ehPro && (
              <div className="card destaque-card">
                <div className="card-titulo">
                  <div style={{ minWidth: 0 }}>
                    <h2>Plano Pro · {fmtMoeda(PLANOS.pro.preco)}/mês</h2>
                    <p className="mini">Alunos ilimitados. Todo o resto continua igual.</p>
                  </div>
                </div>
                <p className="muted">
                  A liberação ainda é manual: faça o PIX e me chame no WhatsApp com o comprovante
                  que eu ativo sua conta na hora.
                </p>
              </div>
            )}
          </>
        )
      })()}

      {aba === 'config' && <Config user={user} perfil={perfil} />}
    </Layout>
  )
}
