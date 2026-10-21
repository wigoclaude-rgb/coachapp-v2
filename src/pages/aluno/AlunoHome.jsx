import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ref, onValue, push, set, update, remove, runTransaction } from 'firebase/database'
import { observarConexao } from '../../lib/presenca'
import { db } from '../../firebase'
import { fmtData, fmtMoeda, vencida, hojeISO, imagemExercicio, youtubeId, comKg, beep } from '../../lib/util'
import { notificar } from '../../lib/notify'
import {
  organizar as organizarCobrancas, historico as historicoCobrancas,
  ehAberta, estaVencida, titulo as tituloCobranca, referencia, dataBR,
  EM_ANALISE, PAGO, RECUSADO
} from '../../lib/cobrancas'
import { enviarFoto } from '../../lib/fotos'
import { anosDe, casaStatus } from '../../lib/filtroCobrancas'
import { montarPainel } from '../../lib/painel'
import { recordes, prsNoMes, frequenciaDoMes, evolucaoDeCarga, sequenciaAtual } from '../../lib/evolucao'
import {
  diasQueContam, aberta as sessaoEmAndamento, novaSessao, paraBanco,
  feitasDaSessao, feitasSoltasDeHoje, deveFecharSozinha, fechamento,
  proximoIndice, estadosDoCiclo, EM_ANDAMENTO
} from '../../lib/sessoes'
import { repsAlvo, repsParaGravar, abaixoDoAlvo } from '../../lib/series'
import Inicio from '../../components/aluno/Inicio.jsx'
import SituacaoPagamento from '../../components/pagamentos/SituacaoPagamento.jsx'
import LinhaCobranca from '../../components/pagamentos/LinhaCobranca.jsx'
import {
  LETRAS, normalizarPlano, indiceSeguro, duracaoEstimada, totalSeries,
  agruparBlocos, chaveSerie, resumoExercicio, cargaNumero
} from '../../lib/treinoModel'
import Chat from '../../components/Chat.jsx'
import Diario from './Diario.jsx'
import Config from '../Config.jsx'
import Layout from '../../components/Layout.jsx'
import Tour from '../../components/Tour.jsx'
import Suplementacao from '../../components/Suplementacao.jsx'
import AvaliacaoDetalhe from '../../components/AvaliacaoDetalhe.jsx'
import Evolucao from '../../components/Evolucao.jsx'
import { normalizarAvaliacao } from '../../lib/avaliacao'
import Anexos from '../../components/Anexos.jsx'
import { organizar } from '../../lib/anexos'
// `diaISO` daqui já existe no arquivo para a sequência de treinos; o alias evita a colisão.
import { normalizarSuplemento, faltaHoje, registroDoDia, TOMADO, diaISO as diaSup } from '../../lib/suplementos'
import { registrarDose } from '../../lib/doses'
import {
  TOUR_ALUNO_TREINO, TOUR_ALUNO_EVOLUCAO, TOUR_ALUNO_DIARIO, TOUR_ALUNO_PAGAMENTOS
} from '../../lib/tours'
import { IcInicio,
  IcTreino, IcEvolucao, IcPagamentos, IcChat, IcConfig,
  IcFogo, IcCalendario, IcCheck, IcHalter, IcAlerta, IcTrofeu, IcVideo, IcSeta, IcFechar,
  IcSuplemento, IcNuvemOff, IcPlay
} from '../../components/Icones.jsx'

const ABAS_VALIDAS = new Set(['inicio', 'treino', 'evolucao', 'diario', 'suplementos', 'pagamentos', 'chat', 'config'])

const TITULOS = {
  inicio: { t: 'Início', s: 'O que precisa de você hoje' },
  treino: { t: 'Treino', s: 'Seu plano de hoje' },
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

export default function AlunoHome({ user, perfil, onSair }) {
  /*
    A notificação abre em /aluno?aba=suplementos&sup=ID. Sem ler isso aqui, o
    aluno cairia na tela de treino e teria que procurar a dose — que é
    exatamente o que o lembrete existe para evitar.
  */
  const [params, setParams] = useSearchParams()
  const [aba, setAba] = useState(() => ABAS_VALIDAS.has(params.get('aba')) ? params.get('aba') : 'inicio')
  const supDestaque = params.get('sup') || null
  const [treinoBruto, setTreinoBruto] = useState(null)
  const [feitas, setFeitas] = useState({})
  const [cobrancas, setCobrancas] = useState({})
  const [execucoes, setExecucoes] = useState({})
  const [avaliacoes, setAvaliacoes] = useState({})
  const [historico, setHistorico] = useState({})
  const [personal, setPersonal] = useState(null)
  const [pagObs, setPagObs] = useState('')
  const [pagCobId, setPagCobId] = useState(null)
  const [pagData, setPagData] = useState('')
  const [pagArquivo, setPagArquivo] = useState(null)
  const [pagEnviando, setPagEnviando] = useState(false)
  const [pagErro, setPagErro] = useState('')
  const [pagOk, setPagOk] = useState(null)
  const [pixCopiado, setPixCopiado] = useState(false)
  const [histAno, setHistAno] = useState('todos')
  const [histStatus, setHistStatus] = useState('pago')

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
  // A Home precisa saber se há mensagem nova e se o check-in de hoje foi feito.
  // Os dois nós já são legíveis pelo aluno; só não eram carregados aqui.
  const [mensagens, setMensagens] = useState({})
  const [diario, setDiario] = useState({})
  const [avisos, setAvisos] = useState({})
  /*
    Treino que o aluno escolheu para hoje, quando o personal libera.
    Vive só na tela: amanhã volta a valer o ciclo, senão uma troca pontual
    viraria a nova ordem sem ninguém ter decidido isso.
  */
  const [escolhaHoje, setEscolhaHoje] = useState(null)
  const [sessoes, setSessoes] = useState({})
  /* O que o aluno digitou nas reps. Vazio = fez o que o personal pediu. */
  const [repsInline, setRepsInline] = useState({})
  /* Confirmações na própria tela, no lugar do `confirm()` do navegador. */
  const [trocaPedida, setTrocaPedida] = useState(null)
  const [confirmarFim, setConfirmarFim] = useState(null)
  /* Séries já enviadas e ainda sem eco do banco — barra o duplo toque. */
  const emVoo = useRef(new Set())
  /* Sessão criada agora e ainda sem eco: impede que duas séries marcadas em
     sequência abram duas sessões para o mesmo treino. */
  const sessaoCriada = useRef(null)
  /* Fechamento automático só pode rodar uma vez por sessão. */
  const jaFechou = useRef(new Set())
  /* Começa conectado: supor o contrário mostraria o aviso por um instante em
     toda abertura do app, inclusive para quem está com sinal. */
  const [conectado, setConectado] = useState(true)
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
    const uS = onValue(ref(db, 'sessoes/' + user.uid), s => setSessoes(s.val() || {}))
    const u4 = onValue(ref(db, 'avaliacoes/' + user.uid), s => setAvaliacoes(s.val() || {}))
    const u5 = onValue(ref(db, 'treinosHistorico/' + user.uid), s => setHistorico(s.val() || {}))
    const u6 = onValue(ref(db, 'users/' + perfil.personalId), s => setPersonal(s.val()))
    const u7 = onValue(ref(db, 'feedbacks/' + user.uid), s => setFeedbacks(s.val() || {}))
    const u8 = onValue(ref(db, 'suplementos/' + user.uid), s => setSuplementos(s.val() || {}))
    const u9 = onValue(ref(db, 'suplementosTomados/' + user.uid), s => setSupTomados(s.val() || {}))
    // Só o metadado; o arquivo em si é lido ao abrir.
    const u10 = onValue(ref(db, 'anexos/' + user.uid), s => setAnexos(s.val() || {}))
    const u11 = onValue(ref(db, 'chats/' + perfil.personalId + '_' + user.uid), s => setMensagens(s.val() || {}))
    const u12 = onValue(ref(db, 'diario/' + user.uid), s => setDiario(s.val() || {}))
    const u13 = onValue(ref(db, 'notificacoes/' + user.uid), s => setAvisos(s.val() || {}))
    return () => { u1(); u2(); u3(); u4(); u5(); u6(); u7(); u8(); u9(); u10(); u11(); u12(); u13(); uS() }
  }, [user.uid, perfil.personalId])

  /*
    Séries concluídas hoje. Guarda o peso junto, não só `true`: é ele que a
    coluna Carga mostra depois de marcada — o que a pessoa levantou de verdade,
    e não o alvo que o personal escreveu.
  */
  useEffect(() => observarConexao(setConectado), [])

  const sessaoAberta = useMemo(() => sessaoEmAndamento(sessoes), [sessoes])

  /* Chegou o eco da sessão criada: a trava local não é mais necessária. */
  useEffect(() => {
    if (sessaoCriada.current && sessoes[sessaoCriada.current]) sessaoCriada.current = null
  }, [sessoes])

  /*
    Fecha sessão esquecida ao abrir o app.

    Em transação porque dois aparelhos abertos fechariam a mesma sessão duas
    vezes, e a segunda escrita sobrescreveria o `fimEm` da primeira com um
    horário pior. A transação devolve `undefined` quando outro já fechou, e o
    Firebase desiste sem gravar.

    `fimEm` é a última série, não a hora de agora: quando o app foi reaberto não
    diz nada sobre quando o treino acabou.
  */
  useEffect(() => {
    if (!sessaoAberta || !deveFecharSozinha(sessaoAberta)) return
    if (jaFechou.current.has(sessaoAberta.id)) return
    jaFechou.current.add(sessaoAberta.id)

    const daSessao = Object.values(execucoes).filter(e => e?.sessaoId === sessaoAberta.id)
    const ultima = daSessao.reduce((m, e) => Math.max(m, e.ts || 0), 0)
    const campos = fechamento(sessaoAberta, {
      seriesFeitas: daSessao.length,
      fimEm: ultima || sessaoAberta.inicioEm,
      encerradaPor: 'automatico'
    })

    runTransaction(ref(db, 'sessoes/' + user.uid + '/' + sessaoAberta.id), atual => {
      if (!atual || atual.status !== EM_ANDAMENTO) return   // outro aparelho já fechou
      return { ...atual, ...campos }
    }).catch(err => console.warn('Sessão não fechada sozinha:', err?.code || err))
  }, [sessaoAberta, execucoes, user.uid])


  /*
    O que já está marcado — agora DENTRO da sessão, não "tudo de hoje".

    A chave continua `exercício_série`, mas antes ela varria todas as execuções
    do dia: quem fazia supino no treino B e depois abria o C via o supino do C
    já marcado, porque o nome e o número da série batiam. O recorte por sessão
    é o que separa os dois.

    Sem sessão aberta, o comportamento é o antigo — as execuções soltas de hoje.
    É o que mantém a tela correta para quem ainda não tem nenhuma sessão.
  */
  useEffect(() => {
    const f = sessaoAberta
      ? feitasDaSessao(execucoes, sessaoAberta, sessoes)
      : feitasSoltasDeHoje(execucoes, new Date(), sessoes)
    setFeitas(f)
    // O que o banco já confirmou não precisa mais da trava local.
    Object.keys(f).forEach(k => emVoo.current.delete(k))
  }, [execucoes, sessoes, sessaoAberta])

  /* ---------- Cobranças ---------- */
  /*
    `fin` é a leitura da tela: o que está aberto, o que está vencido, o que já foi
    informado e qual cobrança pode receber o "Já paguei".

    O bloqueio do treino é conta à parte, e de propósito: ele usa `vencida()`, que
    continua contando a cobrança em análise como devida. Se bastasse informar o
    pagamento para destravar, o botão "Já paguei" viraria a chave do cadeado.
  */
  const fin = useMemo(() => organizarCobrancas(cobrancas), [cobrancas])
  /*
    O histórico começa nos pagamentos confirmados, que é o que o aluno procura
    quando abre esse bloco. "Todas" existe para quem quer conferir o ano inteiro
    — e aí a repetição com o topo da tela é escolha dele, não imposição nossa.
  */
  const anosHist = useMemo(() => anosDe(fin.lista), [fin.lista])
  const extrato = useMemo(() => {
    const base = histStatus === 'pago' ? historicoCobrancas(fin.lista) : fin.lista
    return base
      .filter(c => histAno === 'todos' || String(c.vencimento || '').startsWith(histAno))
      .filter(c => histStatus === 'pago' || casaStatus(c, histStatus))
      .sort((a, b) => (b.vencimento || '').localeCompare(a.vencimento || ''))
  }, [fin.lista, histAno, histStatus])
  const bloqueado = fin.lista.some(c => vencida(c))
  const proximaCobranca = fin.atual

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

  /*
    Um conjunto só, vindo da regra da sessão. Antes esta tela montava o próprio
    Set a partir de qualquer execução — uma série solta já pintava o dia como
    treinado na frequência e na sequência.
  */
  const diasTreinados = useMemo(() => diasQueContam(execucoes, sessoes), [execucoes, sessoes])
  /* `sequenciaAtual` da lib. A cópia que existia aqui era idêntica linha a
     linha — duas implementações da mesma regra é como elas divergem. */
  const sequencia = useMemo(() => sequenciaAtual(diasTreinados), [diasTreinados])

  const mesAtual = new Date().getMonth()
  const anoAtual = new Date().getFullYear()
  /* Do mesmo conjunto acima: dois Sets independentes podiam discordar sobre o
     mesmo dia, e discordavam — este contava execução solta, o outro também. */
  const treinosNoMes = useMemo(() => {
    const prefixo = anoAtual + '-' + String(mesAtual + 1).padStart(2, '0')
    return [...diasTreinados].filter(d => d.startsWith(prefixo)).length
  }, [diasTreinados, mesAtual, anoAtual])

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

  /*
    As repetições do último treino, do mesmo jeito que a carga. Em exercício de
    carga livre — flexão, abdominal — as repetições são a ÚNICA medida de
    progresso que existe, e até agora elas não eram nem gravadas.
  */
  const repsAnterior = useMemo(() => {
    const mapa = {}
    const hoje = new Date().toDateString()
    listaExec.forEach(e => {
      if (new Date(e.ts).toDateString() === hoje) return
      const chave = e.exercicio + '_' + e.serie
      if (mapa[chave] === undefined && e.reps) mapa[chave] = Number(e.reps)
    })
    return (nome, serie) => mapa[nome + '_' + serie] ?? null
  }, [listaExec])

  /* ---------- Plano de treino ---------- */
  const plano = useMemo(() => normalizarPlano(treinoBruto), [treinoBruto])
  const totalDias = plano ? plano.lista.length : 0
  const idxCiclo = plano ? indiceSeguro(plano.indiceAtual, totalDias) : 0
  /* Ausente = permite. Quem bloqueia é o personal, marcando a opção no editor;
     planos antigos, sem o campo, passam a deixar o aluno escolher. */
  const podeEscolher = treinoBruto?.permiteEscolha !== false && totalDias > 1

  /*
    Quem manda no treino de hoje, em ordem:
      1. a sessão em andamento — ela é o que a pessoa está fazendo AGORA, e
         sobrevive a recarregar a página ou trocar de aparelho;
      2. a escolha do dia, se o plano ainda tiver aquele treino;
      3. o índice do ciclo.
    Antes só existiam 2 e 3, e o 2 era `useState`: recarregar no meio do treino
    voltava para o treino do ciclo e os vistos sumiam da vista.
  */
  const idxAtual = sessaoAberta && sessaoAberta.treinoIdx < totalDias
    ? sessaoAberta.treinoIdx
    : podeEscolher && escolhaHoje !== null && escolhaHoje < totalDias
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
  /*
    Mantém `seriesFeitas` da sessão em dia.

    O número não é enfeite: é dele que sai "esta sessão conta como dia
    treinado" para a Evolução, para a Home e para o personal. Um efeito, e não
    uma escrita dentro de `marcarSerie`, porque desmarcar série também precisa
    baixar a contagem — e um efeito que compara antes de gravar converge
    sozinho nos dois sentidos.
  */
  useEffect(() => {
    if (!sessaoAberta) return
    if (sessaoAberta.seriesFeitas === seriesFeitasHoje && sessaoAberta.seriesTotal === seriesDoDia) return
    update(ref(db, 'sessoes/' + user.uid + '/' + sessaoAberta.id), {
      seriesFeitas: seriesFeitasHoje,
      seriesTotal: seriesDoDia
    }).catch(err => console.warn('Progresso da sessão não salvo:', err?.code || err))
  }, [sessaoAberta, seriesFeitasHoje, seriesDoDia, user.uid])

  const estadosCiclo = useMemo(
    () => estadosDoCiclo(sessoes, totalDias, { idxDeHoje: idxAtual }),
    [sessoes, totalDias, idxAtual]
  )

  /* O título do botão diz o estado por extenso: a cor sozinha não informa
     quem não a distingue, e o leitor de tela não lê classe de CSS. */
  function rotuloLetra(dia, estado, sessao) {
    const nome = dia?.nome || ''
    if (estado === 'feito') return nome + ' — concluído nesta volta'
    if (estado === 'meio') {
      return nome + ` — parado em ${sessao?.seriesFeitas || 0} de ${sessao?.seriesTotal || 0} séries`
    }
    return podeEscolher ? 'Treinar ' + nome : 'Ver ' + nome
  }

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
  /*
    O que a tela promete como próximo precisa ser o que o ciclo vai gravar de
    verdade. Era `idxAtual + 1`, mas uma sessão fraca não avança o ciclo — a
    tela dizia "o próximo será o B" e no dia seguinte o treino continuava o A.
    `proximoIndice` já considera a sessão de agora como se fechasse neste
    instante, com as séries que tem até aqui.
  */
  const proximoDoCiclo = useMemo(() => {
    if (!ciclico) return null
    const comoFicaria = sessaoAberta
      ? { ...sessoes, [sessaoAberta.id]: { ...sessaoAberta, seriesFeitas: seriesFeitasHoje, seriesTotal: seriesDoDia } }
      : sessoes
    return plano.lista[proximoIndice(comoFicaria, totalDias, idxCiclo)]?.nome || null
  }, [ciclico, sessoes, sessaoAberta, seriesFeitasHoje, seriesDoDia, plano, totalDias, idxCiclo])

  /** Registra uma série. Devolve mensagem de erro ou null. */
  /*
    Registra a série. Carga menor que a do plano é PERMITIDA e fica marcada com
    o motivo — antes era recusada, e recusar só ensinava a mentir no número ou a
    não marcar a série. Com o motivo gravado, o personal vê o que aconteceu.

    `cargaNumero` e não `Number`: a carga é texto livre, e Number("45Kg") é NaN —
    era por isso que a trava antiga nem disparava quando o personal escrevia o Kg.
  */
  /*
    Registra a série SEM esperar o servidor.

    Antes isto era `await push(...)`, que só resolve quando o Firebase confirma.
    Na academia sem sinal a tela ficava parada no toque, e a pessoa tocava de
    novo achando que não pegou. Agora a escrita é local primeiro: o Firebase
    aplica no cache, o `onValue` de `execucoes` dispara na hora com o registro
    novo, e a fila sobe sozinha quando o sinal voltar — enquanto a página
    estiver aberta.

    A chave vem de `push(ref)` sem valor, que a gera no cliente. NÃO é uma chave
    determinística por dia+exercício+série: o mesmo exercício pode aparecer duas
    vezes no mesmo dia (treino A e B), e nome de exercício aceita caracteres que
    o Firebase proíbe em chave (`.`, `#`, `$`, `[`, `]`, `/`). As duas coisas
    sobrescreveriam registro legítimo. Ver o relato no CLAUDE.md.
  */
  /*
    Devolve o id da sessão em andamento, abrindo uma se não houver.

    A chave vem de `push(ref)` sem valor, que o Firebase gera no cliente — a
    sessão nasce mesmo sem sinal, e a escrita sobe depois. Sem isso, começar um
    treino na academia sem rede não registraria nada.

    `sessaoCriada` segura o id entre a criação e o eco do banco: duas séries
    marcadas em sequência abririam duas sessões para o mesmo treino.
  */
  function garantirSessao() {
    if (sessaoAberta) return sessaoAberta.id
    if (sessaoCriada.current) return sessaoCriada.current

    const destino = push(ref(db, 'sessoes/' + user.uid))
    const nova = novaSessao({
      id: destino.key,
      treinoIdx: idxAtual,
      treinoNome: nomeTreinoHoje,
      seriesTotal: seriesDoDia
    })
    sessaoCriada.current = destino.key
    set(destino, paraBanco(nova)).catch(err => {
      console.warn('Sessão não criada:', err?.code || err)
      sessaoCriada.current = null
    })
    return destino.key
  }

  /** Começa o treino selecionado. Só isto cria sessão — escolher não grava nada. */
  function comecarTreino() {
    garantirSessao()
    setExecutando(true)
  }

  function marcarSerie(ex, serie, pesoDigitado, cargaLinha, motivo = '', repsDigitadas) {
    const chave = chaveSerie(ex.nome, serie)
    // Duas barreiras: o que já está no banco e o que está em voo. O estado de
    // `feitas` só chega no próximo render, e dois toques rápidos passariam juntos.
    if (feitas[chave] || emVoo.current.has(chave)) return null

    const alvo = cargaNumero(cargaLinha) || 0
    const peso = pesoDigitado !== undefined && pesoDigitado !== '' ? Number(pesoDigitado) : alvo
    const abaixo = alvo > 0 && peso > 0 && peso < alvo

    /*
      Repetições. Campo em branco quer dizer "fiz o que foi pedido", não "não
      sei" — mesma regra da carga, que já cai no valor do plano quando ninguém
      digita. Quem fez diferente digita; quem cumpriu não toca em nada no meio
      da série.

      Prescrição sem número ("até a falha") não vira alvo: `repsParaGravar`
      devolve null e nada é gravado. Chutar um número ali seria inventar dado.
    */
    const textoReps = ex.linhas?.[serie - 1]?.reps
    const reps = repsParaGravar(repsDigitadas, textoReps)
    const repsAbaixo = reps !== null && abaixoDoAlvo(reps, textoReps)

    emVoo.current.add(chave)
    // Marcar a primeira série sem ter tocado em "Começar" também abre a sessão:
    // quem usa a lista inline nunca passa pelo botão.
    const sessaoId = garantirSessao()
    const destino = push(ref(db, 'execucoes/' + user.uid))

    set(destino, {
      exercicio: ex.nome,
      serie,
      peso: peso || '',
      ts: Date.now(),
      // Campos novos e opcionais: execução antiga sem eles continua válida.
      sessaoId,
      treinoIdx: idxAtual,
      // Só grava quando há número: ausência continua querendo dizer "sem dado".
      ...(reps !== null ? { reps } : {}),
      /* O alvo vai junto quando ficou abaixo. O plano pode mudar depois, e o
         personal precisa ver o que estava combinado NAQUELE dia. */
      ...(repsAbaixo ? { repsAlvo: String(textoReps) } : {}),
      ...(abaixo ? { alvo, motivo: motivo || 'não informado' } : {})
    })
      .catch(err => {
        /*
          Offline NÃO cai aqui — fica na fila do Firebase. Chegar neste catch
          quer dizer que o servidor recusou de verdade, e aí o visto que já
          apareceu some sozinho quando o Firebase desfaz a escrita local.

          A mensagem distingue os dois casos porque o conselho é oposto: regra
          recusando não melhora tentando de novo, e mandar o aluno repetir o
          toque só faz ele gravar duplicado quando a regra voltar.
        */
        const codigo = String(err?.code || err)
        console.warn('Série não gravada:', codigo, err)
        emVoo.current.delete(chave)
        setErroInline(e => ({
          ...e,
          [ex.nome]: codigo.toUpperCase().includes('PERMISSION_DENIED')
            ? 'O servidor recusou este registro. É configuração do app, não erro seu — avise quem cuida do CoachApp.'
            : 'Não foi possível registrar. Tente de novo.'
        }))
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

    const msg = marcarSerie(ex, serie, digitado ?? '', linha.carga, motivo, repsInline[chave])
    setErroInline(e => ({ ...e, [ex.nome]: msg || '' }))
    if (msg) return

    setReducao(null)
    setPesoInline(p => ({ ...p, [chave]: '' }))
    setRepsInline(r => ({ ...r, [chave]: '' }))

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
  /*
    Marca a dose direto do aviso flutuante, sem sair da tela onde a pessoa está.
    Usa a mesma transação da tela de suplementação — dois avisos abertos, ou um
    toque repetido, não viram dois registros.
  */
  async function marcarSuplemento(sup) {
    try {
      await registrarDose({
        alunoId: user.uid, supId: sup.id, estado: TOMADO, vezesAoDia: sup.vezesAoDia
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
  /*
    Fecha a sessão e empurra o ciclo.

    O índice sai de `proximoIndice`, que olha a última sessão que REALMENTE
    contou — não "o índice gravado + 1". Quem fecha o app sem tocar em nada
    deixa de ficar preso no mesmo treino para sempre, e quem começou e desistiu
    não avança por ter tentado.
  */
  async function fecharSessao({ encerradaPor = 'aluno' } = {}) {
    const alvo = sessaoAberta
    if (!alvo) return null

    const ultima = Object.values(execucoes)
      .filter(e => e?.sessaoId === alvo.id)
      .reduce((m, e) => Math.max(m, e.ts || 0), 0)

    const campos = fechamento(alvo, {
      seriesFeitas: seriesFeitasHoje,
      fimEm: ultima || Date.now(),
      encerradaPor
    })
    const fechada = { ...alvo, ...campos }

    await update(ref(db, 'sessoes/' + user.uid + '/' + alvo.id), campos)
    if (ciclico) {
      // Passa a sessão já fechada: `sessoes` ainda não recebeu o eco.
      const idx = proximoIndice({ ...sessoes, [alvo.id]: fechada }, totalDias, idxCiclo)
      await update(ref(db, 'treinos/' + user.uid), { indiceAtual: idx })
    }
    return fechada
  }

  /** "Terminei por hoje": confirma na tela, nunca com o `confirm()` do navegador. */
  async function encerrarPorHoje() {
    const proximo = ciclico ? plano.lista[(idxAtual + 1) % totalDias]?.nome : null
    setConfirmarFim(null)
    try {
      await push(ref(db, 'feedbacks/' + user.uid), {
        tipo: 'sessao',
        treino: nomeTreinoHoje,
        feitas: seriesFeitasHoje,
        total: seriesDoDia,
        ts: Date.now()
      })
      await fecharSessao({ encerradaPor: 'aluno' })
      setEncerrado({ treino: nomeTreinoHoje, feitas: seriesFeitasHoje, total: seriesDoDia, proximo })
      setEscolhaHoje(null)
    } catch (err) {
      console.warn('Falha ao encerrar o treino:', err)
    }
  }

  async function concluirTreino() {
    await fecharSessao({ encerradaPor: 'aluno' })
    setEscolhaHoje(null)
    setExecutando(false)
  }

  /*
    Trocar de treino com sessão aberta: fecha a atual como está e abre a outra.
    A confirmação acontece na tela, com o número de séries à vista — trocar sem
    saber que está descartando 12 de 41 seria uma perda silenciosa.
  */
  async function trocarTreino(novoIdx) {
    setTrocaPedida(null)
    try {
      await fecharSessao({ encerradaPor: 'aluno' })
      setEscolhaHoje(novoIdx)
      /*
        Abre a sessão nova na hora. Quem troca de treino no meio do treino não
        está escolhendo para depois — está trocando AGORA, e o botão deve dizer
        "Continuar", não "Começar". `sessaoCriada` fica nulo porque a sessão que
        acabou de fechar não está mais em andamento.
      */
      sessaoCriada.current = null
      const destino = push(ref(db, 'sessoes/' + user.uid))
      const nova = novaSessao({
        id: destino.key,
        treinoIdx: novoIdx,
        treinoNome: plano.lista[novoIdx]?.nome || '',
        seriesTotal: totalSeries(plano.lista[novoIdx]?.exercicios || [])
      })
      sessaoCriada.current = destino.key
      await set(destino, paraBanco(nova))
    } catch (err) {
      console.warn('Falha ao trocar de treino:', err)
    }
  }

  /** Tocar numa letra: escolhe direto, ou pede confirmação se há treino aberto. */
  function escolherTreino(i) {
    if (!podeEscolher) { setVerTreino(i); return }
    if (i === idxAtual) return
    if (sessaoAberta && seriesFeitasHoje > 0) { setTrocaPedida(i); return }
    if (sessaoAberta) { trocarTreino(i); return }
    setEscolhaHoje(i)
  }

  /* Abre a confirmação já com a data de hoje preenchida — é o caso quase sempre. */
  function abrirInformar(cob) {
    setPagCobId(cob.id)
    setPagData(hojeISO())
    setPagObs('')
    setPagArquivo(null)
    setPagErro('')
    setPagOk(null)
  }

  function fecharInformar() {
    setPagCobId(null); setPagObs(''); setPagArquivo(null)
    setPagErro(''); setPagOk(null); setPagEnviando(false)
  }

  /*
    Traduz a falha para uma frase que o aluno resolve sozinho. O detalhe técnico
    fica no console — na tela ele não ajuda ninguém.
  */
  function mensagemErro(err) {
    const texto = String(err?.code || err?.message || err)
    if (texto.toUpperCase().includes('PERMISSION_DENIED')) {
      return 'Este pagamento já foi informado. Puxe a tela para baixo para ver o status atualizado.'
    }
    return 'Não foi possível informar o pagamento. Verifique sua conexão e tente novamente.'
  }

  /*
    "Já paguei": o aluno avisa que fez o PIX fora do app. Não movimenta dinheiro,
    só muda o status para `em_analise` e chama o personal para conferir o extrato.

    A trava contra duplicidade tem duas camadas. Aqui, `pagEnviando` barra o duplo
    toque. No banco, a regra de `cobrancas` só aceita a transição partindo de
    `pendente` ou `recusado` — então duas requisições simultâneas não viram dois
    registros: a segunda é recusada pelo servidor.
  */
  async function registrarPagamento(e) {
    e.preventDefault()
    if (pagEnviando) return

    const cob = fin.lista.find(c => c.id === pagCobId)
    if (!cob) return
    if (!ehAberta(cob)) {
      setPagErro('Este pagamento já foi informado.')
      return
    }

    setPagEnviando(true)
    setPagErro('')
    try {
      /*
        O comprovante é opcional e vai para o Storage, não para o banco: o nó de
        cobranças é lido inteiro toda vez que a tela abre — do aluno e do personal,
        que carrega o de todos os alunos. Uma imagem em base64 ali dentro pesaria
        em cada carregamento.
      */
      let comprovante = ''
      if (pagArquivo) {
        try {
          comprovante = await enviarFoto(pagArquivo, 'comprovantes/' + user.uid, 1280)
        } catch (err) {
          // Perder o anexo não pode custar o registro do pagamento.
          console.warn('Comprovante não enviado:', err?.code || err)
        }
      }

      const quando = pagData ? new Date(pagData + 'T12:00:00').getTime() : Date.now()
      await update(ref(db, 'cobrancas/' + user.uid + '/' + cob.id), {
        status: 'em_analise',
        // Limpa a recusa anterior: o registro é novo, o motivo antigo não vale mais.
        motivoRecusa: null,
        pagamento: {
          data: quando,
          obs: pagObs.trim(),
          ...(comprovante ? { comprovante } : {})
        }
      })

      await notificar(
        perfil.personalId,
        perfil.nome + ' informou o pagamento de ' + fmtMoeda(cob.valor) + ' (' + tituloCobranca(cob) + '). Confirme no Financeiro.',
        '/personal'
      )
      setPagOk({ valor: cob.valor, quando, titulo: tituloCobranca(cob), comprovante: !!comprovante })
    } catch (err) {
      console.error('Falha ao informar pagamento:', err)
      setPagErro(mensagemErro(err))
    } finally {
      setPagEnviando(false)
    }
  }

  /* Copia a chave PIX. Sem clipboard (navegador antigo, http), cai no seletor. */
  async function copiarPix() {
    const chave = personal?.chavePix || ''
    if (!chave) return
    try {
      await navigator.clipboard.writeText(chave)
    } catch {
      const campo = document.createElement('textarea')
      campo.value = chave
      campo.style.position = 'fixed'
      campo.style.opacity = '0'
      document.body.appendChild(campo)
      campo.select()
      try { document.execCommand('copy') } catch { /* sem jeito: a chave está na tela */ }
      document.body.removeChild(campo)
    }
    setPixCopiado(true)
    setTimeout(() => setPixCopiado(false), 2500)
  }

  /*
    Suplementos que ainda faltam hoje. Sem push, o lembrete é este: o app cobra
    assim que a pessoa abre, na tela de treino, em vez de esperar ela lembrar
    de ir até a aba de suplementação.
  */
  const supPendentes = useMemo(() => (
    Object.entries(suplementos)
      .map(([id, s]) => ({ id, ...normalizarSuplemento(s) }))
      // `treinouHoje` é o que faz o suplemento de pós-treino entrar na conta.
      .filter(s => faltaHoje(s, s.id, supTomados, new Date(), seriesFeitasHoje > 0))
  ), [suplementos, supTomados, seriesFeitasHoje])

  /*
    O painel da Home. Tudo aqui já existia na tela — o que faltava era alguém
    olhar o conjunto e decidir o que vem primeiro. Quem decide é lib/painel.js.
  */
  const naoLidas = useMemo(() => (
    Object.values(mensagens).filter(m => m && m.de !== user.uid && !m.lidaEm).length
  ), [mensagens, user.uid])

  const checkinFeito = useMemo(() => {
    const hoje = diaISO(Date.now())
    return Object.values(diario).some(r => r?.ts && diaISO(r.ts) === hoje)
  }, [diario])

  const painel = useMemo(() => montarPainel({
    nome: perfil.nome,
    temPlano: !!plano && totalDias > 0,
    temSuplementos: Object.keys(suplementos).length > 0,
    bloqueado,
    seriesDoDia,
    seriesFeitas: seriesFeitasHoje,
    minutosRestantes,
    nomeTreino: nomeTreinoHoje,
    resumoTreino: seriesDoDia
      ? `${seriesDoDia} ${seriesDoDia === 1 ? 'série' : 'séries'} · cerca de ${minutos} min`
      : 'Sem séries programadas',
    /*
      O que o treino tem. O personal nomeia o dia ("Treino D") e não existe campo
      de grupo muscular — então os exercícios falam por si, em vez de a tela
      adivinhar "Quadríceps e Posteriores" a partir do nome.
    */
    exerciciosDoDia: exerciciosHoje.map(e => e.nome).filter(Boolean),
    proximoTreino: proximoDoCiclo,
    // Plano existe mas o dia da vez não tem exercício: é descanso, não falha.
    ehDescanso: !!plano && totalDias > 0 && seriesDoDia === 0,
    treinoPendente: seriesDoDia > 0 && seriesFeitasHoje === 0,
    cobrancaVencida: fin.vencidas.length > 0,
    cobrancaValor: fin.vencidas.length ? fmtMoeda(fin.totalVencido) : '',
    dosesPendentes: supPendentes.length,
    primeiraDose: supPendentes[0] || null,
    checkinPendente: !checkinFeito,
    mensagensNaoLidas: naoLidas
  }), [
    perfil.nome, plano, totalDias, suplementos, bloqueado, seriesDoDia, seriesFeitasHoje,
    minutosRestantes, minutos, nomeTreinoHoje, proximoDoCiclo, fin, supPendentes,
    checkinFeito, naoLidas
  ])

  /* Números reais do mês, das mesmas funções que a aba Evolução usa. */
  const resumoMes = useMemo(() => {
    if (listaExec.length === 0) return null
    /*
      `treinosNoMes` e `sequencia` já existiam nesta tela, calculados para a aba
      Evolução — a Home reaproveita em vez de recalcular. Só os recordes vêm de
      `lib/evolucao`, e precisam da lista do mais antigo para o mais novo: uma
      carga só é recorde se superar tudo que veio ANTES dela, e `listaExec` está
      ordenada ao contrário.
    */
    const { marcos, melhor } = recordes([...listaExec].sort((a, b) => a.ts - b.ts))
    return {
      treinos: treinosNoMes,
      sequencia,
      recordes: prsNoMes(marcos),
      // Percentual real: dias treinados sobre dias previstos pelo personal.
      // Sem `diasSemana` definido, vira média semanal — e a tela diz qual é.
      frequencia: frequenciaDoMes(diasTreinados, treinoBruto?.diasSemana),
      carga: evolucaoDeCarga(melhor)
    }
  }, [listaExec, treinosNoMes, sequencia, diasTreinados, treinoBruto])

  /* As três últimas novidades — o mesmo nó do sino, resumido na Home. */
  const atualizacoes = useMemo(() => (
    Object.entries(avisos)
      .map(([id, a]) => ({ id, ...a }))
      .sort((a, b) => b.ts - a.ts)
      .slice(0, 3)
  ), [avisos])

  const proximoTreinoBloco = useMemo(() => {
    if (!ciclico || !proximoDoCiclo) return null
    const feito = seriesDoDia > 0 && seriesFeitasHoje >= seriesDoDia
    return { nome: proximoDoCiclo, quando: feito ? 'Depois deste' : 'Na sequência' }
  }, [ciclico, proximoDoCiclo, seriesDoDia, seriesFeitasHoje])

  /* Um lugar só para trocar de aba — a Home, o menu e o teclado usam o mesmo. */
  const irPara = useCallback(a => {
    setAba(a)
    setRever(false)
    if (params.has('sup') || params.has('aba')) setParams({}, { replace: true })
  }, [params, setParams])

  /*
    Atalhos de teclado, só no desktop e só para NAVEGAR — nenhum registra dose,
    conclui série ou envia nada. Um número digitado por engano no máximo troca de
    aba, e isso se desfaz com outro número.

    Ignora quando o foco está num campo de texto: senão digitar "2" no chat
    jogaria a pessoa para o treino no meio da frase.
  */
  useEffect(() => {
    function aoTeclar(e) {
      if (e.ctrlKey || e.metaKey || e.altKey) return
      const alvo = e.target
      const digitando = alvo && (
        alvo.tagName === 'INPUT' || alvo.tagName === 'TEXTAREA' ||
        alvo.tagName === 'SELECT' || alvo.isContentEditable
      )
      if (digitando) return
      const ordem = ['inicio', 'treino', 'evolucao', 'diario', 'suplementos', 'pagamentos', 'chat']
      const i = Number(e.key) - 1
      if (Number.isInteger(i) && i >= 0 && i < ordem.length) irPara(ordem[i])
    }
    window.addEventListener('keydown', aoTeclar)
    return () => window.removeEventListener('keydown', aoTeclar)
  }, [irPara])

  const itens = [
    { id: 'inicio', label: 'Início', icone: <IcInicio /> },
    { id: 'treino', label: 'Treino', icone: <IcTreino /> },
    { id: 'evolucao', label: 'Evolução', icone: <IcEvolucao /> },
    { id: 'diario', label: 'Check-in', icone: <IcCalendario /> },
    { id: 'suplementos', label: 'Suplementação', icone: <IcSuplemento />, badge: supPendentes.length },
    { id: 'pagamentos', label: 'Pagamentos', icone: <IcPagamentos />, badge: fin.vencidas.length },
    { id: 'chat', label: 'Chat', icone: <IcChat /> },
    { id: 'config', label: 'Configurações', icone: <IcConfig /> }
  ]


  const meta = TITULOS[aba] || TITULOS.inicio

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
      abaAtiva={aba}
      onAba={irPara}
      roleLabel="Aluno" titulo={meta.t} subtitulo={meta.s}
      onAjuda={tourDaAba ? () => setRever(true) : undefined}
    >
      {/*
        Offline não é erro: o que a pessoa marcou já está salvo no aparelho e
        sobe sozinho. A faixa existe para ela não tocar duas vezes achando que
        não pegou — que era o que acontecia quando a tela travava no toque.
      */}
      {!conectado && (
        <div className="aviso-offline" role="status">
          <IcNuvemOff />
          <span>Sem conexão. O que você marcar fica salvo no aparelho e sobe quando o sinal voltar.</span>
        </div>
      )}

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
      {/*
        O aviso flutuante não aparece no Início: a Home já lista a dose pendente
        com botão próprio, e o balão por cima seria o mesmo pedido duas vezes na
        mesma tela — ainda por cima tapando o bloco de baixo.
      */}
      {supPendentes.length > 0 && aba !== 'suplementos' && aba !== 'inicio' && !supDispensado && (() => {
        const sup = supPendentes[0]
        const feitas = registroDoDia(supTomados, sup.id, diaSup(), sup.vezesAoDia)?.vezes || 0
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

      {/* ===== INÍCIO ===== */}
      {aba === 'inicio' && (
        <Inicio
          painel={painel}
          resumo={resumoMes}
          proximo={proximoTreinoBloco}
          atualizacoes={atualizacoes}
          carregando={!perfil}
          onIr={irPara}
        />
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
                        /*
                          Cada letra mostra o que ACONTECEU, não onde o ciclo
                          está. A versão anterior pintava de verde toda letra
                          anterior ao índice — um treino que a pessoa nunca fez
                          aparecia como feito só por estar atrás na fila.
                        */
                        <div className={'tr-ciclo' + (podeEscolher ? ' escolhivel' : '')}>
                          {estadosCiclo.map(({ indice, estado, agora, sessao }) => (
                            <button
                              key={indice}
                              type="button"
                              className={'tr-passo ' + estado + (agora ? ' agora' : '')}
                              onClick={() => escolherTreino(indice)}
                              title={rotuloLetra(plano.lista[indice], estado, sessao)}
                              aria-pressed={podeEscolher ? agora : undefined}
                            >
                              {LETRAS[indice] || indice + 1}
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
                        {/* Sem sessão aberta o botão principal começa uma; com
                            sessão, ele continua de onde a pessoa parou — inclusive
                            depois de fechar o app ou trocar de aparelho. */}
                        <button className="btn btn-lg tr-acao" onClick={comecarTreino}>
                          <IcPlay />
                          {/* A letra, não o nome inteiro: "Continuar Treino A —
                              Superiores · 2 de 19 séries" quebra em duas linhas
                              no celular, e o nome já está no título acima. */}
                          {sessaoAberta
                            ? `Continuar treino ${LETRAS[idxAtual] || idxAtual + 1} · ${seriesFeitasHoje} de ${seriesDoDia} séries`
                            : ciclico
                              ? `Começar treino ${LETRAS[idxAtual] || idxAtual + 1}`
                              : 'Começar treino'}
                        </button>

                        {seriesFeitasHoje > 0 && (
                          <button
                            className="btn btn-sec tr-acao"
                            onClick={() => setConfirmarFim(true)}
                          >
                            Terminei por hoje
                          </button>
                        )}
                      </>
                    )}

                    {/* Confirmação de encerrar, na própria tela. */}
                    {confirmarFim && (
                      <div className="tr-confirma" role="alertdialog" aria-label="Encerrar o treino">
                        <strong>Encerrar o {nomeTreinoHoje}?</strong>
                        <span>
                          Você fez {seriesFeitasHoje} de {seriesDoDia} séries.
                          {ciclico && proximoDoCiclo ? ` O próximo será o ${proximoDoCiclo}.` : ''}
                        </span>
                        <div className="tr-confirma-acoes">
                          <button className="btn btn-ghost btn-sm" onClick={() => setConfirmarFim(null)}>
                            Continuar treinando
                          </button>
                          <button className="btn btn-sm" onClick={encerrarPorHoje}>
                            Encerrar
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Confirmação de troca, com o que está sendo deixado para trás. */}
                    {trocaPedida !== null && (
                      <div className="tr-confirma" role="alertdialog" aria-label="Trocar de treino">
                        <strong>
                          Encerrar o {nomeTreinoHoje} com {seriesFeitasHoje} de {seriesDoDia} séries
                          e começar o {plano.lista[trocaPedida]?.nome}?
                        </strong>
                        <span>O que você já marcou fica salvo no treino de agora.</span>
                        <div className="tr-confirma-acoes">
                          <button className="btn btn-ghost btn-sm" onClick={() => setTrocaPedida(null)}>
                            Ficar no {LETRAS[idxAtual] || idxAtual + 1}
                          </button>
                          <button className="btn btn-sm" onClick={() => trocarTreino(trocaPedida)}>
                            Trocar
                          </button>
                        </div>
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
                          // Primeira série pendente: é a linha que ganha o campo e o botão.
                          const proximaSerie = ex.linhas.findIndex((_, li) => !feitas[chaveSerie(ex.nome, li + 1)]) + 1
                          const temDescanso = ex.linhas.some(l => Number(l.descanso) > 0)
                          // Coluna "Anterior" só entra quando existe histórico — senão é uma coluna de traços.
                          const temAnterior = ex.linhas.some((_, li) => cargaAnterior(ex.nome, li + 1) || repsAnterior(ex.nome, li + 1))
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
                                            {/*
                                              Reps: na linha da vez vira campo, com o
                                              número do personal como sugestão em cinza.
                                              Deixar em branco quer dizer "fiz o que foi
                                              pedido" — só digita quem fez diferente.
                                              O alvo fica embaixo para não sumir de vista
                                              quando a pessoa digita por cima.
                                            */}
                                            <td className="ts-reps">
                                              {feita
                                                ? <strong>{reg.reps ? reg.reps : (linha.reps || '—')}</strong>
                                                : daVez
                                                  ? (() => {
                                                      const alvoReps = repsAlvo(linha.reps)
                                                      return (
                                                        <>
                                                          <input
                                                            type="number" inputMode="numeric"
                                                            className="ts-input ts-input-reps"
                                                            value={repsInline[chave] ?? ''}
                                                            onChange={e => setRepsInline(r => ({ ...r, [chave]: e.target.value }))}
                                                            placeholder={alvoReps ? String(alvoReps.sugerido) : '—'}
                                                            aria-label={`Repetições da série ${s}${alvoReps ? `, pedido ${linha.reps}` : ''}`}
                                                          />
                                                          {linha.reps && (!alvoReps || alvoReps.min !== alvoReps.max) && (
                                                            <span className="ts-alvo-reps">{linha.reps}</span>
                                                          )}
                                                        </>
                                                      )
                                                    })()
                                                  : (linha.reps || '—')}
                                            </td>
                                            {temAnterior && (
                                              <td className="ts-antes">
                                                {(() => {
                                                  const kg = cargaAnterior(ex.nome, s)
                                                  const rp = repsAnterior(ex.nome, s)
                                                  if (!kg && !rp) return '—'
                                                  // "8 × 85 kg" é a comparação que a pessoa quer no meio da série.
                                                  if (rp && kg) return `${rp} × ${comKg(kg)}`
                                                  return rp ? `${rp} reps` : comKg(kg)
                                                })()}
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
          <Evolucao
            execucoes={execucoes}
            sessoes={sessoes}
            avaliacoes={avalVisiveis}
            diasSemana={treinoBruto?.diasSemana}
          />

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
        <div className="pag">
          {/*
            A ordem responde às perguntas do aluno na ordem em que ele as faz:
            quanto devo, como pago, o que vem depois, o que já paguei.
          */}
          <SituacaoPagamento fin={fin} onInformar={abrirInformar} />

          {(fin.abertas.length > 0 || fin.emAnalise.length > 0) && personal?.chavePix && (
            <section className="pag-pix">
              <h2>Pagamento via PIX</h2>
              <div className="pag-chave">{personal.chavePix}</div>
              <button className="btn btn-sec pag-copiar" onClick={copiarPix}>
                {pixCopiado ? 'Chave PIX copiada' : 'Copiar chave PIX'}
              </button>
              <p className="pag-passo">
                Pague pelo aplicativo do seu banco. Depois volte aqui e toque em
                <strong> Já paguei</strong> para avisar o personal.
              </p>
            </section>
          )}

          {/* Os outros atrasos. O primeiro já está no cartão de cima. */}
          {fin.outras.length > 0 && (
            <section className="pag-bloco">
              <h2>Outras cobranças em aberto</h2>
              {fin.outras.map(c => (
                <LinhaCobranca key={c.id} cob={c} podeInformar onInformar={abrirInformar} />
              ))}
            </section>
          )}

          {/* Futuras: informativas. Botão aqui só confundiria. */}
          {fin.futuras.length > 0 && (
            <section className="pag-bloco">
              <h2>Próximas mensalidades</h2>
              <p className="pag-nota">Ainda não é hora de pagar. Estão aqui para você se programar.</p>
              {fin.futuras.map(c => (
                <div key={c.id} className="pag-futura">
                  <span>{referencia(c) || dataBR(c.vencimento)}</span>
                  <span className="pag-futura-valor">{fmtMoeda(c.valor)}</span>
                </div>
              ))}
            </section>
          )}

          <section className="pag-bloco">
            <h2>Histórico</h2>

            <div className="barra-filtros">
              <button
                className={'filtro-chip ' + (histStatus === 'pago' ? 'ativo' : '')}
                onClick={() => setHistStatus('pago')}
              >
                Pagos
              </button>
              <button
                className={'filtro-chip ' + (histStatus === 'todos' ? 'ativo' : '')}
                onClick={() => setHistStatus('todos')}
              >
                Todas
              </button>
            </div>

            {anosHist.length > 1 && (
              <div className="barra-filtros">
                <button
                  className={'filtro-chip ' + (histAno === 'todos' ? 'ativo' : '')}
                  onClick={() => setHistAno('todos')}
                >
                  Todo o período
                </button>
                {anosHist.map(a => (
                  <button
                    key={a}
                    className={'filtro-chip ' + (histAno === a ? 'ativo' : '')}
                    onClick={() => setHistAno(a)}
                  >
                    {a}
                  </button>
                ))}
              </div>
            )}

            {extrato.length === 0
              ? (
                <p className="muted">
                  {histStatus === 'pago'
                    ? 'Nenhum pagamento confirmado neste período.'
                    : 'Nenhuma cobrança neste período.'}
                </p>
              )
              : extrato.map(c => <LinhaCobranca key={c.id} cob={c} podeInformar={false} />)}
          </section>
        </div>
      )}

      {/* Confirmação do "Já paguei". Modal de propósito: antes era um formulário
          no fim da página, e quem tocava no botão não via nada acontecer. */}
      {pagCobId && (() => {
        const cob = fin.lista.find(c => c.id === pagCobId)
        if (!cob) return null
        return (
          <div className="pag-modal-fundo" onClick={() => !pagEnviando && fecharInformar()}>
            <div className="pag-modal" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">
              {pagOk ? (
                <>
                  <div className="pag-ok-marca" aria-hidden="true" />
                  <h2>Pagamento informado</h2>
                  <p className="pag-modal-sub">
                    Seu personal foi avisado e vai confirmar assim que conferir o extrato.
                  </p>
                  <dl className="pag-resumo">
                    <div><dt>Valor</dt><dd>{fmtMoeda(pagOk.valor)}</dd></div>
                    <div><dt>Referente a</dt><dd>{pagOk.titulo}</dd></div>
                    <div><dt>Data informada</dt><dd>{fmtData(pagOk.quando)}</dd></div>
                    <div><dt>Status</dt><dd>Aguardando confirmação</dd></div>
                  </dl>
                  <button className="btn" onClick={fecharInformar}>Fechar</button>
                </>
              ) : (
                <>
                  <h2>Informar pagamento</h2>
                  <p className="pag-modal-sub">
                    Você está avisando que já fez o PIX desta cobrança. O personal confirma depois.
                  </p>

                  <dl className="pag-resumo">
                    <div><dt>Valor</dt><dd>{fmtMoeda(cob.valor)}</dd></div>
                    <div><dt>Referente a</dt><dd>{tituloCobranca(cob)}</dd></div>
                    <div><dt>Vencimento</dt><dd>{dataBR(cob.vencimento)}</dd></div>
                  </dl>

                  <form onSubmit={registrarPagamento}>
                    <label htmlFor="pag-data">Data do pagamento</label>
                    <input
                      id="pag-data" type="date" value={pagData} max={hojeISO()}
                      onChange={e => setPagData(e.target.value)} disabled={pagEnviando}
                    />

                    <label htmlFor="pag-obs">Observação <span className="pag-opcional">(opcional)</span></label>
                    <input
                      id="pag-obs" value={pagObs} onChange={e => setPagObs(e.target.value)}
                      maxLength={300} disabled={pagEnviando}
                      placeholder='Ex: "PIX às 14h em nome de João"'
                    />

                    <label htmlFor="pag-comp">Comprovante <span className="pag-opcional">(opcional)</span></label>
                    {/* O seletor nativo mostra "Choose File" em inglês; o rótulo é nosso. */}
                    <label className={'pag-arquivo' + (pagArquivo ? ' escolhido' : '')}>
                      <input
                        id="pag-comp" type="file" accept="image/*" disabled={pagEnviando}
                        onChange={e => setPagArquivo(e.target.files?.[0] || null)}
                      />
                      <span>{pagArquivo ? pagArquivo.name : 'Escolher imagem do comprovante'}</span>
                    </label>

                    {pagErro && (
                      <div className="pag-erro" role="alert">
                        <span>{pagErro}</span>
                      </div>
                    )}

                    <div className="pag-modal-acoes">
                      <button className="btn" disabled={pagEnviando}>
                        {pagEnviando ? 'Registrando...' : (pagErro ? 'Tentar novamente' : 'Confirmar pagamento')}
                      </button>
                      <button
                        type="button" className="btn btn-sec btn-auto"
                        onClick={fecharInformar} disabled={pagEnviando}
                      >
                        Cancelar
                      </button>
                    </div>
                  </form>
                </>
              )}
            </div>
          </div>
        )
      })()}

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
        <Suplementacao alunoId={user.uid} podeMarcar quemSou="proprio" 
          destacar={supDestaque}
        />
      )}

      {aba === 'config' && <Config user={user} perfil={perfil} />}
    </Layout>
  )
}
