import { useMemo, useState } from 'react'
import { historico, aderenciaGeral } from '../../lib/suplementos'

const JANELAS = [
  { id: 7, rotulo: '7 dias' },
  { id: 30, rotulo: '30 dias' },
  { id: 90, rotulo: '90 dias' }
]

const DOW = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']

/*
  Constância e histórico juntos: o percentual e a prova dele na mesma tela.

  Percentual sempre acompanhado do denominador — "87%" sozinho não deixa ninguém
  agir, e esconde se veio de 26 doses ou de 3.
*/
export default function Consistencia({ lista, tomados, sequenciaAtual, melhor }) {
  const [janela, setJanela] = useState(30)
  const [filtro, setFiltro] = useState('todos')

  const alvo = useMemo(
    () => (filtro === 'todos' ? lista : lista.filter(s => s.id === filtro)),
    [lista, filtro]
  )

  const ades = useMemo(() => aderenciaGeral(alvo, tomados, janela), [alvo, tomados, janela])
  const dias = useMemo(() => historico(alvo, tomados, janela), [alvo, tomados, janela])

  const comDados = dias.some(d => d.esperadas > 0)

  return (
    <section className="card">
      <div className="card-titulo">
        <div style={{ minWidth: 0 }}>
          <h2>Sua consistência</h2>
          <p className="mini">Doses marcadas sobre as doses previstas no período.</p>
        </div>
      </div>

      <div className="sp-filtros">
        {JANELAS.map(j => (
          <button
            key={j.id} type="button"
            className={'sp-filtro' + (janela === j.id ? ' ativo' : '')}
            onClick={() => setJanela(j.id)}
            aria-pressed={janela === j.id}
          >
            {j.rotulo}
          </button>
        ))}

        {lista.length > 1 && (
          <select
            className="sp-select"
            value={filtro}
            onChange={e => setFiltro(e.target.value)}
            aria-label="Filtrar por suplemento"
          >
            <option value="todos">Todos os suplementos</option>
            {lista.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
          </select>
        )}
      </div>

      {!comDados ? (
        <p className="muted sp-sem-historico">
          Ainda não há doses previstas neste período. O histórico começa a contar
          a partir do cadastro de cada suplemento.
        </p>
      ) : (
        <>
          <div className="sp-consist">
            <div className="sp-consist-num">
              <strong>{ades ? ades.pct : 0}%</strong>
              <span>{ades ? `${ades.cumpridas} de ${ades.esperadas} doses` : 'sem doses previstas'}</span>
            </div>
            <div className="sp-barra">
              <div className="sp-barra-fill" style={{ width: (ades?.pct || 0) + '%' }} />
            </div>
          </div>

          {(sequenciaAtual > 0 || melhor > 0) && filtro === 'todos' && (
            <div className="sp-seqs">
              <span><strong>{sequenciaAtual}</strong> {sequenciaAtual === 1 ? 'dia seguido' : 'dias seguidos'}</span>
              {melhor > sequenciaAtual && <span>Melhor sequência: <strong>{melhor}</strong> dias</span>}
            </div>
          )}

          {/* Estado por dia. O símbolo distingue os casos sem depender de cor. */}
          <div className="sp-hist" role="img" aria-label={`Histórico dos últimos ${janela} dias`}>
            {dias.map(d => (
              <span
                key={d.iso}
                className={'sp-hist-dia ' + d.estado}
                title={`${DOW[d.data.getDay()]} ${d.data.getDate()}/${d.data.getMonth() + 1} · ${
                  d.esperadas === 0 ? 'sem doses previstas' : `${d.cumpridas} de ${d.esperadas}`
                }`}
              >
                {d.estado === 'ok' ? '✓' : d.estado === 'falhou' ? '×' : d.estado === 'parcial' ? '·' : ''}
              </span>
            ))}
          </div>

          <div className="sp-legenda">
            <span><i>✓</i> tomado</span>
            <span><i>·</i> parcial</span>
            <span><i>×</i> não tomado</span>
            <span><i /> sem dose prevista</span>
          </div>
        </>
      )}
    </section>
  )
}
