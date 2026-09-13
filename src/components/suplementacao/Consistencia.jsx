import { useMemo, useState } from 'react'
import {
  historico, aderenciaGeral, SIMBOLOS, ROTULOS_ESTADO,
  TOMADO, PARCIAL, NAO_TOMADO, NAO_REGISTRADO, SEM_DOSE
} from '../../lib/suplementos'

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
export default function Consistencia({ lista, tomados, sequenciaAtual, melhor, onAbrirDia, previsto }) {
  const [janela, setJanela] = useState(30)
  const [filtro, setFiltro] = useState('todos')

  const alvo = useMemo(
    () => (filtro === 'todos' ? lista : lista.filter(s => s.id === filtro)),
    [lista, filtro]
  )

  const ades = useMemo(
    () => aderenciaGeral(alvo, tomados, janela, new Date(), previsto),
    [alvo, tomados, janela, previsto]
  )
  const dias = useMemo(
    () => historico(alvo, tomados, janela, new Date(), previsto),
    [alvo, tomados, janela, previsto]
  )

  const comDados = dias.some(d => d.previstas > 0)

  return (
    <section className="card">
      <div className="card-titulo">
        <div style={{ minWidth: 0 }}>
          <h2>Sua consistência</h2>
          <p className="mini">Sobre o que você informou. Dia sem resposta fica de fora da conta.</p>
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
              <strong>{ades?.pct === null || !ades ? '—' : ades.pct + '%'}</strong>
              <span>
                {!ades || ades.pct === null
                  ? 'nenhuma dose informada ainda'
                  : `${ades.informadas} ${ades.informadas === 1 ? 'dose informada' : 'doses informadas'} de ${ades.previstas} previstas`}
              </span>
            </div>
            {ades?.pct !== null && (
              <div className="sp-barra">
                <div className="sp-barra-fill" style={{ width: (ades?.pct || 0) + '%' }} />
              </div>
            )}
          </div>

          {/* O detalhe é o que torna o percentual avaliável. Sem ele, "63%" não
              diz se faltou tomar ou faltou registrar — coisas bem diferentes. */}
          {ades && (
            <div className="sp-quebra">
              <span className="tomado"><strong>{ades.tomadas}</strong> {ades.tomadas === 1 ? 'tomada' : 'tomadas'}</span>
              {ades.parciais > 0 && <span className="parcial"><strong>{ades.parciais}</strong> {ades.parciais > 1 ? 'parciais' : 'parcial'}</span>}
              {ades.naoTomadas > 0 && <span className="nao_tomado"><strong>{ades.naoTomadas}</strong> não {ades.naoTomadas === 1 ? 'tomada' : 'tomadas'}</span>}
              {ades.naoRegistradas > 0 && (
                <span className="nao_registrado">
                  <strong>{ades.naoRegistradas}</strong> sem registro
                </span>
              )}
            </div>
          )}

          {ades?.naoRegistradas > 0 && (
            <p className="sp-nota-registro">
              As {ades.naoRegistradas} sem registro não entram no percentual — o app
              não sabe o que aconteceu nelas. Toque num dia abaixo para informar.
            </p>
          )}

          {(sequenciaAtual > 0 || melhor > 0) && filtro === 'todos' && (
            <div className="sp-seqs">
              <span><strong>{sequenciaAtual}</strong> {sequenciaAtual === 1 ? 'dia seguido' : 'dias seguidos'} registrados</span>
              {melhor > sequenciaAtual && <span>Melhor sequência: <strong>{melhor}</strong> dias</span>}
            </div>
          )}

          {/* Cada dia é tocável: é assim que se corrige um esquecimento. */}
          <div className="sp-hist">
            {dias.map(d => {
              const vazio = d.estado === SEM_DOSE
              return (
                <button
                  key={d.iso}
                  type="button"
                  className={'sp-hist-dia ' + d.estado + (d.futuro ? ' futuro' : '')}
                  onClick={() => onAbrirDia && onAbrirDia(d)}
                  disabled={d.futuro}
                  title={`${DOW[d.data.getDay()]} ${d.data.getDate()}/${d.data.getMonth() + 1} · ${
                    vazio ? 'sem dose prevista' : ROTULOS_ESTADO[d.estado]
                  }`}
                >
                  <span className="sp-hist-num">{d.data.getDate()}</span>
                  <span className="sp-hist-sinal" aria-hidden="true">
                    {vazio ? '—' : SIMBOLOS[d.estado]}
                  </span>
                </button>
              )
            })}
          </div>

          <div className="sp-legenda">
            <span><i className="tomado">✓</i> tomado</span>
            <span><i className="parcial">·</i> parcial</span>
            <span><i className="nao_tomado">×</i> não tomado</span>
            <span><i className="nao_registrado">?</i> não registrado</span>
            <span><i>—</i> sem dose prevista</span>
          </div>
        </>
      )}
    </section>
  )
}
