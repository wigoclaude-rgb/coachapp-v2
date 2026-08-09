import { CAMPOS_FICHA, SECOES_FICHA } from '../lib/ficha'

/**
 * Corpo do formulário da ficha. Não conhece Firebase — só recebe as respostas
 * e avisa as mudanças, para a página cuidar do envio.
 */
export default function FormularioFicha({
  respostas, onMudar, onEnviar,
  nomePersonal = 'seu personal', faltando = [], erro = '', enviando = false
}) {
  return (
    <form onSubmit={onEnviar}>
      {faltando.length > 0 && (
        <div className="erro">Faltou preencher: {faltando.join(', ')}.</div>
      )}

      {SECOES_FICHA.map(secao => (
        <section key={secao} className="ficha-secao">
          <h2>{secao}</h2>
          {CAMPOS_FICHA.filter(c => c.secao === secao).map(campo => (
            <div key={campo.id} className="ficha-campo">
              <label htmlFor={campo.id}>
                {campo.rotulo}
                {campo.obrigatorio && <span className="obrigatorio" aria-hidden="true"> *</span>}
              </label>

              {campo.tipo === 'opcoes' ? (
                <div className="opcoes-chips" role="group" aria-label={campo.rotulo}>
                  {campo.opcoes.map(op => (
                    <button
                      key={op}
                      type="button"
                      className={'chip-opcao ' + (respostas[campo.id] === op ? 'ativo' : '')}
                      onClick={() => onMudar(campo.id, op)}
                      aria-pressed={respostas[campo.id] === op}
                    >
                      {op}
                    </button>
                  ))}
                </div>
              ) : campo.tipo === 'longo' ? (
                <textarea
                  id={campo.id} rows={2}
                  value={respostas[campo.id]}
                  onChange={e => onMudar(campo.id, e.target.value)}
                />
              ) : (
                <input
                  id={campo.id}
                  type={campo.tipo === 'numero' ? 'number' : campo.tipo === 'data' ? 'date' : campo.tipo}
                  inputMode={campo.tipo === 'numero' ? 'decimal' : undefined}
                  step={campo.tipo === 'numero' ? '0.1' : undefined}
                  value={respostas[campo.id]}
                  onChange={e => onMudar(campo.id, e.target.value)}
                />
              )}

              {campo.ajuda && <p className="mini">{campo.ajuda}</p>}
            </div>
          ))}
        </section>
      ))}

      {erro && <div className="erro">{erro}</div>}

      <button className="btn btn-lg" disabled={enviando}>
        {enviando ? 'Enviando...' : 'Enviar ficha'}
      </button>
      <p className="mini" style={{ textAlign: 'center', marginTop: 10 }}>
        Seus dados vão só para {nomePersonal}.
      </p>
    </form>
  )
}
