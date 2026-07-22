import { Fragment, useEffect, useRef, useState } from 'react'
import { ref, onValue, push, update } from 'firebase/database'
import { db } from '../../firebase'
import { fmtData, fmtMoeda, vencida, youtubeId, beep } from '../../lib/util'
import { notificar } from '../../lib/notify'
import Chat from '../../components/Chat.jsx'
import Config from '../Config.jsx'
import LineChart from '../../components/LineChart.jsx'
import Heatmap from '../../components/Heatmap.jsx'
import Layout from '../../components/Layout.jsx'
import { IcTreino, IcEvolucao, IcPagamentos, IcChat, IcConfig } from '../../components/Icones.jsx'

const LETRAS = ['A', 'B', 'C', 'D', 'E', 'F']

const TITULOS = {
  treino: { t: 'Meu Treino', s: 'Marque cada série ao concluir' },
  evolucao: { t: 'Evolução', s: 'Acompanhe seu progresso' },
  pagamentos: { t: 'Pagamentos', s: 'Suas cobranças' },
  chat: { t: 'Chat', s: 'Fale com seu personal' },
  config: { t: 'Configurações', s: 'Sua conta e preferências' }
}

export default function AlunoHome({ user, perfil, onSair }) {
  const [aba, setAba] = useState('treino')
  const [treino, setTreino] = useState(null)
  const [feitas, setFeitas] = useState({})
  const [pesos, setPesos] = useState({})
  const [cobrancas, setCobrancas] = useState({})
  const [execucoes, setExecucoes] = useState({})
  const [avaliacoes, setAvaliacoes] = useState({})
  const [historico, setHistorico] = useState({})
  const [personal, setPersonal] = useState(null)
  const [videoAberto, setVideoAberto] = useState(null)
  const [erroPeso, setErroPeso] = useState('')
  const [descanso, setDescanso] = useState(null) // {chave, restante}
  const timerRef = useRef(null)
  const [pagObs, setPagObs] = useState('')
  const [pagCobId, setPagCobId] = useState(null)
  const [medidaGrafico, setMedidaGrafico] = useState('peso')

  useEffect(() => {
    const u1 = onValue(ref(db, 'treinos/' + user.uid), s => setTreino(s.exists() ? s.val() : null))
    const u2 = onValue(ref(db, 'cobrancas/' + user.uid), s => setCobrancas(s.val() || {}))
    const u3 = onValue(ref(db, 'execucoes/' + user.uid), s => setExecucoes(s.val() || {}))
    const u4 = onValue(ref(db, 'avaliacoes/' + user.uid), s => setAvaliacoes(s.val() || {}))
    const u5 = onValue(ref(db, 'treinosHistorico/' + user.uid), s => setHistorico(s.val() || {}))
    const u6 = onValue(ref(db, 'users/' + perfil.personalId), s => setPersonal(s.val()))
    return () => { u1(); u2(); u3(); u4(); u5(); u6() }
  }, [user.uid, perfil.personalId])

  // séries feitas hoje
  useEffect(() => {
    const hoje = new Date().toDateString()
    const f = {}
    Object.values(execucoes).forEach(e => {
      if (new Date(e.ts).toDateString() === hoje) f[e.exercicio + '_' + e.serie] = true
    })
    setFeitas(f)
  }, [execucoes])

  // cronômetro de descanso
  useEffect(() => {
    if (!descanso) return
    timerRef.current = setInterval(() => {
      setDescanso(d => {
        if (!d) return null
        if (d.restante <= 1) {
          clearInterval(timerRef.current)
          beep()
          return null
        }
        return { ...d, restante: d.restante - 1 }
      })
    }, 1000)
    return () => clearInterval(timerRef.current)
  }, [descanso?.chave])

  const listaCob = Object.entries(cobrancas).map(([id, c]) => ({ id, ...c }))
  const vencidas = listaCob.filter(c => vencida(c))
  const bloqueado = vencidas.length > 0
  const pendentes = listaCob.filter(c => c.status === 'pendente').sort((a, b) => a.vencimento.localeCompare(b.vencimento))
  const emAnalise = listaCob.filter(c => c.status === 'em_analise')
  const pagas = listaCob.filter(c => c.status === 'pago').sort((a, b) => (b.validadaEm || 0) - (a.validadaEm || 0))

  const listaExec = Object.values(execucoes).sort((a, b) => b.ts - a.ts)
  const listaAval = Object.entries(avaliacoes).map(([id, a]) => ({ id, ...a })).sort((a, b) => a.ts - b.ts)
  const listaHist = Object.entries(historico).map(([id, t]) => ({ id, ...t })).sort((a, b) => (b.arquivadoEm || 0) - (a.arquivadoEm || 0))

  const diasTreinados = new Set(listaExec.map(e => {
    const d = new Date(e.ts)
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')
  }))

  const pontosMedida = listaAval
    .filter(a => a.medidas && a.medidas[medidaGrafico] !== undefined)
    .map(a => ({ label: fmtData(a.ts).slice(0, 5), valor: Number(a.medidas[medidaGrafico]) }))

  async function marcarSerie(ex, serie) {
    const chave = ex.nome + '_' + serie
    if (feitas[chave]) return
    setErroPeso('')
    const pesoDigitado = pesos[chave]
    const cargaAtual = Number(ex.carga) || 0
    const peso = pesoDigitado !== undefined && pesoDigitado !== '' ? Number(pesoDigitado) : cargaAtual
    if (cargaAtual > 0 && peso < cargaAtual) {
      setErroPeso('O peso não pode ser menor que a carga definida (' + cargaAtual + ' kg). Para reduzir a carga, fale com o seu personal.')
      return
    }
    await push(ref(db, 'execucoes/' + user.uid), {
      exercicio: ex.nome, serie, peso: peso || '', ts: Date.now()
    })
    if (Number(ex.descanso) > 0) {
      setDescanso({ chave, restante: Number(ex.descanso) })
    }
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

  // Treino cíclico (A/B/C) com compatibilidade ao formato antigo (treino único)
  const ciclico = treino && Array.isArray(treino.lista) && treino.lista.length > 0
  const totalDias = ciclico ? treino.lista.length : 0
  const idxAtual = ciclico ? (((Number(treino.indiceAtual) || 0) % totalDias) + totalDias) % totalDias : 0
  const diaAtual = ciclico ? treino.lista[idxAtual] : null
  const exerciciosHoje = ciclico ? (diaAtual?.exercicios || []) : (treino?.exercicios || [])
  const nomeTreinoHoje = ciclico ? (diaAtual?.nome || treino.nome) : (treino?.nome || '')

  async function concluirTreino() {
    if (!ciclico) return
    const prox = (idxAtual + 1) % totalDias
    await update(ref(db, 'treinos/' + user.uid), { indiceAtual: prox })
    setVideoAberto(null)
    setPesos({})
  }

  const itens = [
    { id: 'treino', label: 'Meu Treino', icone: <IcTreino /> },
    { id: 'evolucao', label: 'Evolução', icone: <IcEvolucao /> },
    { id: 'pagamentos', label: 'Pagamentos', icone: <IcPagamentos />, badge: vencidas.length },
    { id: 'chat', label: 'Chat', icone: <IcChat /> },
    { id: 'config', label: 'Configurações', icone: <IcConfig /> }
  ]

  const meta = TITULOS[aba] || TITULOS.treino

  return (
    <Layout
      user={user}
      perfil={perfil}
      onSair={onSair}
      itens={itens}
      abaAtiva={aba}
      onAba={setAba}
      roleLabel="Aluno"
      titulo={meta.t}
      subtitulo={meta.s}
    >
      {descanso && (
        <div className="descanso-flutuante">
          <span>Descanso</span>
          <strong>{Math.floor(descanso.restante / 60)}:{String(descanso.restante % 60).padStart(2, '0')}</strong>
          <button onClick={() => { clearInterval(timerRef.current); setDescanso(null) }}>Pular</button>
        </div>
      )}

      {/* ===== TREINO ===== */}
      {aba === 'treino' && (
        <>
          {bloqueado && (
            <div className="card bloqueio-card">
              <h2>Treino bloqueado</h2>
              <p>Você tem pagamento vencido. Regularize na aba <strong>Pagamentos</strong> e aguarde a validação do seu personal para liberar o treino.</p>
            </div>
          )}

          {!bloqueado && !treino && (
            <div className="card">
              <div className="vazio-estado">
                <div className="ve-icone">🏋️</div>
                <h2>Nenhum treino ainda</h2>
                <p className="muted">Seu personal ainda não montou o seu treino. Fale com ele pelo chat.</p>
              </div>
            </div>
          )}

          {!bloqueado && treino && (
            <>
            {ciclico && (
              <div className="treino-atual-card">
                <div className="ciclo-progresso">
                  {treino.lista.map((d, i) => (
                    <Fragment key={i}>
                      {i > 0 && <span className="ciclo-seta">→</span>}
                      <span className={'ciclo-passo ' + (i === idxAtual ? 'ativo' : '')}>{LETRAS[i] || i + 1}</span>
                    </Fragment>
                  ))}
                </div>
                <h2>{nomeTreinoHoje}</h2>
                <p className="ta-sub">
                  {treino.nome} · Treino {idxAtual + 1} de {totalDias} · ao concluir, o próximo aparece automaticamente
                </p>
              </div>
            )}
            <div className="card">
              {!ciclico && <h2>{nomeTreinoHoje}</h2>}
              <p className="muted" style={{ marginBottom: 12 }}>
                Atualizado em {treino.atualizadoEm ? fmtData(treino.atualizadoEm) : '-'} · marque cada série ao concluir.
              </p>
              {erroPeso && <div className="erro" style={{ marginBottom: 10 }}>{erroPeso}</div>}
              {exerciciosHoje.map((ex, i) => {
                const vid = youtubeId(ex.video)
                return (
                  <div className="exercicio-card" key={i}>
                    <div className="titulo">
                      <span>{ex.nome}</span>
                      <span className="muted">{ex.series}x{ex.reps}{ex.carga ? ' · ' + ex.carga + ' kg' : ''} · descanso {ex.descanso}s</span>
                    </div>
                    {vid && (
                      <div style={{ marginBottom: 8 }}>
                        {videoAberto === i
                          ? <div className="video-wrap">
                              <iframe
                                src={'https://www.youtube.com/embed/' + vid}
                                title={ex.nome}
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                allowFullScreen
                              ></iframe>
                            </div>
                          : <button type="button" className="btn btn-sec btn-sm" onClick={() => setVideoAberto(i)}>Ver execução (vídeo)</button>}
                      </div>
                    )}
                    {Array.from({ length: Number(ex.series) || 0 }, (_, s) => {
                      const serie = s + 1
                      const chave = ex.nome + '_' + serie
                      const feita = feitas[chave]
                      return (
                        <div className="serie-row" key={serie}>
                          <span style={{ width: 64 }}>Série {serie}</span>
                          <input
                            type="number"
                            placeholder={ex.carga ? ex.carga + ' kg' : 'kg'}
                            value={pesos[chave] || ''}
                            onChange={e => setPesos({ ...pesos, [chave]: e.target.value })}
                            disabled={feita}
                          />
                          <button className={'check-btn ' + (feita ? 'done' : '')} onClick={() => marcarSerie(ex, serie)}>
                            {feita ? 'Concluída' : 'Concluir'}
                          </button>
                        </div>
                      )
                    })}
                  </div>
                )
              })}
              {ciclico && (
                <button className="btn" style={{ marginTop: 18 }} onClick={concluirTreino}>
                  ✓ Concluir Treino {LETRAS[idxAtual]} · ir para o próximo
                </button>
              )}
            </div>
            </>
          )}
        </>
      )}

      {/* ===== EVOLUÇÃO ===== */}
      {aba === 'evolucao' && (
        <>
          <div className="card">
            <div className="card-titulo"><h2>Calendário de treinos</h2></div>
            <Heatmap diasTreinados={diasTreinados} />
          </div>
          <div className="card">
            <div className="card-titulo"><h2>Evolução das medidas</h2></div>
            {listaAval.length === 0 && <p className="muted">Seu personal ainda não registrou avaliações físicas.</p>}
            {listaAval.length > 0 && (
              <>
                <label>Medida</label>
                <select value={medidaGrafico} onChange={e => setMedidaGrafico(e.target.value)}>
                  {[...new Set(listaAval.flatMap(a => Object.keys(a.medidas || {})))].map(k =>
                    <option key={k} value={k}>{k}</option>
                  )}
                </select>
                <div style={{ marginTop: 14 }}>
                  <LineChart pontos={pontosMedida} unidade="" />
                </div>
              </>
            )}
          </div>
          <div className="card">
            <div className="card-titulo"><h2>Treinos anteriores</h2></div>
            {listaHist.length === 0 && <p className="muted">Nenhum treino antigo ainda.</p>}
            {listaHist.map(t => (
              <div key={t.id} className="exercicio-card">
                <div className="titulo">
                  <span>{t.nome}</span>
                  <span className="muted">até {t.arquivadoEm ? fmtData(t.arquivadoEm) : '-'}</span>
                </div>
                {(t.exercicios || []).map((ex, i) => (
                  <div key={i} className="serie-row">
                    <span style={{ fontWeight: 600 }}>{ex.nome}</span>
                    <span>{ex.series}x{ex.reps}</span>
                    <span>{ex.carga ? ex.carga + ' kg' : ''}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </>
      )}

      {/* ===== PAGAMENTOS ===== */}
      {aba === 'pagamentos' && (
        <>
          {personal && personal.chavePix && (
            <div className="card">
              <div className="card-titulo"><h2>Chave PIX do personal</h2></div>
              <div className="codigo-box" style={{ fontSize: 16, letterSpacing: 1 }}>{personal.chavePix}</div>
              <p className="muted" style={{ marginTop: 8 }}>Pague pelo seu banco e depois registre o pagamento abaixo.</p>
            </div>
          )}

          <div className="card">
            <div className="card-titulo"><h2>Cobranças em aberto</h2></div>
            {pendentes.length === 0 && emAnalise.length === 0 && <p className="muted">Nenhuma cobrança em aberto.</p>}
            {pendentes.map(c => (
              <div key={c.id} className="cobranca-item">
                <div>
                  <strong>{fmtMoeda(c.valor)}</strong> · {c.tipo}
                  <div className={'muted ' + (vencida(c) ? 'texto-vencido' : '')}>
                    Vence em {c.vencimento.split('-').reverse().join('/')} {vencida(c) ? '· VENCIDA' : ''}
                  </div>
                </div>
                <button className="btn btn-sm" onClick={() => setPagCobId(c.id)}>Registrar pagamento</button>
              </div>
            ))}
            {emAnalise.map(c => (
              <div key={c.id} className="cobranca-item">
                <div>
                  <strong>{fmtMoeda(c.valor)}</strong> · {c.tipo}
                  <div className="muted">Aguardando validação do personal</div>
                </div>
                <span className="selo-analise">Em análise</span>
              </div>
            ))}
          </div>

          {pagCobId && (
            <div className="card destaque-card">
              <div className="card-titulo"><h2>Registrar pagamento</h2></div>
              <form onSubmit={registrarPagamento}>
                <label>Observação (opcional — ex: "PIX feito às 14h em nome de João")</label>
                <input value={pagObs} onChange={e => setPagObs(e.target.value)} placeholder="Detalhe que ajude o personal a identificar" />
                <div style={{ display: 'flex', gap: 10 }}>
                  <button className="btn">Confirmar registro</button>
                  <button type="button" className="btn btn-sec" onClick={() => setPagCobId(null)}>Cancelar</button>
                </div>
              </form>
            </div>
          )}

          <div className="card">
            <div className="card-titulo"><h2>Histórico de pagamentos</h2></div>
            {pagas.length === 0 && <p className="muted">Nenhum pagamento validado ainda.</p>}
            {pagas.map(c => (
              <div key={c.id} className="cobranca-item">
                <div>
                  <strong>{fmtMoeda(c.valor)}</strong> · {c.tipo}
                  <div className="muted">Validado em {c.validadaEm ? fmtData(c.validadaEm) : '-'}</div>
                </div>
                <span className="selo-pago">Pago</span>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ===== CHAT ===== */}
      {aba === 'chat' && (
        <div className="card">
          <div className="card-titulo"><h2>Chat com o personal</h2></div>
          <Chat chatId={perfil.personalId + '_' + user.uid} meuUid={user.uid} outroUid={perfil.personalId} rotaNotif="/personal" />
        </div>
      )}

      {/* ===== CONFIG ===== */}
      {aba === 'config' && <Config user={user} perfil={perfil} />}
    </Layout>
  )
}
