import { useEffect, useMemo, useRef, useState } from 'react'
import { youtubeId, beep } from '../lib/util'
import { agruparBlocos, chaveSerie } from '../lib/treinoModel'
import { IcCheck, IcVoltar, IcVideo, IcTrofeu, IcRelogio } from './Icones.jsx'

const RAIO = 88
const CIRC = 2 * Math.PI * RAIO

const mmss = s => Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0')

/** Linha de série de um exercício para uma dada série (1-based). */
const linhaDe = (ex, serie) => ex.linhas[serie - 1] || null

/**
 * Modo foco: um bloco por vez (exercício simples ou bi-set).
 * Avança sozinho ao concluir cada série e ao terminar cada bloco.
 */
export default function ExecucaoTreino({ exercicios, feitas, nomeTreino, cargaAnterior, onMarcar, onFinalizar, onFechar }) {
  const blocos = useMemo(() => agruparBlocos(exercicios), [exercicios])

  const [idxBloco, setIdxBloco] = useState(0)
  const [pesos, setPesos] = useState({})
  const [erro, setErro] = useState('')
  const [descanso, setDescanso] = useState(null)
  const [videoAberto, setVideoAberto] = useState(null)
  const [salvando, setSalvando] = useState(false)
  const timerRef = useRef(null)

  const bloco = blocos[idxBloco]

  /** Primeira série ainda não concluída do bloco (todos os exercícios contam). */
  const serieAtual = useMemo(() => {
    if (!bloco) return 1
    for (let s = 1; s <= bloco.series; s++) {
      const pendente = bloco.exercicios.some(ex => linhaDe(ex, s) && !feitas[chaveSerie(ex.nome, s)])
      if (pendente) return s
    }
    return bloco.series + 1
  }, [bloco, feitas])

  const blocoCompleto = bloco ? serieAtual > bloco.series : false

  const { feitasTotal, seriesTotal } = useMemo(() => {
    let f = 0, t = 0
    exercicios.forEach(ex => {
      t += ex.linhas.length
      for (let s = 1; s <= ex.linhas.length; s++) if (feitas[chaveSerie(ex.nome, s)]) f++
    })
    return { feitasTotal: f, seriesTotal: t }
  }, [exercicios, feitas])

  const progresso = seriesTotal ? Math.round((feitasTotal / seriesTotal) * 100) : 0
  const treinoCompleto = seriesTotal > 0 && feitasTotal >= seriesTotal

  useEffect(() => { setPesos({}); setErro(''); setVideoAberto(null) }, [idxBloco])

  useEffect(() => {
    if (!descanso) return
    timerRef.current = setInterval(() => {
      setDescanso(d => {
        if (!d) return null
        if (d.restante <= 1) { beep(); return null }
        return { ...d, restante: d.restante - 1 }
      })
    }, 1000)
    return () => clearInterval(timerRef.current)
  }, [descanso === null])

  function pularDescanso() {
    clearInterval(timerRef.current)
    setDescanso(null)
  }

  async function concluirSerie() {
    if (!bloco || blocoCompleto || salvando) return
    setSalvando(true)

    const alvos = bloco.exercicios
      .map(ex => ({ ex, linha: linhaDe(ex, serieAtual) }))
      .filter(a => a.linha && !feitas[chaveSerie(a.ex.nome, serieAtual)])

    for (const { ex, linha } of alvos) {
      const msg = await onMarcar(ex, serieAtual, pesos[ex.nome] ?? '', linha.carga)
      if (msg) { setErro(msg); setSalvando(false); return }
    }
    setSalvando(false)
    setErro('')
    setPesos({})

    const eraUltima = serieAtual >= bloco.series
    const temProximo = idxBloco < blocos.length - 1

    if (eraUltima) {
      if (temProximo) setIdxBloco(i => i + 1)
      return
    }

    const espera = Math.max(...alvos.map(a => Number(a.linha.descanso) || 0), 0)
    if (espera > 0) setDescanso({ restante: espera, total: espera })
  }

  if (!bloco) return null

  const offset = descanso ? CIRC * (1 - descanso.restante / Math.max(1, descanso.total)) : 0

  return (
    <div className="execucao-wrap">
      {descanso && (
        <div className="descanso-overlay">
          <div className="descanso-anel">
            <svg viewBox="0 0 200 200">
              <circle className="trilha" cx="100" cy="100" r={RAIO} />
              <circle className="arco" cx="100" cy="100" r={RAIO} strokeDasharray={CIRC} strokeDashoffset={offset} />
            </svg>
            <div className="centro">
              <span className="tempo">{mmss(descanso.restante)}</span>
              <span className="rotulo">Descanso</span>
            </div>
          </div>
          <div className="descanso-info">
            <strong>Próxima: série {serieAtual} de {bloco.series}</strong>
            {bloco.titulo}
          </div>
          <button className="btn btn-sec btn-auto" onClick={pularDescanso}>Pular descanso</button>
        </div>
      )}

      <div className="exec-topo">
        <button className="btn btn-ghost btn-sm" onClick={onFechar} title="Voltar"><IcVoltar /></button>
        <div className="exec-info">
          <div className="exec-nome">{nomeTreino}</div>
          <div className="exec-passo">Bloco {idxBloco + 1} de {blocos.length} · {feitasTotal}/{seriesTotal} séries</div>
        </div>
      </div>

      <div className="progresso-linear"><i style={{ width: progresso + '%' }} /></div>

      {treinoCompleto ? (
        <div className="exec-card" style={{ textAlign: 'center' }}>
          <div className="vazio-estado" style={{ padding: '20px 0' }}>
            <div className="ve-icone"><IcTrofeu /></div>
            <h2>Treino concluído</h2>
            <p className="muted">{seriesTotal} séries registradas. Bom trabalho.</p>
          </div>
          <button className="btn btn-lg" onClick={onFinalizar}><IcCheck /> Finalizar e liberar o próximo</button>
        </div>
      ) : (
        <div className="exec-card" key={idxBloco}>
          {bloco.combinado && <span className="badge primaria" style={{ marginBottom: 8 }}>Bi-set · alterne sem descanso</span>}

          <div className="exec-serie-atual">
            Série {serieAtual} de {bloco.series}
          </div>

          {bloco.exercicios.map((ex, k) => {
            const linha = linhaDe(ex, serieAtual)
            const vid = youtubeId(ex.video)
            const anterior = cargaAnterior ? cargaAnterior(ex.nome) : null
            const jaFeita = feitas[chaveSerie(ex.nome, serieAtual)]

            return (
              <div className={'exec-exercicio ' + (linha ? '' : 'inativo')} key={k}>
                <div className="exec-ex-topo">
                  <h2>{ex.nome}</h2>
                  {bloco.combinado && <span className="exec-ex-ordem">{k + 1}º</span>}
                </div>

                {!linha ? (
                  <p className="mini">Sem série {serieAtual} neste exercício.</p>
                ) : (
                  <>
                    <div className="exec-numeros">
                      <div className="exec-numero">
                        <div className="en-label">Anterior</div>
                        <div className="en-valor">{anterior ? anterior + ' kg' : '—'}</div>
                      </div>
                      <div className="exec-numero destaque">
                        <div className="en-label">Reps</div>
                        <div className="en-valor">{linha.reps || '—'}</div>
                      </div>
                      <div className="exec-numero">
                        <div className="en-label">Alvo</div>
                        <div className="en-valor">{linha.carga ? linha.carga + ' kg' : 'Livre'}</div>
                      </div>
                    </div>

                    {ex.obs && <div className="exec-obs">{ex.obs}</div>}

                    <div className="series-pontos">
                      {ex.linhas.map((l, i) => {
                        const s = i + 1
                        const done = feitas[chaveSerie(ex.nome, s)]
                        return (
                          <div key={s} className={'serie-ponto ' + (done ? 'feita' : s === serieAtual ? 'atual' : '')} title={`${l.reps} reps${l.carga ? ` · ${l.carga} kg` : ''}`}>
                            {done ? <IcCheck /> : l.reps || s}
                          </div>
                        )
                      })}
                    </div>

                    {!jaFeita && (
                      <div className="exec-entrada">
                        <div>
                          <label>Carga usada (kg)</label>
                          <input
                            type="number" inputMode="decimal"
                            value={pesos[ex.nome] ?? ''}
                            onChange={e => setPesos(p => ({ ...p, [ex.nome]: e.target.value }))}
                            placeholder={linha.carga || 'kg'}
                          />
                        </div>
                      </div>
                    )}

                    {vid && (
                      <div style={{ marginTop: 10 }}>
                        {videoAberto === k ? (
                          <div className="video-wrap">
                            <iframe
                              src={'https://www.youtube.com/embed/' + vid}
                              title={ex.nome}
                              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                              allowFullScreen
                            />
                          </div>
                        ) : (
                          <button className="btn btn-ghost btn-sm" onClick={() => setVideoAberto(k)}><IcVideo /> Ver execução</button>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            )
          })}

          {erro && <div className="erro">{erro}</div>}

          <button className="btn btn-lg" onClick={concluirSerie} disabled={salvando}>
            <IcCheck /> {salvando ? 'Registrando...' : `Concluir série ${serieAtual}`}
          </button>

          <div className="exec-rodape">
            <button className="btn btn-sec btn-sm" onClick={() => setIdxBloco(i => Math.max(0, i - 1))} disabled={idxBloco === 0}>Anterior</button>
            <span className="espaco" />
            <button className="btn btn-sec btn-sm" onClick={() => setIdxBloco(i => Math.min(blocos.length - 1, i + 1))} disabled={idxBloco >= blocos.length - 1}>Pular</button>
          </div>
        </div>
      )}
    </div>
  )
}
