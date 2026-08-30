import { useEffect, useMemo, useState } from 'react'
import { ref, onValue, push, update } from 'firebase/database'
import { db } from '../../firebase'
import { fmtData, fmtMoeda, vencida, imagemExercicio, youtubeId, comKg, beep } from '../../lib/util'
import { notificar } from '../../lib/notify'
import {
  LETRAS, normalizarPlano, indiceSeguro, duracaoEstimada, totalSeries,
  agruparBlocos, chaveSerie, resumoExercicio
} from '../../lib/treinoModel'
import Chat from '../../components/Chat.jsx'
import Diario from './Diario.jsx'
import Config from '../Config.jsx'
import Heatmap from '../../components/Heatmap.jsx'
import Layout from '../../components/Layout.jsx'
import Tour from '../../components/Tour.jsx'
import Suplementacao from '../../components/Suplementacao.jsx'
import AvaliacaoDetalhe from '../../components/AvaliacaoDetalhe.jsx'
import EvolucaoCorporal from '../../components/EvolucaoCorporal.jsx'
import { normalizarAvaliacao } from '../../lib/avaliacao'
// `diaISO` daqui já existe no arquivo para a sequência de treinos; o alias evita a colisão.
import { normalizarSuplemento, faltaHoje, vezesNoDia, diaISO as diaSup } from '../../lib/suplementos'
import {
  TOUR_ALUNO_TREINO, TOUR_ALUNO_EVOLUCAO, TOUR_ALUNO_DIARIO, TOUR_ALUNO_PAGAMENTOS
} from '../../lib/tours'
import {
  IcTreino, IcEvolucao, IcPagamentos, IcChat, IcConfig,
  IcFogo, IcCalendario, IcCheck, IcHalter, IcAlerta, IcTrofeu, IcVideo, IcSeta, IcFechar,
  IcSuplemento
} from '../../components/Icones.jsx'

const TITULOS = {
  treino: { t: 'Meu Treino', s: 'Seu plano de hoje' },
  evolucao: { t: 'Evolução', s: 'Acompanhe seu progresso' },
  diario: { t: 'Meu diário', s: 'Privado — só você vê' },
  suplementos: { t: 'Suplementação', s: 'O que você toma e a constância' },
  pagamentos: { t: 'Pagamentos', s: 'Suas cobranças' },
  chat: { t: 'Chat', s: 'Fale com seu personal' },
  config: { t: 'Configurações', s: 'Sua conta e preferências' }
}

const diaISO = ts => {
  const d = new Date(ts)
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')
}

/*
  Perguntas do feedback por exercício. Poucas e de sim/não, para responder
  entre uma série e outra. O que não couber vai no comentário.
  `alerta` marca a resposta que o personal precisa olhar.
*/
const PERGUNTAS_FEEDBACK = [
  { id: 'carga', texto: 'A carga estava adequada?', alerta: 'nao' },
  { id: 'dor', texto: 'Sentiu dor ou desconforto?', alerta: 'sim' },
  { id: 'completou', texto: 'Conseguiu fazer todas as repetições?', alerta: 'nao' }
]

/** "Quarta, 17 de agosto" — data por extenso para o topo do treino. */
function dataPorExtenso(d = new Date()) {
  const s = d.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })
  return s.charAt(0).toUpperCase() + s.slice(1)
}

/** Dias consecutivos treinados, contando de hoje (ou de ontem, se ainda não treinou hoje). */
function calcularSequencia(diasSet) {
  if (diasSet.size === 0) return 0
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0)
  let cursor = new Date(hoje)
  if (!diasSet.has(diaISO(cursor))) {
    cursor.setDate(cursor.getDate() - 1)
    if (!diasSet.has(diaISO(cursor))) return 0
  }
  let n = 0
  while (diasSet.has(diaISO(cursor))) {
    n++
    cursor.setDate(cursor.getDate() - 1)
  }
  return n
}

export default function AlunoHome({ user, perfil, onSair }) {
  const [aba, setAba] = useState('treino')
  const [treinoBruto, setTreinoBruto] = useState(null)
  const [feitas, setFeitas] = useState({})
  const [cobrancas, setCobrancas] = useState({})
  const [execucoes, setExecucoes] = useState({})
  const [avaliacoes, setAvaliacoes] = useState({})
  const [historico, setHistorico] = useState({})
  const [personal, setPersonal] = useState(null)
  const [pagObs, setPagObs] = useState('')
  const [pagCobId, setPagCobId] = useState(null)

  // Lista interativa: qual exercício está aberto, carga digitada e erro por exercício.
  const [exAberto, setExAberto] = useState(null)
  const [pesoInline, setPesoInline] = useState({})
  const [erroInline, setErroInline] = useState({})
  const [videoAberto, setVideoAberto] = useState(null)
  const [descanso, setDescanso] = useState(null)
  // Índice do treino que o aluno abriu pelos selos A/B/C. Só leitura.
  const [verTreino, setVerTreino] = useState(null)
  // Rever o tutorial da aba mesmo já tendo concluído (botão "?" no topo).
  const [rever, setRever] = useState(false)

  // Feedback por exercício: qual está aberto, o que foi respondido e o que já foi enviado hoje.
  const [fbAberto, setFbAberto] = useState(null)
  const [fbRespostas, setFbRespostas] = useState({})
  const [fbComentario, setFbComentario] = useState('')
  const [fbEnviando, setFbEnviando] = useState(false)
  const [feedbacks, setFeedbacks] = useState({})
  const [suplementos, setSuplementos] = useState({})
  const [supTomados, setSupTomados] = useState({})
  // Esconde o aviso flutuante até a próxima abertura do app, sem marcar nada.
  const [supDispensado, setSupDispensado] = useState(false)
  const [avalAberta, setAvalAberta] = useState(null)

  /* Ausente no banco = ligado; o aluno desliga em Configurações. */
  const descansoLigado = perfil.timerDescanso !== false

  // Conta o descanso e apita ao chegar em zero.
  useEffect(() => {
    if (!descanso) return
    const id = setInterval(() => {
      setDescanso(d => {
        if (!d) return null
        if (d.restante <= 1) { beep(); return null }
        return { ...d, restante: d.restante - 1 }
      })
    }, 1000)
    return () => clearInterval(id)
  }, [descanso === null])

  useEffect(() => {
    const u1 = onValue(ref(db, 'treinos/' + user.uid), s => setTreinoBruto(s.exists() ? s.val() : null))
    const u2 = onValue(ref(db, 'cobrancas/' + user.uid), s => setCobrancas(s.val() || {}))
    const u3 = onValue(ref(db, 'execucoes/' + user.uid), s => setExecucoes(s.val() || {}))
    const u4 = onValue(ref(db, 'avaliacoes/' + user.uid), s => setAvaliacoes(s.val() || {}))
    const u5 = onValue(ref(db, 'treinosHistorico/' + user.uid), s => setHistorico(s.val() || {}))
    const u6 = onValue(ref(db, 'users/' + perfil.personalId), s => setPersonal(s.val()))
    const u7 = onValue(ref(db, 'feedbacks/' + user.uid), s => setFeedbacks(s.val() || {}))
    const u8 = onValue(ref(db, 'suplementos/' + user.uid), s => setSuplementos(s.val() || {}))
    const u9 = onValue(ref(db, 'suplementosTomados/' + user.uid), s => setSupTomados(s.val() || {}))
    return () => { u1(); u2(); u3(); u4(); u5(); u6(); u7(); u8(); u9() }
  }, [user.uid, perfil.personalId])

  // séries concluídas hoje
  useEffect(() => {
    const hoje = new Date().toDateString()
    const f = {}
    Object.values(execucoes).forEach(e => {
      if (new Date(e.ts).toDateString() === hoje) f[e.exercicio + '_' + e.serie] = true
    })
    setFeitas(f)
  }, [execucoes])

  /* ---------- Cobranças ---------- */
  const listaCob = Object.entries(cobrancas).map(([id, c]) => ({ id, ...c }))
  const vencidas = listaCob.filter(c => vencida(c))
  const bloqueado = vencidas.length > 0
  const pendentes = listaCob.filter(c => c.status === 'pendente').sort((a, b) => a.vencimento.localeCompare(b.vencimento))
  const emAnalise = listaCob.filter(c => c.status === 'em_analise')
  const pagas = listaCob.filter(c => c.status === 'pago').sort((a, b) => (b.validadaEm || 0) - (a.validadaEm || 0))
  const proximaCobranca = pendentes[0]

  /* ---------- Execuções e progresso ---------- */
  const listaExec = useMemo(() => Object.values(execucoes).sort((a, b) => b.ts - a.ts), [execucoes])
  const listaAval = Object.entries(avaliacoes).map(([id, a]) => ({ id, ...a })).sort((a, b) => a.ts - b.ts)

  /*
    O aluno só enxerga o que o personal liberou. O banco entrega o nó inteiro —
    as regras do Realtime DB não filtram por campo — então o corte é aqui, e
    registro antigo sem `visibilidade` continua visível, como sempre foi.
  */
  const avalVisiveis = useMemo(
    () => listaAval.filter(a => normalizarAvaliacao(a).visibilidade.alunoPodeVer),
    [avaliacoes]
  )
  const listaHist = Object.entries(historico).map(([id, t]) => ({ id, ...t })).sort((a, b) => (b.arquivadoEm || 0) - (a.arquivadoEm || 0))

  const diasTreinados = useMemo(() => new Set(listaExec.map(e => diaISO(e.ts))), [listaExec])
  const sequencia = useMemo(() => calcularSequencia(diasTreinados), [diasTreinados])

  const mesAtual = new Date().getMonth()
  const anoAtual = new Date().getFullYear()
  const treinosNoMes = useMemo(() => {
    const dias = new Set()
    listaExec.forEach(e => {
      const d = new Date(e.ts)
      if (d.getMonth() === mesAtual && d.getFullYear() === anoAtual) dias.add(diaISO(e.ts))
    })
    return dias.size
  }, [listaExec, mesAtual, anoAtual])

  /** Última carga registrada para um exercício, ignorando as séries de hoje. */
  const cargaAnterior = useMemo(() => {
    const mapa = {}
    const hoje = new Date().toDateString()
    listaExec.forEach(e => {
      if (new Date(e.ts).toDateString() === hoje) return
      if (mapa[e.exercicio] === undefined && e.peso) mapa[e.exercicio] = Number(e.peso)
    })
    return nome => mapa[nome] ?? null
  }, [listaExec])

  /* ---------- Plano de treino ---------- */
  const plano = useMemo(() => normalizarPlano(treinoBruto), [treinoBruto])
  const totalDias = plano ? plano.lista.length : 0
  const idxAtual = plano ? indiceSeguro(plano.indiceAtual, totalDias) : 0
  const diaAtual = plano ? plano.lista[idxAtual] : null
  const exerciciosHoje = diaAtual?.exercicios || []
  const nomeTreinoHoje = diaAtual?.nome || plano?.nome || ''
  const ciclico = totalDias > 1

  const blocosHoje = useMemo(() => agruparBlocos(exerciciosHoje), [exerciciosHoje])
  const minutos = duracaoEstimada(exerciciosHoje)
  const seriesDoDia = totalSeries(exerciciosHoje)
  const seriesFeitasHoje = exerciciosHoje.reduce((soma, e) => {
    let n = 0
    for (let s = 1; s <= e.linhas.length; s++) if (feitas[chaveSerie(e.nome, s)]) n++
    return soma + n
  }, 0)
  const proximoBloco = blocosHoje.find(b =>
    b.exercicios.some(e => e.linhas.some((_, i) => !feitas[chaveSerie(e.nome, i + 1)]))
  )
  const treinoDoDiaCompleto = seriesDoDia > 0 && seriesFeitasHoje >= seriesDoDia

  // Onde a pessoa parou: primeiro exercício com série faltando.
  const exRetomada = proximoBloco?.exercicios.find(e =>
    e.linhas.some((_, i) => !feitas[chaveSerie(e.nome, i + 1)])
  ) || null

  const pctDia = seriesDoDia ? Math.round((seriesFeitasHoje / seriesDoDia) * 100) : 0
  const minutosRestantes = seriesDoDia
    ? Math.round(minutos * (1 - seriesFeitasHoje / seriesDoDia))
    : 0
  const proximoDoCiclo = ciclico
    ? plano.lista[(idxAtual + 1) % totalDias]?.nome
    : null

  /** Registra uma série. Devolve mensagem de erro ou null. */
  async function marcarSerie(ex, serie, pesoDigitado, cargaLinha) {
    if (feitas[chaveSerie(ex.nome, serie)]) return null
    const cargaAlvo = Number(cargaLinha) || 0
    const peso = pesoDigitado !== undefined && pesoDigitado !== '' ? Number(pesoDigitado) : cargaAlvo
    if (cargaAlvo > 0 && peso < cargaAlvo) {
      return `A carga não pode ser menor que ${cargaAlvo} kg. Para reduzir, fale com o seu personal.`
    }
    await push(ref(db, 'execucoes/' + user.uid), { exercicio: ex.nome, serie, peso: peso || '', ts: Date.now() })
    return null
  }

  /** Marca uma série direto da lista e dispara o descanso, se ligado. */
  async function marcarInline(ex, serie, linha) {
    const msg = await marcarSerie(ex, serie, pesoInline[ex.nome] ?? '', linha.carga)
    setErroInline(e => ({ ...e, [ex.nome]: msg || '' }))
    if (msg) return

    setPesoInline(p => ({ ...p, [ex.nome]: '' }))

    const segundos = Number(linha.descanso) || 0
    const ultimaSerie = serie >= ex.linhas.length
    if (descansoLigado && segundos > 0 && !ultimaSerie) {
      setDescanso({ restante: segundos, total: segundos, exercicio: ex.nome, proxima: serie + 1 })
    }
  }

  /** Exercícios que já receberam feedback hoje — não pede duas vezes. */
  const fbDeHoje = useMemo(() => {
    const hoje = new Date().toDateString()
    return new Set(
      Object.values(feedbacks)
        .filter(f => new Date(f.ts).toDateString() === hoje)
        .map(f => f.exercicio)
    )
  }, [feedbacks])

  function abrirFeedback(nome) {
    setFbAberto(nome)
    setFbRespostas({})
    setFbComentario('')
  }

  async function enviarFeedback(ex) {
    const respondeu = Object.keys(fbRespostas).length > 0
    const comentou = fbComentario.trim() !== ''
    if ((!respondeu && !comentou) || fbEnviando) return

    setFbEnviando(true)
    try {
      await push(ref(db, 'feedbacks/' + user.uid), {
        exercicio: ex.nome,
        treino: nomeTreinoHoje,
        respostas: fbRespostas,
        comentario: fbComentario.trim(),
        ts: Date.now()
      })
      notificar(
        perfil.personalId,
        `${perfil.nome} comentou sobre ${ex.nome}`,
        '/personal-aluno/' + user.uid
      )
      setFbAberto(null)
    } catch (err) {
      console.warn('Falha ao enviar feedback:', err)
    }
    setFbEnviando(false)
  }

  /** Marca a dose direto do aviso flutuante, sem sair da tela onde a pessoa está. */
  async function marcarSuplemento(sup) {
    const dia = diaSup()
    const feitas = vezesNoDia(supTomados, sup.id, dia)
    if (feitas >= sup.vezesAoDia) return
    try {
      await update(ref(db, `suplementosTomados/${user.uid}/${dia}/${sup.id}`), {
        vezes: feitas + 1,
        ts: Date.now()
      })
    } catch (err) {
      console.warn('Falha ao marcar suplemento:', err)
    }
  }

  async function concluirTreino() {
    if (ciclico) {
      await update(ref(db, 'treinos/' + user.uid), { indiceAtual: (idxAtual + 1) % totalDias })
    }
    setExecutando(false)
  }

  async function registrarPagamento(e) {
    e.preventDefault()
    if (!pagCobId) return
    await update(ref(db, 'cobrancas/' + user.uid + '/' + pagCobId), {
      status: 'em_analise',
      pagamento: { data: Date.now(), obs: pagObs }
    })
    notificar(perfil.personalId, perfil.nome + ' registrou um pagamento. Valide no Financeiro.', '/personal')
    setPagCobId(null); setPagObs('')
  }

  /*
    Suplementos que ainda faltam hoje. Sem push, o lembrete é este: o app cobra
    assim que a pessoa abre, na tela de treino, em vez de esperar ela lembrar
    de ir até a aba de suplementação.
  */
  const supPendentes = useMemo(() => (
    Object.entries(suplementos)
      .map(([id, s]) => ({ id, ...normalizarSuplemento(s) }))
      .filter(s => faltaHoje(s, s.id, supTomados))
  ), [suplementos, supTomados])

  const itens = [
    { id: 'treino', label: 'Meu Treino', icone: <IcTreino /> },
    { id: 'evolucao', label: 'Evolução', icone: <IcEvolucao /> },
    { id: 'diario', label: 'Meu diário', icone: <IcCalendario /> },
    { id: 'suplementos', label: 'Suplementação', icone: <IcSuplemento />, badge: supPendentes.length },
    { id: 'pagamentos', label: 'Pagamentos', icone: <IcPagamentos />, badge: vencidas.length },
    { id: 'chat', label: 'Chat', icone: <IcChat /> },
    { id: 'config', label: 'Configurações', icone: <IcConfig /> }
  ]


  const meta = TITULOS[aba] || TITULOS.treino

  /* Tour da aba atual. `rever` força a exibição mesmo já tendo sido concluído. */
  const TOURS = {
    treino: TOUR_ALUNO_TREINO,
    evolucao: TOUR_ALUNO_EVOLUCAO,
    diario: TOUR_ALUNO_DIARIO,
    pagamentos: TOUR_ALUNO_PAGAMENTOS
  }
  const tourDaAba = TOURS[aba]
  const perfilTour = rever ? { ...perfil, tours: {} } : perfil

  return (
    <Layout
      user={user} perfil={perfil} onSair={onSair} itens={itens}
      abaAtiva={aba} onAba={a => { setAba(a); setRever(false) }}
      roleLabel="Aluno" titulo={meta.t} subtitulo={meta.s}
      onAjuda={tourDaAba ? () => setRever(true) : undefined}
    >
      {tourDaAba && (
        <Tour
          key={aba + (rever ? '-rever' : '')}
          passos={tourDaAba} chave={aba}
          user={user} perfil={perfilTour}
          onFim={() => setRever(false)}
        />
      )}

      {/* Espiada num treino do ciclo. Só leitura — não mexe em nada. */}
      {verTreino !== null && plano?.lista[verTreino] && (
        <div className="espiada" onClick={() => setVerTreino(null)}>
          <div className="espiada-caixa" onClick={e => e.stopPropagation()}>
            <header className="espiada-topo nao-imprime">
              <div>
                <span className="espiada-letra">Treino {LETRAS[verTreino] || verTreino + 1}</span>
                <h2>{plano.lista[verTreino].nome}</h2>
              </div>
              <div className="espiada-acoes">
                <button className="btn btn-sec btn-sm" onClick={() => window.print()}>
                  Baixar PDF
                </button>
                <button className="btn btn-ghost btn-sm" onClick={() => setVerTreino(null)} title="Fechar">
                  <IcFechar />
                </button>
              </div>
            </header>

            <div className="espiada-corpo">
              {/* Cabeçalho do papel: só aparece na impressão. */}
              <div className="folha-topo">
                <h1>{plano.lista[verTreino].nome}</h1>
                <p>
                  {perfil.nome} · {plano.nome} · Treino {LETRAS[verTreino] || verTreino + 1}
                  {personal?.nome ? ' · Personal: ' + personal.nome : ''}
                </p>
                <p>{dataPorExtenso()}</p>
              </div>

              {verTreino === idxAtual && (
                <p className="espiada-hoje nao-imprime"><IcCheck /> É o treino de hoje</p>
              )}

              {agruparBlocos(plano.lista[verTreino].exercicios).map((b, i) => (
                <div key={i} className={'esp-bloco' + (b.combinado ? ' biset' : '')}>
                  {b.combinado && <span className="tr-biset-tag">Bi-set</span>}
                  {b.exercicios.map((ex, k) => {
                    const img = imagemExercicio(ex)
                    // A coluna de descanso só entra quando o personal preencheu algum.
                    const temDescanso = ex.linhas.some(l => Number(l.descanso) > 0)
                    return (
                      <div key={k} className="esp-ex">
                        <div className="esp-ex-topo">
                          {img && (
                            <img
                              src={img} alt="" className="esp-ex-foto" loading="lazy"
                              onError={e => { e.currentTarget.style.display = 'none' }}
                            />
                          )}
                          <div>
                            <span className="esp-ex-nome">{ex.nome}</span>
                            <span className="esp-ex-qtd">
                              {ex.linhas.length} série{ex.linhas.length === 1 ? '' : 's'}
                            </span>
                          </div>
                        </div>

                        <table className="esp-series">
                          <thead>
                            <tr>
                              <th>Série</th>
                              <th>Reps</th>
                              <th>Carga</th>
                              {temDescanso && <th>Descanso</th>}
                            </tr>
                          </thead>
                          <tbody>
                            {ex.linhas.map((linha, li) => (
                              <tr key={li}>
                                <td className="esp-s-n">{li + 1}ª</td>
                                <td>{linha.reps || '—'}</td>
                                <td>{linha.carga ? comKg(linha.carga) : 'Livre'}</td>
                                {temDescanso && (
                                  <td>{Number(linha.descanso) > 0 ? linha.descanso + 's' : '—'}</td>
                                )}
                              </tr>
                            ))}
                          </tbody>
                        </table>

                        {ex.obs && <p className="esp-ex-obs">{ex.obs}</p>}
                      </div>
                    )
                  })}
                </div>
              ))}

              <p className="mini nao-imprime" style={{ marginTop: 12 }}>
                Só para consultar. As séries você marca no treino do dia.
              </p>
            </div>
          </div>
        </div>
      )}

      {/*
        Cobrança do suplemento em qualquer aba, até ser marcado. Fica de fora só
        da própria aba de suplementação, onde seria redundante.
        Enquanto não houver push, é este aviso que faz o papel do lembrete.
      */}
      {supPendentes.length > 0 && aba !== 'suplementos' && !supDispensado && (() => {
        const sup = supPendentes[0]
        const feitas = vezesNoDia(supTomados, sup.id, diaSup())
        const outros = supPendentes.length - 1
        return (
          <div className="sup-flutuante" role="status">
            <button
              className="sf-x" onClick={() => setSupDispensado(true)}
              title="Esconder até a próxima vez que abrir"
            >
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
              <button className="btn btn-ghost btn-sm" onClick={() => setAba('suplementos')}>
                Ver suplementação
              </button>
            </div>
          </div>
        )
      })()}

      {/* Descanso entre séries. Cobre a tela para o número ser lido de longe. */}
      {descanso && (
        <div className="descanso-tela" role="status" aria-live="polite">
          <span className="descanso-num">
            {Math.floor(descanso.restante / 60)}:{String(descanso.restante % 60).padStart(2, '0')}
          </span>
          <span className="descanso-rot">Descanso</span>
          <p className="descanso-prox">
            A seguir: <strong>{descanso.proxima}ª série</strong> de {descanso.exercicio}
          </p>
          <button className="btn btn-sec btn-auto" onClick={() => setDescanso(null)}>
            Pular descanso
          </button>
        </div>
      )}

      {/* ===== TREINO ===== */}
      {aba === 'treino' && (
        <>
          {bloqueado && (
                <div className="card bloqueio-card">
                  <div className="card-titulo"><h2>Treino bloqueado</h2></div>
                  <p className="muted">
                    Você tem pagamento vencido. Regularize em <strong>Pagamentos</strong> e aguarde a validação do seu personal.
                  </p>
                  <button className="btn btn-sm" style={{ marginTop: 14 }} onClick={() => setAba('pagamentos')}>Ver pagamentos</button>
                </div>
              )}

              {!bloqueado && !plano && (
                <div className="card">
                  <div className="vazio-estado">
                    <div className="ve-icone"><IcHalter /></div>
                    <h2>Nenhum treino ainda</h2>
                    <p className="muted">Seu personal ainda não montou o seu plano. Fale com ele pelo chat.</p>
                    <button className="btn btn-sm btn-auto" style={{ marginTop: 14 }} onClick={() => setAba('chat')}>Abrir chat</button>
                  </div>
                </div>
              )}

              {!bloqueado && plano && (
                <>
                  <section className="tr-hero">
                    <div className="tr-cab">
                      <span className="tr-data">{dataPorExtenso()}</span>
                      {ciclico && (
                        <div className="tr-ciclo">
                          {plano.lista.map((d, i) => (
                            <button
                              key={i}
                              type="button"
                              className={'tr-passo' + (i === idxAtual ? ' agora' : i < idxAtual ? ' feito' : '')}
                              onClick={() => setVerTreino(i)}
                              title={'Ver ' + d.nome}
                            >
                              {LETRAS[i] || i + 1}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    <h2 className="tr-nome">{nomeTreinoHoje}</h2>

                    <div className="tr-progresso">
                      <div className="tr-numeros">
                        <strong>{seriesFeitasHoje}</strong>
                        <span>de {seriesDoDia} séries</span>
                        {!treinoDoDiaCompleto && minutosRestantes > 0 && (
                          <span className="tr-restante">faltam ~{minutosRestantes} min</span>
                        )}
                      </div>
                      <div className="tr-barra">
                        <div className="tr-barra-fill" style={{ width: pctDia + '%' }} />
                      </div>
                    </div>

                    {treinoDoDiaCompleto ? (
                      <>
                        <div className="tr-pronto">
                          <span className="tr-pronto-icone"><IcTrofeu /></span>
                          <div>
                            <strong>Treino de hoje concluído</strong>
                            <span>
                              {seriesDoDia} séries registradas.
                              {ciclico && proximoDoCiclo ? ` A seguir: ${proximoDoCiclo}.` : ''}
                            </span>
                          </div>
                        </div>
                        <button className="btn btn-lg tr-acao" onClick={concluirTreino}>
                          <IcCheck /> {ciclico ? 'Finalizar e liberar o próximo' : 'Finalizar treino'}
                        </button>
                      </>
                    ) : exRetomada && (
                      <div className="tr-retomada">
                        <span className="tr-retomada-rot">
                          {seriesFeitasHoje > 0 ? 'Você parou em' : 'Começa com'}
                        </span>
                        <span className="tr-retomada-nome">{exRetomada.nome}</span>
                        <span className="tr-retomada-meta">
                          {resumoExercicio(exRetomada)}{proximoBloco?.combinado ? ' · bi-set' : ''}
                        </span>
                      </div>
                    )}
                  </section>

                  {(sequencia > 1 || proximaCobranca) && (
                    <div className="tr-avisos">
                      {sequencia > 1 && (
                        <div className="tr-aviso fogo">
                          <IcFogo />
                          <span><strong>{sequencia} dias seguidos</strong> — não perca a sequência</span>
                        </div>
                      )}
                      {proximaCobranca && (
                        <button className="tr-aviso alerta" type="button" onClick={() => setAba('pagamentos')}>
                          <IcAlerta />
                          <span>
                            <strong>{fmtMoeda(proximaCobranca.valor)}</strong>
                            {' vence em ' + proximaCobranca.vencimento.split('-').reverse().slice(0, 2).join('/')}
                          </span>
                        </button>
                      )}
                    </div>
                  )}

                  <div className="section-title">
                    Exercícios de hoje
                    <span className="st-dica">Toque para marcar as séries</span>
                  </div>
                  <ol className="tr-lista">
                    {blocosHoje.map((b, i) => (
                      <li key={i} className={'tr-bloco' + (b.combinado ? ' biset' : '')}>
                        {b.combinado && <span className="tr-biset-tag">Bi-set</span>}
                        {b.exercicios.map((ex, k) => {
                          const total = ex.linhas.length
                          let n = 0
                          for (let s = 1; s <= total; s++) if (feitas[chaveSerie(ex.nome, s)]) n++
                          const completo = total > 0 && n >= total
                          const agora = exRetomada?.nome === ex.nome
                          // O exercício da vez já abre; tocar em outro troca o aberto.
                          const aberto = (exAberto ?? exRetomada?.nome) === ex.nome
                          const img = imagemExercicio(ex)
                          const vid = youtubeId(ex.video)
                          const erro = erroInline[ex.nome]

                          return (
                            <div
                              key={k}
                              className={'tr-ex' + (completo ? ' feito' : '') + (agora ? ' agora' : '') + (aberto ? ' aberto' : '')}
                            >
                              <button
                                type="button"
                                className="tr-ex-cab"
                                onClick={() => setExAberto(aberto ? '' : ex.nome)}
                                aria-expanded={aberto}
                              >
                                {img
                                  ? <img
                                      src={img} alt="" className="tr-ex-foto" loading="lazy"
                                      onError={e => { e.currentTarget.style.visibility = 'hidden' }}
                                    />
                                  : <span className="tr-ex-marca">{completo ? <IcCheck /> : i + 1}</span>}
                                <span className="tr-ex-txt">
                                  <span className="tr-ex-nome">{ex.nome}</span>
                                  <span className="tr-ex-meta">{resumoExercicio(ex)}</span>
                                </span>
                                <span className={'tr-ex-cont' + (completo ? ' ok' : '')}>
                                  {completo ? <IcCheck /> : `${n}/${total}`}
                                </span>
                              </button>

                              {aberto && (
                                <div className="tr-ex-corpo">
                                  {ex.obs && <p className="tr-ex-obs">{ex.obs}</p>}

                                  {cargaAnterior(ex.nome) && (
                                    <p className="tr-ex-anterior">
                                      Da última vez você usou <strong>{comKg(cargaAnterior(ex.nome))}</strong>
                                    </p>
                                  )}

                                  <div className="tr-series">
                                    {ex.linhas.map((linha, li) => {
                                      const s = li + 1
                                      const feita = !!feitas[chaveSerie(ex.nome, s)]
                                      return (
                                        <button
                                          key={s}
                                          type="button"
                                          className={'tr-serie' + (feita ? ' feita' : '')}
                                          onClick={() => !feita && marcarInline(ex, s, linha)}
                                          disabled={feita}
                                          title={feita ? `Série ${s} registrada` : `Marcar a série ${s}`}
                                        >
                                          <span className="tr-serie-n">{feita ? <IcCheck /> : s + 'ª'}</span>
                                          <span className="tr-serie-alvo">
                                            {linha.reps}{linha.carga ? ' · ' + comKg(linha.carga) : ''}
                                          </span>
                                        </button>
                                      )
                                    })}
                                  </div>

                                  {!completo && (
                                    <div className="tr-ex-carga">
                                      <label htmlFor={'carga-' + i + '-' + k}>Carga usada (kg)</label>
                                      <input
                                        id={'carga-' + i + '-' + k}
                                        type="number" inputMode="decimal"
                                        value={pesoInline[ex.nome] ?? ''}
                                        onChange={e => setPesoInline(p => ({ ...p, [ex.nome]: e.target.value }))}
                                        placeholder={ex.linhas[n]?.carga || 'igual ao alvo'}
                                      />
                                      <p className="mini">Deixe em branco para registrar a carga do plano.</p>
                                    </div>
                                  )}

                                  {erro && <div className="erro">{erro}</div>}

                                  {vid && (() => {
                                    const vAberto = videoAberto === ex.nome
                                    return (
                                      <div className="tr-video">
                                        <button
                                          type="button"
                                          className={'tr-video-btn' + (vAberto ? ' aberto' : '')}
                                          onClick={() => setVideoAberto(vAberto ? null : ex.nome)}
                                          aria-expanded={vAberto}
                                        >
                                          <IcVideo />
                                          <span>Como executar</span>
                                          <span className="tvb-seta" aria-hidden="true"><IcSeta /></span>
                                        </button>

                                        {vAberto && (
                                          <div className="video-wrap">
                                            <iframe
                                              src={'https://www.youtube.com/embed/' + vid + '?autoplay=1'}
                                              title={'Execução de ' + ex.nome}
                                              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                              allowFullScreen
                                            />
                                          </div>
                                        )}
                                      </div>
                                    )
                                  })()}

                                  {(() => {
                                    const fbFeito = fbDeHoje.has(ex.nome)
                                    const fbOpen = fbAberto === ex.nome
                                    if (fbFeito && !fbOpen) {
                                      return <p className="tr-fb-ok"><IcCheck /> Feedback enviado hoje</p>
                                    }
                                    return (
                                      <div className="tr-fb">
                                        <button
                                          type="button"
                                          className={'tr-video-btn' + (fbOpen ? ' aberto' : '')}
                                          onClick={() => (fbOpen ? setFbAberto(null) : abrirFeedback(ex.nome))}
                                          aria-expanded={fbOpen}
                                        >
                                          <IcChat />
                                          <span>Feedback</span>
                                          <span className="tvb-seta" aria-hidden="true"><IcSeta /></span>
                                        </button>

                                        {fbOpen && (
                                          <div className="tr-fb-corpo">
                                            {PERGUNTAS_FEEDBACK.map(p => (
                                              <div key={p.id} className="tr-fb-linha">
                                                <span className="tr-fb-pergunta">{p.texto}</span>
                                                <div className="tr-fb-opcoes">
                                                  {['sim', 'nao'].map(v => (
                                                    <button
                                                      key={v}
                                                      type="button"
                                                      className={'tr-fb-op' + (fbRespostas[p.id] === v ? ' marcada' : '')}
                                                      onClick={() => setFbRespostas(r => ({
                                                        ...r,
                                                        [p.id]: r[p.id] === v ? undefined : v
                                                      }))}
                                                      aria-pressed={fbRespostas[p.id] === v}
                                                    >
                                                      {v === 'sim' ? 'Sim' : 'Não'}
                                                    </button>
                                                  ))}
                                                </div>
                                              </div>
                                            ))}

                                            <label htmlFor={'fb-' + i + '-' + k}>Quer contar mais alguma coisa?</label>
                                            <textarea
                                              id={'fb-' + i + '-' + k}
                                              rows={3}
                                              value={fbComentario}
                                              onChange={e => setFbComentario(e.target.value)}
                                              placeholder="Ex: senti o joelho na última série"
                                            />

                                            <button
                                              type="button"
                                              className="btn btn-sm"
                                              onClick={() => enviarFeedback(ex)}
                                              disabled={fbEnviando}
                                            >
                                              {fbEnviando ? 'Enviando...' : 'Enviar para o personal'}
                                            </button>
                                          </div>
                                        )}
                                      </div>
                                    )
                                  })()}
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </li>
                    ))}
                  </ol>

                  <p className="mini" style={{ marginTop: 12 }}>
                    Plano {plano.nome} · atualizado em {plano.atualizadoEm ? fmtData(plano.atualizadoEm) : '—'}
                  </p>
            </>
          )}
        </>
      )}

      {/* ===== EVOLUÇÃO ===== */}
      {aba === 'evolucao' && (
        <>
          <div className="metricas-aluno">
            <div className="metrica">
              <span className="m-icone"><IcFogo /></span>
              <div>
                <div className="m-valor">{sequencia}</div>
                <div className="m-label">dias seguidos</div>
              </div>
            </div>
            <div className="metrica">
              <span className="m-icone"><IcCalendario /></span>
              <div>
                <div className="m-valor">{treinosNoMes}</div>
                <div className="m-label">treinos no mês</div>
              </div>
            </div>
            <div className="metrica">
              <span className="m-icone"><IcHalter /></span>
              <div>
                <div className="m-valor">{diasTreinados.size}</div>
                <div className="m-label">dias treinados</div>
              </div>
            </div>
            <div className="metrica">
              <span className="m-icone"><IcTrofeu /></span>
              <div>
                <div className="m-valor">{listaExec.length}</div>
                <div className="m-label">séries no total</div>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-titulo"><h2>Calendário de treinos</h2></div>
            <Heatmap diasTreinados={diasTreinados} />
          </div>

          <EvolucaoCorporal avaliacoes={avalVisiveis} />

          <div className="card">
            <div className="card-titulo">
              <div style={{ minWidth: 0 }}>
                <h2>Minhas avaliações</h2>
                <p className="mini">Registradas pelo seu personal.</p>
              </div>
            </div>

            {avalVisiveis.length === 0 && (
              <p className="muted">Seu personal ainda não liberou nenhuma avaliação.</p>
            )}

            {[...avalVisiveis].reverse().map(a => {
              const aberta = avalAberta === a.id
              return (
                <div key={a.id} className="av-linha">
                  <button
                    type="button"
                    className="av-linha-cab"
                    onClick={() => setAvalAberta(aberta ? null : a.id)}
                    aria-expanded={aberta}
                  >
                    <div className="av-linha-txt">
                      <strong>{fmtData(a.ts)}</strong>
                      <span className="muted">
                        {a.resumo?.peso ? a.resumo.peso + ' kg' : 'Ver detalhes'}
                        {a.resumo?.percentualGordura
                          ? ' · ' + String(a.resumo.percentualGordura).replace('.', ',') + '% gordura'
                          : ''}
                      </span>
                    </div>
                    <span className="av-seta">{aberta ? '−' : '+'}</span>
                  </button>
                  {aberta && <AvaliacaoDetalhe avaliacao={a} comoAluno />}
                </div>
              )
            })}
          </div>

          <div className="card">
            <div className="card-titulo"><h2>Planos anteriores</h2></div>
            {listaHist.length === 0 && <p className="muted">Nenhum plano antigo ainda.</p>}
            {listaHist.map(t => {
              const antigo = normalizarPlano(t)
              if (!antigo) return null
              return (
                <div key={t.id} className="exercicio-card">
                  <div className="titulo">
                    <span>{antigo.nome}</span>
                    <span className="mini">até {t.arquivadoEm ? fmtData(t.arquivadoEm) : '—'}</span>
                  </div>
                  {antigo.lista.map((d, i) => (
                    <div key={i} className="template-dia">
                      <span className="td-letra">{LETRAS[i] || i + 1}</span>
                      <span className="td-nome">{d.nome}</span>
                      <span className="td-qtd">{d.exercicios.length} ex.</span>
                    </div>
                  ))}
                </div>
              )
            })}
          </div>
        </>
      )}

      {/* ===== PAGAMENTOS ===== */}
      {aba === 'pagamentos' && (
        <>
          {personal?.chavePix && (
            <div className="card">
              <div className="card-titulo"><h2>Chave PIX do personal</h2></div>
              <div className="codigo-box">{personal.chavePix}</div>
              <p className="mini" style={{ marginTop: 8 }}>Pague pelo seu banco e depois registre o pagamento abaixo.</p>
            </div>
          )}

          <div className="card">
            <div className="card-titulo"><h2>Cobranças em aberto</h2></div>
            {pendentes.length === 0 && emAnalise.length === 0 && <p className="muted">Nenhuma cobrança em aberto.</p>}
            {pendentes.map(c => (
              <div key={c.id} className="cobranca-item">
                <div>
                  <strong>{fmtMoeda(c.valor)}</strong> · {c.tipo}
                  <div className={'mini ' + (vencida(c) ? 'texto-vencido' : '')}>
                    Vence em {c.vencimento.split('-').reverse().join('/')}{vencida(c) ? ' · vencida' : ''}
                  </div>
                </div>
                <button className="btn btn-sm" onClick={() => setPagCobId(c.id)}>Registrar pagamento</button>
              </div>
            ))}
            {emAnalise.map(c => (
              <div key={c.id} className="cobranca-item">
                <div>
                  <strong>{fmtMoeda(c.valor)}</strong> · {c.tipo}
                  <div className="mini">Aguardando validação do personal</div>
                </div>
                <span className="selo-analise">Em análise</span>
              </div>
            ))}
          </div>

          {pagCobId && (
            <div className="card destaque-card">
              <div className="card-titulo"><h2>Registrar pagamento</h2></div>
              <form onSubmit={registrarPagamento}>
                <label>Observação (opcional)</label>
                <input value={pagObs} onChange={e => setPagObs(e.target.value)} placeholder='Ex: "PIX feito às 14h em nome de João"' />
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn">Confirmar registro</button>
                  <button type="button" className="btn btn-sec btn-auto" onClick={() => setPagCobId(null)}>Cancelar</button>
                </div>
              </form>
            </div>
          )}

          <div className="card">
            <div className="card-titulo"><h2>Histórico</h2></div>
            {pagas.length === 0 && <p className="muted">Nenhum pagamento validado ainda.</p>}
            {pagas.map(c => (
              <div key={c.id} className="cobranca-item">
                <div>
                  <strong>{fmtMoeda(c.valor)}</strong> · {c.tipo}
                  <div className="mini">Validado em {c.validadaEm ? fmtData(c.validadaEm) : '—'}</div>
                </div>
                <span className="selo-pago">Pago</span>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ===== CHAT ===== */}
      {aba === 'chat' && (
        <div className="card sem-padding">
          <Chat
            chatId={perfil.personalId + '_' + user.uid}
            meuUid={user.uid}
            outroUid={perfil.personalId}
            outroNome={personal?.nome || 'Seu personal'}
            outroFoto={personal?.foto}
            rotaNotif="/personal"
          />
        </div>
      )}

      {/* ===== CONFIG ===== */}
      {aba === 'diario' && <Diario user={user} perfil={perfil} />}

      {aba === 'suplementos' && (
        <Suplementacao alunoId={user.uid} podeMarcar quemSou="proprio" />
      )}

      {aba === 'config' && <Config user={user} perfil={perfil} />}
    </Layout>
  )
}
