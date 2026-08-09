import { Fragment, useEffect, useMemo, useState } from 'react'
import { ref, onValue, push, update } from 'firebase/database'
import { db } from '../../firebase'
import { fmtData, fmtMoeda, vencida, imagemExercicio } from '../../lib/util'
import { notificar } from '../../lib/notify'
import {
  LETRAS, normalizarPlano, indiceSeguro, duracaoEstimada, totalSeries,
  agruparBlocos, chaveSerie, resumoLinhas
} from '../../lib/treinoModel'
import Chat from '../../components/Chat.jsx'
import Diario from './Diario.jsx'
import Config from '../Config.jsx'
import LineChart from '../../components/LineChart.jsx'
import Heatmap from '../../components/Heatmap.jsx'
import Layout from '../../components/Layout.jsx'
import ExecucaoTreino from '../../components/ExecucaoTreino.jsx'
import {
  IcTreino, IcEvolucao, IcPagamentos, IcChat, IcConfig,
  IcPlay, IcFogo, IcCalendario, IcRelogio, IcCheck, IcHalter, IcAlerta, IcTrofeu
} from '../../components/Icones.jsx'

const TITULOS = {
  treino: { t: 'Meu Treino', s: 'Seu plano de hoje' },
  evolucao: { t: 'Evolução', s: 'Acompanhe seu progresso' },
  diario: { t: 'Meu diário', s: 'Privado — só você vê' },
  pagamentos: { t: 'Pagamentos', s: 'Suas cobranças' },
  chat: { t: 'Chat', s: 'Fale com seu personal' },
  config: { t: 'Configurações', s: 'Sua conta e preferências' }
}

const diaISO = ts => {
  const d = new Date(ts)
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')
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
  const [executando, setExecutando] = useState(false)
  const [pagObs, setPagObs] = useState('')
  const [pagCobId, setPagCobId] = useState(null)
  const [medidaGrafico, setMedidaGrafico] = useState('peso')

  useEffect(() => {
    const u1 = onValue(ref(db, 'treinos/' + user.uid), s => setTreinoBruto(s.exists() ? s.val() : null))
    const u2 = onValue(ref(db, 'cobrancas/' + user.uid), s => setCobrancas(s.val() || {}))
    const u3 = onValue(ref(db, 'execucoes/' + user.uid), s => setExecucoes(s.val() || {}))
    const u4 = onValue(ref(db, 'avaliacoes/' + user.uid), s => setAvaliacoes(s.val() || {}))
    const u5 = onValue(ref(db, 'treinosHistorico/' + user.uid), s => setHistorico(s.val() || {}))
    const u6 = onValue(ref(db, 'users/' + perfil.personalId), s => setPersonal(s.val()))
    return () => { u1(); u2(); u3(); u4(); u5(); u6() }
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

  const ultimoTreinoTs = listaExec[0]?.ts || null

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

  const itens = [
    { id: 'treino', label: 'Meu Treino', icone: <IcTreino /> },
    { id: 'evolucao', label: 'Evolução', icone: <IcEvolucao /> },
    { id: 'diario', label: 'Meu diário', icone: <IcCalendario /> },
    { id: 'pagamentos', label: 'Pagamentos', icone: <IcPagamentos />, badge: vencidas.length },
    { id: 'chat', label: 'Chat', icone: <IcChat /> },
    { id: 'config', label: 'Configurações', icone: <IcConfig /> }
  ]

  const pontosMedida = listaAval
    .filter(a => a.medidas && a.medidas[medidaGrafico] !== undefined)
    .map(a => ({ label: fmtData(a.ts).slice(0, 5), valor: Number(a.medidas[medidaGrafico]) }))

  const meta = TITULOS[aba] || TITULOS.treino
  const primeiroNome = (perfil?.nome || '').split(' ')[0]

  return (
    <Layout
      user={user} perfil={perfil} onSair={onSair} itens={itens}
      abaAtiva={aba} onAba={a => { setAba(a); setExecutando(false) }}
      roleLabel="Aluno" titulo={meta.t} subtitulo={meta.s}
    >
      {/* ===== TREINO ===== */}
      {aba === 'treino' && (
        <>
          {executando && exerciciosHoje.length > 0 ? (
            <ExecucaoTreino
              exercicios={exerciciosHoje}
              feitas={feitas}
              nomeTreino={nomeTreinoHoje}
              cargaAnterior={cargaAnterior}
              onMarcar={marcarSerie}
              onFinalizar={concluirTreino}
              onFechar={() => setExecutando(false)}
            />
          ) : (
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
                  <div className="hero-treino">
                    <div className="hero-topo">
                      <div>
                        <div className="hero-eyebrow">
                          {primeiroNome ? `Bom treino, ${primeiroNome}` : 'Treino de hoje'}
                        </div>
                        <h2>{nomeTreinoHoje}</h2>
                      </div>
                      {ciclico && (
                        <div className="ciclo-progresso">
                          {plano.lista.map((d, i) => (
                            <Fragment key={i}>
                              {i > 0 && <span className="ciclo-seta">·</span>}
                              <span className={'ciclo-passo ' + (i === idxAtual ? 'ativo' : '')} title={d.nome}>
                                {LETRAS[i] || i + 1}
                              </span>
                            </Fragment>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="hero-meta">
                      <div className="hm">
                        <span className="hm-label">Duração</span>
                        <span className="hm-valor">{minutos} min</span>
                      </div>
                      <div className="hm">
                        <span className="hm-label">Exercícios</span>
                        <span className="hm-valor">{exerciciosHoje.length}</span>
                      </div>
                      <div className="hm">
                        <span className="hm-label">Séries</span>
                        <span className="hm-valor">{seriesFeitasHoje}/{seriesDoDia}</span>
                      </div>
                      {ciclico && (
                        <div className="hm">
                          <span className="hm-label">No ciclo</span>
                          <span className="hm-valor">{idxAtual + 1} de {totalDias}</span>
                        </div>
                      )}
                    </div>

                    {proximoBloco && (
                      <p className="hero-proximo">
                        Próximo: <strong>{proximoBloco.titulo}</strong>
                        {proximoBloco.combinado ? ' · bi-set' : ` · ${resumoLinhas(proximoBloco.exercicios[0].linhas)}`}
                      </p>
                    )}

                    {treinoDoDiaCompleto ? (
                      <button className="btn btn-lg" onClick={concluirTreino}>
                        <IcCheck /> {ciclico ? 'Finalizar e liberar o próximo' : 'Finalizar treino'}
                      </button>
                    ) : (
                      <button className="btn btn-lg" onClick={() => setExecutando(true)}>
                        <IcPlay /> {seriesFeitasHoje > 0 ? 'Continuar treino' : 'Iniciar treino'}
                      </button>
                    )}
                  </div>

                  <div className="metricas-aluno">
                    <div className="metrica">
                      <span className="m-icone"><IcFogo /></span>
                      <div>
                        <div className="m-valor">{sequencia}</div>
                        <div className="m-label">dia{sequencia === 1 ? '' : 's'} seguido{sequencia === 1 ? '' : 's'}</div>
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
                      <span className="m-icone"><IcRelogio /></span>
                      <div>
                        <div className="m-valor" style={{ fontSize: 15 }}>{ultimoTreinoTs ? fmtData(ultimoTreinoTs) : '—'}</div>
                        <div className="m-label">último treino</div>
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

                  {proximaCobranca && (
                    <div className="card card-compacto" style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                      <span className="stat-icone amarelo"><IcAlerta /></span>
                      <div style={{ flex: 1, minWidth: 160 }}>
                        <div style={{ fontWeight: 600 }}>Próximo pagamento · {fmtMoeda(proximaCobranca.valor)}</div>
                        <div className="mini">Vence em {proximaCobranca.vencimento.split('-').reverse().join('/')}</div>
                      </div>
                      <button className="btn btn-sec btn-sm" onClick={() => setAba('pagamentos')}>Ver</button>
                    </div>
                  )}

                  <div className="section-title">Exercícios de hoje</div>
                  {blocosHoje.map((b, i) => (
                    <div key={i} className={'bloco-preview ' + (b.combinado ? 'combinado' : '')}>
                      {b.combinado && <span className="badge primaria bloco-tag">Bi-set</span>}
                      {b.exercicios.map((ex, k) => {
                        const total = ex.linhas.length
                        let n = 0
                        for (let s = 1; s <= total; s++) if (feitas[chaveSerie(ex.nome, s)]) n++
                        const completo = total > 0 && n >= total
                        const img = imagemExercicio(ex)
                        return (
                          <div key={k} className={'exercicio-linha ' + (completo ? 'completo' : '')}>
                            {img
                              ? <img
                                  src={img} alt="" className="el-miniatura" loading="lazy"
                                  onError={e => { e.currentTarget.style.visibility = 'hidden' }}
                                />
                              : <span className="el-num">{completo ? <IcCheck /> : i + 1}</span>}
                            <div className="el-nome">
                              {ex.nome}
                              {ex.obs && <div className="el-obs">{ex.obs}</div>}
                            </div>
                            <span className="el-meta">{n}/{total} · {resumoLinhas(ex.linhas)}</span>
                          </div>
                        )
                      })}
                    </div>
                  ))}

                  <p className="mini" style={{ marginTop: 12 }}>
                    Plano {plano.nome} · atualizado em {plano.atualizadoEm ? fmtData(plano.atualizadoEm) : '—'}
                  </p>
                </>
              )}
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

          <div className="card">
            <div className="card-titulo"><h2>Evolução das medidas</h2></div>
            {listaAval.length === 0 && <p className="muted">Seu personal ainda não registrou avaliações físicas.</p>}
            {listaAval.length > 0 && (
              <>
                <label>Medida</label>
                <select value={medidaGrafico} onChange={e => setMedidaGrafico(e.target.value)}>
                  {[...new Set(listaAval.flatMap(a => Object.keys(a.medidas || {})))].map(k => (
                    <option key={k} value={k}>{k}</option>
                  ))}
                </select>
                <div style={{ marginTop: 14 }}>
                  <LineChart pontos={pontosMedida} unidade="" />
                </div>
              </>
            )}
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

      {aba === 'config' && <Config user={user} perfil={perfil} />}
    </Layout>
  )
}
