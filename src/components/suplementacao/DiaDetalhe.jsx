import { ROTULOS_ESTADO, SIMBOLOS, SEM_DOSE, NAO_REGISTRADO } from '../../lib/suplementos'

const DOW = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado']

/*
  Um dia do histórico, aberto.

  Existe para responder "o que aconteceu no dia 05?" e deixar corrigir ali mesmo.
  Antes o histórico era só um quadradinho colorido com um title no hover — sem
  data legível, sem dizer qual suplemento, e sem nada para fazer a respeito.
*/
export default function DiaDetalhe({ dia, podeEditar, onAbrirDose, onFechar }) {
  if (!dia) return null

  const d = dia.data
  const titulo = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`

  return (
    <div className="fd-fundo" onClick={onFechar}>
      <div className="fd" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">
        <h2>{titulo}</h2>
        <p className="fd-quando" style={{ marginTop: -4 }}>{DOW[d.getDay()]}</p>

        {dia.itens.length === 0 ? (
          <p className="fd-vazio">
            Nenhuma dose prevista neste dia. Não é falha — é descanso.
          </p>
        ) : (
          <ul className="fd-lista">
            {dia.itens.map(it => (
              <li key={it.id}>
                <button
                  type="button"
                  className="fd-item"
                  onClick={() => podeEditar && onAbrirDose(it)}
                  disabled={!podeEditar}
                >
                  <span className={'fd-item-selo ' + it.estado} aria-hidden="true">
                    {SIMBOLOS[it.estado] || '—'}
                  </span>
                  <span className="fd-item-txt">
                    <strong>{it.nome}</strong>
                    <span>
                      {[it.dose, it.horario && `prevista para ${it.horario}`].filter(Boolean).join(' · ')}
                    </span>
                    <span className={'fd-item-estado ' + it.estado}>
                      {ROTULOS_ESTADO[it.estado]}
                      {it.vezesAoDia > 1 ? ` · ${it.vezes} de ${it.vezesAoDia}` : ''}
                    </span>
                  </span>
                  {podeEditar && (
                    <span className="fd-item-acao">
                      {it.estado === NAO_REGISTRADO ? 'Registrar' : 'Editar'}
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="fd-rodape">
          <button type="button" className="btn btn-sec btn-sm" onClick={onFechar}>Fechar</button>
        </div>
      </div>
    </div>
  )
}

export { SEM_DOSE }
