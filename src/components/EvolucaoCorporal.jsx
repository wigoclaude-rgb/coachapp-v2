import { useMemo, useState } from 'react'
import { METRICAS, serieMetrica, variacao, fontesMisturadas } from '../lib/avaliacao'
import { IcAlerta } from './Icones.jsx'

/*
  Evolução corporal em SVG, sem biblioteca.

  Um ponto não vira linha: dois pixels ligados sugerem tendência onde só existe
  uma medida. Com um ponto o gráfico mostra o valor e diz quantas faltam.
*/

const L = 560, A = 200                      // caixa do desenho
const PAD = { e: 46, d: 14, t: 18, b: 34 }  // respiro para rótulos

const fmtData = ts => new Date(ts).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })

function Grafico({ serie, metrica }) {
  const valores = serie.map(p => p.valor)
  const min = Math.min(...valores)
  const max = Math.max(...valores)

  // Faixa achatada (todos iguais) viraria divisão por zero e uma linha colada na borda.
  const folga = (max - min) || Math.max(max * 0.04, 1)
  const baixo = min - folga * 0.35
  const alto = max + folga * 0.35

  const x = i => serie.length === 1
    ? L / 2
    : PAD.e + i * ((L - PAD.e - PAD.d) / (serie.length - 1))
  const y = v => PAD.t + (A - PAD.t - PAD.b) * (1 - (v - baixo) / (alto - baixo))

  const linha = serie.map((p, i) => (i === 0 ? 'M' : 'L') + x(i) + ',' + y(p.valor)).join(' ')
  const area = serie.length > 1
    ? `${linha} L${x(serie.length - 1)},${A - PAD.b} L${x(0)},${A - PAD.b} Z`
    : null

  const rotulo = v => v.toFixed(metrica.casas).replace('.', ',') + metrica.unidade

  return (
    <svg
      viewBox={`0 0 ${L} ${A}`}
      className="ev-svg"
      role="img"
      aria-label={`${metrica.rotulo}: ${serie.length} ${serie.length === 1 ? 'medida' : 'medidas'}`}
    >
      {[max, min].map((v, i) => (
        <g key={i}>
          <line x1={PAD.e} y1={y(v)} x2={L - PAD.d} y2={y(v)} className="ev-grade" />
          <text x={PAD.e - 8} y={y(v) + 4} textAnchor="end" className="ev-eixo">{rotulo(v)}</text>
        </g>
      ))}

      {area && <path d={area} className="ev-area" />}
      {serie.length > 1 && <path d={linha} className="ev-linha" />}

      {serie.map((p, i) => {
        const ultimo = i === serie.length - 1
        return (
          <g key={p.ts}>
            <circle cx={x(i)} cy={y(p.valor)} r={ultimo ? 5.5 : 4} className={'ev-ponto' + (ultimo ? ' fim' : '')} />
            {(ultimo || serie.length === 1) && (
              <text x={x(i)} y={y(p.valor) - 13} textAnchor="middle" className="ev-valor">
                {rotulo(p.valor)}
              </text>
            )}
            <text x={x(i)} y={A - 10} textAnchor="middle" className="ev-eixo">{fmtData(p.ts)}</text>
          </g>
        )
      })}
    </svg>
  )
}

export default function EvolucaoCorporal({ avaliacoes }) {
  const [metricaId, setMetricaId] = useState('peso')
  const metrica = METRICAS.find(m => m.id === metricaId) || METRICAS[0]

  const series = useMemo(() => {
    const mapa = {}
    METRICAS.forEach(m => { mapa[m.id] = serieMetrica(avaliacoes, m.id) })
    return mapa
  }, [avaliacoes])

  const serie = series[metricaId] || []
  const delta = variacao(serie)
  const misturado = metricaId === 'percentualGordura' && fontesMisturadas(serie)

  /* Queda no peso e na cintura é ganho; na massa magra é perda. */
  const tomDelta = delta === null || delta === 0 || !metrica.melhor ? 'neutro'
    : (metrica.melhor === 'menor') === (delta < 0) ? 'bom' : 'ruim'

  const fmtDelta = d => (d > 0 ? '+' : '−') + Math.abs(d).toFixed(metrica.casas).replace('.', ',') + metrica.unidade

  return (
    <div className="card">
      <div className="card-titulo">
        <div style={{ minWidth: 0 }}>
          <h2>Evolução corporal</h2>
          <p className="mini">Medidas registradas nas avaliações, da mais antiga para a mais recente.</p>
        </div>
      </div>

      <div className="ev-chips" role="tablist" aria-label="Métrica">
        {METRICAS.map(m => (
          <button
            key={m.id}
            role="tab"
            aria-selected={m.id === metricaId}
            className={'ev-chip' + (m.id === metricaId ? ' ativo' : '')}
            onClick={() => setMetricaId(m.id)}
          >
            {m.rotulo}
            {series[m.id]?.length > 0 && <span className="ev-chip-n">{series[m.id].length}</span>}
          </button>
        ))}
      </div>

      {serie.length === 0 && (
        <p className="muted ev-vazio">
          Nenhuma avaliação registrou {metrica.rotulo.toLowerCase()} ainda.
        </p>
      )}

      {serie.length === 1 && (
        <>
          <Grafico serie={serie} metrica={metrica} />
          <p className="muted ev-vazio">
            Registre pelo menos 2 avaliações com esta medida para ver a evolução.
          </p>
        </>
      )}

      {serie.length >= 2 && (
        <>
          <div className="ev-topo">
            <div className={'ev-delta ' + tomDelta}>
              <strong>{fmtDelta(delta)}</strong>
              <span>desde {fmtData(serie[0].ts)}</span>
            </div>
            <div className="ev-atual">
              <strong>
                {serie[serie.length - 1].valor.toFixed(metrica.casas).replace('.', ',')}{metrica.unidade}
              </strong>
              <span>medida mais recente</span>
            </div>
          </div>

          <Grafico serie={serie} metrica={metrica} />
        </>
      )}

      {misturado && (
        <p className="ev-aviso">
          <IcAlerta />
          Esta série mistura dobras cutâneas e bioimpedância. Os dois métodos não dão o
          mesmo número — compare a tendência, não os valores.
        </p>
      )}
    </div>
  )
}
