import { useEffect, useMemo, useRef, useState } from 'react'
import { youtubeId, beep } from '../lib/util'
import { IcCheck, IcVoltar, IcVideo, IcTrofeu, IcRelogio } from './Icones.jsx'

const RAIO = 88
const CIRC = 2 * Math.PI * RAIO

function mmss(s) {
  return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0')
}

/**
 * Modo foco: um exercício por vez, uma série por vez.
 * Avança sozinho ao concluir cada série e ao terminar cada exercício.
 */
export default function ExecucaoTreino({ exercicios, feitas, nomeTreino, cargaAnterior, onMarcar, onFinalizar, onFechar }) {
  const [idxEx, setIdxEx] = useState(0)
  const [peso, setPeso] = useState('')
  const [erro, setErro] = useState('')
  const [descanso, setDescanso] = useState(null) // { restante, total }
  const [videoAberto, setVideoAberto] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const timerRef = useRef(null)

  const ex = exercicios[idxEx]
  const totalSeries = Number(ex?.series) || 0

  // primeira série ainda não concluída deste exercício
  const serieAtual = useMemo(() => {
    if (!ex) return 1
    for (let s = 1; s <= totalSeries; s++) {
      if (!feitas[ex.nome + '_' + s]) return s
    }
    return totalSeries + 1
  }, [ex, totalSeries, feitas])

  const exercicioCompleto = serieAtual > totalSeries

  const feitasTotal = exercicios.reduce((soma, e) => {
    let n = 0
    for (let s = 1; s <= (Number(e.series) || 0); s++) if (feitas[e.nome + '_' + s]) n++
    return soma + n
  }, 0)
  const seriesTotal = exercicios.reduce((s, e) => s + (Number(e.series) || 0), 0)
  const progresso = seriesTotal ? Math.round((feitasTotal / seriesTotal) * 100) : 0
  const treinoCompleto = feitasTotal >= seriesTotal && seriesTotal > 0

  // reset ao trocar de exercício
  useEffect(() => { setPeso(''); setErro(''); setVideoAberto(false) }, [idxEx])

  // cronômetro de descanso
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
    if (!ex || exercicioCompleto || salvando) return
    setSalvando(true)
    const msg = await onMarcar(ex, serieAtual, peso)
    setSalvando(false)
    if (msg) { setErro(msg); return }

    setErro('')
    setPeso('')

    const eraUltima = serieAtual >= totalSeries
    const temProximo = idxEx < exercicios.length - 1

    if (eraUltima && temProximo) {
      setIdxEx(i => i + 1)
      return
    }
    if (!eraUltima && Number(ex.descanso) > 0) {
      setDescanso({ restante: Number(ex.descanso), total: Number(ex.descanso) })
    }
  }

  if (!ex) return null

  const vid = youtubeId(ex.video)
  const anterior = cargaAnterior ? cargaAnterior(ex.nome) : null
  const alvo = ex.carga ? Number(ex.carga) : null
  const offset = descanso ? CIRC * (1 - descanso.restante / Math.max(1, descanso.total)) : 0

  return (
    <div className="execucao-wrap">
      {descanso && (
        <div className="descanso-overlay">
          <div className="descanso-anel">
            <svg viewBox="0 0 200 200">
              <circle className="trilha" cx="100" cy="100" r={RAIO} />
              <circle
                className="arco" cx="100" cy="100" r={RAIO}
                strokeDasharray={CIRC} strokeDashoffset={offset}
              />
            </svg>
            <div className="centro">
              <span className="tempo">{mmss(descanso.restante)}</span>
              <span className="rotulo">Descanso</span>
            </div>
          </div>
          <div className="descanso-info">
            <strong>Próxima: série {serieAtual} de {totalSeries}</strong>
            {ex.nome}
          </div>
          <button className="btn btn-sec btn-auto" onClick={pularDescanso}>Pular descanso</button>
        </div>
      )}

      <div className="exec-topo">
        <button className="btn btn-ghost btn-sm" onClick={onFechar}><IcVoltar /></button>
        <div className="exec-info">
          <div className="exec-nome">{nomeTreino}</div>
          <div className="exec-passo">Exercício {idxEx + 1} de {exercicios.length} · {feitasTotal}/{seriesTotal} séries</div>
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
        <div className="exec-card" key={idxEx}>
          <h2>{ex.nome}</h2>
          <div className="exec-tags">
            <span className="badge">{totalSeries} séries</span>
            <span className="badge">{ex.reps} repetições</span>
            {Number(ex.descanso) > 0 && <span className="badge"><IcRelogio /> {ex.descanso}s</span>}
          </div>

          {vid && (
            <div style={{ marginTop: 14 }}>
              {videoAberto ? (
                <div className="video-wrap">
                  <iframe
                    src={'https://www.youtube.com/embed/' + vid}
                    title={ex.nome}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>
              ) : (
                <button className="btn btn-sec btn-sm" onClick={() => setVideoAberto(true)}><IcVideo /> Ver execução</button>
              )}
            </div>
          )}

          <div className="exec-numeros">
            <div className="exec-numero">
              <div className="en-label">Anterior</div>
              <div className="en-valor">{anterior ? anterior + ' kg' : '—'}</div>
            </div>
            <div className="exec-numero destaque">
              <div className="en-label">Alvo</div>
              <div className="en-valor">{alvo ? alvo + ' kg' : 'Livre'}</div>
            </div>
            <div className="exec-numero">
              <div className="en-label">Série</div>
              <div className="en-valor">{serieAtual}/{totalSeries}</div>
            </div>
          </div>

          <div className="series-pontos">
            {Array.from({ length: totalSeries }, (_, i) => {
              const s = i + 1
              const done = feitas[ex.nome + '_' + s]
              return (
                <div key={s} className={'serie-ponto ' + (done ? 'feita' : s === serieAtual ? 'atual' : '')}>
                  {done ? <IcCheck /> : s}
                </div>
              )
            })}
          </div>

          <div className="exec-entrada">
            <div>
              <label>Carga usada (kg)</label>
              <input
                type="number" inputMode="decimal" value={peso}
                onChange={e => setPeso(e.target.value)}
                placeholder={alvo ? String(alvo) : 'kg'}
              />
            </div>
          </div>

          {erro && <div className="erro">{erro}</div>}

          <button className="btn btn-lg" onClick={concluirSerie} disabled={salvando}>
            <IcCheck /> {salvando ? 'Registrando...' : `Concluir série ${serieAtual}`}
          </button>

          <div className="exec-rodape">
            <button className="btn btn-sec btn-sm" onClick={() => setIdxEx(i => Math.max(0, i - 1))} disabled={idxEx === 0}>Anterior</button>
            <span className="espaco" />
            <button className="btn btn-sec btn-sm" onClick={() => setIdxEx(i => Math.min(exercicios.length - 1, i + 1))} disabled={idxEx >= exercicios.length - 1}>Pular exercício</button>
          </div>
        </div>
      )}
    </div>
  )
}
