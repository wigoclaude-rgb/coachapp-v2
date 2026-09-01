import { useEffect, useMemo, useState } from 'react'
import { ref, onValue, push, update, remove } from 'firebase/database'
import { db } from '../../firebase'
import { fmtData, fmtMoeda, vencida, imagemExercicio, youtubeId, comKg, beep } from '../../lib/util'
import { notificar } from '../../lib/notify'
import {
  LETRAS, normalizarPlano, indiceSeguro, duracaoEstimada, totalSeries,
  agruparBlocos, chaveSerie, resumoExercicio, cargaNumero
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
import Anexos from '../../components/Anexos.jsx'
import { organizar } from '../../lib/anexos'
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
  diario: { t: 'Check-in', s: 'Seu registro do dia — privado' },
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
/* Motivos de baixar a carga. Curtos, para responder de pé entre as séries. */
const MOTIVOS_REDUCAO = [
  'Senti dor',
  'Sem força hoje',
  'Aparelho diferente',
  'Estava pesado demais'
]

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
  // Série que a pessoa quer marcar com carga menor que a do plano, aguardando o motivo.
  const [reducao, setReducao] = useState(null)
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
  const [anexos, setAnexos] = useState({})
  /*
    Treino que o aluno escolheu para hoje, quando o personal libera.
    Vive só na tela: amanhã volta a valer o ciclo, senão uma troca pontual
    viraria a nova ordem sem ninguém ter decidido isso.
  */
  const [escolhaHoje, setEscolhaHoje] = useState(null)
  /*
    Resumo do treino encerrado sem completar. Vive só na tela: o ciclo já avançou
    no banco, e isto existe para a pessoa não ver o treino seguinte aparecer do
    nada logo depois de dizer que parou.
  */
  const [encerrado, setEncerrado] = useState(null)

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
    // Só o metadado; o arquivo em si é lido ao abrir.
    const u10 = onValue(ref(db, 'anexos/' + user.uid), s => setAnexos(s.val() || {}))
    return () => { u1(); u2(); u3(); u4(); u5(); u6(); u7(); u8(); u9(); u10() }
  }, [user.uid, perfil.personalId])

  /*
    Séries concluídas hoje. Guarda o peso junto, não só `true`: é ele que a
    coluna Carga mostra depois de marcada — o que a pessoa levantou de verdade,
    e não o alvo que o personal escreveu.
  */
  useEffect(() => {
    const hoje = new Date().toDateString()
    const f = {}
    // `entries` e não `values`: o id do registro é o que permite desfazer depois.
    Object.entries(execucoes).forEach(([id, e]) => {
      if (new Date(e.ts).toDateString() === hoje) {
        f[e.exercicio + '_' + e.serie] = { id, peso: e.peso ?? '', ts: e.ts }
      }
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
  /*
    Documento do aluno (atestado, exame) é dele — sempre visível.
    Anexo preso a uma avaliação segue a visibilidade dessa avaliação.
  */
  const { doAluno: anexosDoAluno, porAvaliacao: anexosPorAval } = useMemo(
    () => organizar(anexos), [anexos]
  )

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
  /*
    Carga do treino anterior, guardada POR SÉRIE.

    Por exercício não servia numa pirâmide: pegava o último peso registrado, que
    é o da série mais pesada, e mostrava 65 kg para quem ia fazer a primeira de
    20 repetições. `listaExec` vem do mais novo para o mais velho, então o
    primeiro que aparece de cada série já é o mais recente.
  */
  const cargaAnterior = useMemo(() => {
    const mapa = {}
    const hoje = new Date().toDateString()
    listaExec.forEach(e => {
      if (new Date(e.ts).toDateString() === hoje) return
      const chave = e.exercicio + '_' + e.serie
      if (mapa[chave] === undefined && e.peso) mapa[chave] = Number(e.peso)
    })
    return (nome, serie) => mapa[nome + '_' + serie] ?? null
  }, [listaExec])

  /* ---------- Plano de treino ---------- */
  const plano = useMemo(() => normalizarPlano(treinoBruto), [treinoBruto])
  const totalDias = plano ? plano.lista.length : 0
  const idxCiclo = plano ? indiceSeguro(plano.indiceAtual, totalDias) : 0
  const podeEscolher = treinoBruto?.permiteEscolha === true && totalDias > 1

  /* A escolha só vale se o plano ainda tiver aquele treino — plano trocado, escolha cai. */
  const idxAtual = podeEscolher && escolhaHoje !== null && escolhaHoje < totalDias
    ? escolhaHoje
    : idxCiclo
  const trocado = idxAtual !== idxCiclo
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
  /*
    Registra a série. Carga menor que a do plano é PERMITIDA e fica marcada com
    o motivo — antes era recusada, e recusar só ensinava a mentir no número ou a
    não marcar a série. Com o motivo gravado, o personal vê o que aconteceu.

    `cargaNumero` e não `Number`: a carga é texto livre, e Number("45Kg") é NaN —
    era por isso que a trava antiga nem disparava quando o personal escrevia o Kg.
  */
  async function marcarSerie(ex, serie, pesoDigitado, cargaLinha, motivo = '') {
    if (feitas[chaveSerie(ex.nome, serie)]) return null
    const alvo = cargaNumero(cargaLinha) || 0
    const peso = pesoDigitado !== undefined && pesoDigitado !== '' ? Number(pesoDigitado) : alvo
    const abaixo = alvo > 0 && peso > 0 && peso < alvo

    await push(ref(db, 'execucoes/' + user.uid), {
      exercicio: ex.nome,
      serie,
      peso: peso || '',
      ts: Date.now(),
      ...(abaixo ? { alvo, motivo: motivo || 'não informado' } : {})
    })
    return null
  }

  /**
   * Copia a carga da série atual para as seguintes que ainda faltam.
   * Só preenche o campo — nada é marcado; a pessoa ainda confirma série a série.
   */
  function repetirCarga(ex, serie) {
    const valor = pesoInline[ex.nome + '_' + serie] ?? cargaNumero(ex.linhas[serie - 1]?.carga)
    if (valor === '' || valor === null || valor === undefined) return
    setPesoInline(p => {
      const novo = { ...p }
      ex.linhas.forEach((_, li) => {
        const s = li + 1
        if (s > serie && !feitas[chaveSerie(ex.nome, s)]) novo[ex.nome + '_' + s] = String(valor)
      })
      return novo
    })
  }

  /**
   * Desfaz uma série marcada por engano. Só as de hoje: `feitas` é o de hoje, e
   * dia fechado é histórico — corrigir treino antigo é assunto do personal.
   */
  async function desmarcarSerie(ex, serie) {
    const reg = feitas[chaveSerie(ex.nome, serie)]
    if (!reg?.id) return
    await remove(ref(db, 'execucoes/' + user.uid + '/' + reg.id))
    setDescanso(null)
  }

  /**
   * Marca uma série da lista. Carga abaixo do plano abre a pergunta do motivo
   * antes de gravar — uma vez respondida, `motivo` vem preenchido e segue direto.
   */
  async function marcarInline(ex, serie, linha, motivo = '') {
    const chave = ex.nome + '_' + serie
    const digitado = pesoInline[chave]
    const alvo = cargaNumero(linha.carga) || 0
    const peso = digitado !== undefined && digitado !== '' ? Number(digitado) : alvo

    if (!motivo && alvo > 0 && peso > 0 && peso < alvo) {
      setReducao({ nome: ex.nome, serie, peso, alvo })
      return
    }

    const msg = await marcarSerie(ex, serie, digitado ?? '', linha.carga, motivo)
    setErroInline(e => ({ ...e, [ex.nome]: msg || '' }))
    if (msg) return

    setReducao(null)
    setPesoInline(p => ({ ...p, [chave]: '' }))

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

  /**
   * Encerra o dia sem ter completado o treino e libera o próximo do ciclo.
   *
   * Sem isto o ciclo travava: o avanço só acontecia com todas as séries marcadas,
   * então quem não terminava ficava preso no mesmo treino indefinidamente.
   *
   * O registro vai para `feedbacks` de propósito — é o aluno contando algo ao
   * personal sobre o treino, chega na aba onde ele já olha, e não precisa de
   * regra nova no banco. Treino encurtado toda semana é sinal de plano longo
   * demais para a rotina da pessoa, e hoje esse dado se perdia.
   */
  async function encerrarPorHoje() {
    const proximo = ciclico ? plano.lista[(idxAtual + 1) % totalDias]?.nome : null
    const texto = proximo
      ? `Encerrar o treino com ${seriesFeitasHoje} de ${seriesDoDia} séries? O próximo será o ${proximo}.`
      : `Encerrar o treino com ${seriesFeitasHoje} de ${seriesDoDia} séries?`
    if (!confirm(texto)) return

    try {
      await push(ref(db, 'feedbacks/' + user.uid), {
        tipo: 'sessao',
        treino: nomeTreinoHoje,
        feitas: seriesFeitasHoje,
        total: seriesDoDia,
        ts: Date.now()
      })
      if (ciclico) {
        await update(ref(db, 'treinos/' + user.uid), { indiceAtual: (idxAtual + 1) % totalDias })
      }
      setEncerrado({ treino: nomeTreinoHoje, feitas: seriesFeitasHoje, total: seriesDoDia, proximo })
      setEscolhaHoje(null)
    } catch (err) {
      console.warn('Falha ao encerrar o treino:', err)
    }
  }

  async function concluirTreino() {
    /*
      O ciclo continua a partir do que foi treinado de verdade, não do que estava
      marcado. Quem refez o A hoje segue para o B amanhã — que é o que a pessoa
      espera de um ABC, mesmo tendo saído da ordem.
    */
    if (ciclico) {
      await update(ref(db, 'treinos/' + user.uid), { indiceAtual: (idxAtual + 1) % totalDias })
    }
    setEscolhaHoje(null)
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
    { id: 'diario', label: 'Check-in', icone: <IcCalendario /> },
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
                        <div className={'tr-ciclo' + (podeEscolher ? ' escolhivel' : '')}>
                          {plano.lista.map((d, i) => (
                            <button
                              key={i}
                              type="button"
                              className={'tr-passo' + (i === idxAtual ? ' agora' : i < idxCiclo ? ' feito' : '')}
                              onClick={() => (podeEscolher ? setEscolhaHoje(i) : setVerTreino(i))}
                              title={podeEscolher ? 'Treinar ' + d.nome : 'Ver ' + d.nome}
                              aria-pressed={podeEscolher ? i === idxAtual : undefined}
                            >
                              {LETRAS[i] || i + 1}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    <h2 className="tr-nome">{nomeTreinoHoje}</h2>

                    {podeEscolher && (
                      <div className="tr-troca">
                        {trocado ? (
                          <>
                            <span>
                              Trocado por você. Pelo ciclo, hoje seria o{' '}
                              <strong>{LETRAS[idxCiclo] || idxCiclo + 1}</strong>.
                            </span>
                            <button type="button" onClick={() => setEscolhaHoje(null)}>Voltar ao ciclo</button>
                          </>
                        ) : (
                          <span>Toque numa letra acima para treinar outro hoje.</span>
                        )}
                        <button type="button" onClick={() => setVerTreino(idxAtual)}>Ver detalhes</button>
                      </div>
                    )}

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
                    ) : encerrado ? (
                      <div className="tr-encerrado">
                        <span className="tr-enc-icone"><IcCheck /></span>
                        <div>
                          <strong>{encerrado.treino} encerrado</strong>
                          <span>
                            {encerrado.feitas} de {encerrado.total} séries registradas.
                            {encerrado.proximo ? ` No próximo treino: ${encerrado.proximo}.` : ''}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <>
                        {exRetomada && (
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

                        {/*
                          Só aparece depois da primeira série: sem nada marcado não há
                          o que encerrar, e o botão só atrapalharia quem vai começar.
                        */}
                        {seriesFeitasHoje > 0 && (
                          <button className="btn btn-sec tr-acao" onClick={encerrarPorHoje}>
                            Terminei por hoje
                          </button>
                        )}
                      </>
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
                          // Primeira série pendente: é a linha que ganha o campo e o botão.
                          const proximaSerie = ex.linhas.findIndex((_, li) => !feitas[chaveSerie(ex.nome, li + 1)]) + 1
                          const temDescanso = ex.linhas.some(l => Number(l.descanso) > 0)
                          // Coluna "Anterior" só entra quando existe histórico — senão é uma coluna de traços.
                          const temAnterior = ex.linhas.some((_, li) => cargaAnterior(ex.nome, li + 1))
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


                                  {/*
                                    Mesma tabela da consulta A/B/C, mas viva: a linha da
                                    vez tem o campo de carga e o botão. O peso é por série,
                                    e não um campo por exercício — numa pirâmide de 30 a
                                    65 kg, um campo só obriga a reescrever a cada série.
                                  */}
                                  <table className="tr-tabela">
                                    <thead>
                                      <tr>
                                        <th>Série</th>
                                        <th>Reps</th>
                                        {temAnterior && <th title="O que você usou no último treino">Anterior</th>}
                                        <th>Carga</th>
                                        {temDescanso && <th>Desc.</th>}
                                        <th />
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {ex.linhas.map((linha, li) => {
                                        const s = li + 1
                                        const reg = feitas[chaveSerie(ex.nome, s)]
                                        const feita = !!reg
                                        const daVez = !feita && s === proximaSerie
                                        const chave = ex.nome + '_' + s
                                        return (
                                          <tr key={s} className={(feita ? 'feita' : '') + (daVez ? ' da-vez' : '')}>
                                            <td className="ts-n">{s}ª</td>
                                            <td>{linha.reps || '—'}</td>
                                            {temAnterior && (
                                              <td className="ts-antes">
                                                {cargaAnterior(ex.nome, s) ? comKg(cargaAnterior(ex.nome, s)) : '—'}
                                              </td>
                                            )}
                                            <td className="ts-carga">
                                              {feita
                                                ? <strong>{reg.peso ? comKg(reg.peso) : comKg(linha.carga) || 'livre'}</strong>
                                                : daVez
                                                  ? <input
                                                      type="number" inputMode="decimal"
                                                      className="ts-input"
                                                      /*
                                                        Já vem com o peso do plano. Na pirâmide, a
                                                        pessoa só confirma; ajusta quando pegou
                                                        diferente. `??` e não `||`: campo limpo pela
                                                        própria pessoa tem que continuar limpo.
                                                      */
                                                      value={pesoInline[chave] ?? (cargaNumero(linha.carga) ?? '')}
                                                      onChange={e => setPesoInline(p => ({ ...p, [chave]: e.target.value }))}
                                                      placeholder="livre"
                                                      aria-label={`Carga da série ${s}`}
                                                    />
                                                  : pesoInline[chave] !== undefined && pesoInline[chave] !== ''
                                                    /* Carga copiada da série anterior: mostra o que vai valer, não o alvo. */
                                                    ? <span className="ts-copiada">{comKg(pesoInline[chave])}</span>
                                                    : <span className="ts-alvo">{linha.carga ? comKg(linha.carga) : 'Livre'}</span>}
                                            </td>
                                            {temDescanso && (
                                              <td className="ts-desc">
                                                {Number(linha.descanso) > 0 ? linha.descanso + 's' : '—'}
                                              </td>
                                            )}
                                            <td className="ts-acao">
                                              {/* Mesma bolinha marca e desmarca — tocar de novo desfaz. */}
                                              <button
                                                type="button"
                                                className={'ts-bolinha' + (feita ? ' feita' : '') + (daVez ? ' da-vez' : '')}
                                                onClick={() => (feita ? desmarcarSerie(ex, s) : marcarInline(ex, s, linha))}
                                                aria-pressed={feita}
                                                aria-label={feita ? `Desfazer a ${s}ª série` : `Marcar a ${s}ª série`}
                                                title={feita ? 'Toque para desfazer' : 'Toque para marcar'}
                                              >
                                                {feita && <IcCheck />}
                                              </button>
                                            </td>
                                          </tr>
                                        )
                                      })}
                                    </tbody>
                                  </table>

                                  {/* Atalho para carga constante: uma série define as que faltam. */}
                                  {(() => {
                                    const faltamDepois = ex.linhas.filter((_, li) =>
                                      li + 1 > proximaSerie && !feitas[chaveSerie(ex.nome, li + 1)]
                                    ).length
                                    if (proximaSerie < 1 || faltamDepois === 0) return null
                                    const atual = pesoInline[ex.nome + '_' + proximaSerie]
                                      ?? cargaNumero(ex.linhas[proximaSerie - 1]?.carga)
                                    if (atual === null || atual === undefined || atual === '') return null
                                    return (
                                      <button
                                        type="button" className="tr-repetir"
                                        onClick={() => repetirCarga(ex, proximaSerie)}
                                      >
                                        Usar {atual} kg {faltamDepois === 1 ? 'na última série' : `nas outras ${faltamDepois} séries`}
                                      </button>
                                    )
                                  })()}

                                  {reducao?.nome === ex.nome && (
                                    <div className="tr-reducao">
                                      <p className="tr-red-tit">
                                        <strong>{reducao.peso} kg</strong> na {reducao.serie}ª, sendo que
                                        o plano pede <strong>{reducao.alvo} kg</strong>. Sem problema —
                                        só conta o motivo para o seu personal ajustar.
                                      </p>
                                      <div className="opcoes-chips">
                                        {MOTIVOS_REDUCAO.map(m => (
                                          <button
                                            key={m} type="button" className="chip-opcao"
                                            onClick={() => marcarInline(ex, reducao.serie, ex.linhas[reducao.serie - 1], m)}
                                          >
                                            {m}
                                          </button>
                                        ))}
                                      </div>
                                      <div className="tr-red-acoes">
                                        <button
                                          type="button" className="btn btn-ghost btn-sm"
                                          onClick={() => marcarInline(ex, reducao.serie, ex.linhas[reducao.serie - 1], 'não informado')}
                                        >
                                          Prefiro não dizer
                                        </button>
                                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setReducao(null)}>
                                          Cancelar
                                        </button>
                                      </div>
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

          {anexosDoAluno.length > 0 && (
            <div className="card">
              <div className="card-titulo">
                <div style={{ minWidth: 0 }}>
                  <h2>Meus documentos</h2>
                  <p className="mini">Arquivos que seu personal guardou na sua ficha.</p>
                </div>
              </div>
              <Anexos alunoId={user.uid} lista={anexosDoAluno} />
            </div>
          )}

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
                  {aberta && (
                    <>
                      <AvaliacaoDetalhe avaliacao={a} comoAluno />
                      {(anexosPorAval[a.id] || []).length > 0 && (
                        <div style={{ padding: '0 16px 16px' }}>
                          <Anexos alunoId={user.uid} lista={anexosPorAval[a.id]} titulo="Anexos" />
                        </div>
                      )}
                    </>
                  )}
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
