import {
  ESTADOS_DECLARAVEIS, ROTULOS_ESTADO, SIMBOLOS,
  NAO_REGISTRADO, TOMADO, PARCIAL
} from '../../lib/suplementos'

/*
  "O que aconteceu com esta dose?"

  Serve para hoje e para qualquer dia passado — é a mesma pergunta. Por isso não
  há duas telas: registrar e corrigir são a mesma ação, e separar em dois fluxos
  faria a correção parecer exceção quando ela é rotina.

  As três respostas ficam lado a lado, sem uma ser o padrão escondido: dizer "não
  tomei" precisa ser tão fácil quanto dizer "tomei", senão a pessoa simplesmente
  não responde — e aí volta o buraco que este trabalho inteiro veio fechar.
*/
export default function FolhaDose({
  sup, dia, estadoAtual, vezes = 0, onEscolher, onLimpar, onFechar, salvando, erro
}) {
  if (!sup) return null

  const jaRespondeu = estadoAtual && estadoAtual !== NAO_REGISTRADO
  const parcialDeVarias = sup.vezesAoDia > 1

  const dataBR = String(dia || '').split('-').reverse().join('/')

  return (
    <div className="fd-fundo" onClick={() => !salvando && onFechar()}>
      <div className="fd" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">
        <h2>{jaRespondeu ? 'Editar registro' : 'Registrar dose'}</h2>

        <div className="fd-sup">
          <strong>{sup.nome}</strong>
          <span>{[sup.dose, sup.marca].filter(Boolean).join(' · ')}</span>
          <span className="fd-quando">
            {dataBR}
            {sup.horario ? ` · dose prevista para ${sup.horario}` : ''}
            {parcialDeVarias ? ` · ${vezes} de ${sup.vezesAoDia} registradas` : ''}
          </span>
        </div>

        {jaRespondeu && (
          <p className="fd-atual">
            Agora está como <strong>{ROTULOS_ESTADO[estadoAtual]}</strong>.
          </p>
        )}

        <p className="fd-pergunta">O que aconteceu?</p>

        <div className="fd-opcoes">
          {ESTADOS_DECLARAVEIS.map(op => (
            <button
              key={op.id}
              type="button"
              className={'fd-op' + (estadoAtual === op.id ? ' atual' : '') + ' ' + op.id}
              onClick={() => onEscolher(op.id)}
              disabled={salvando}
            >
              <span className="fd-op-simbolo" aria-hidden="true">{op.simbolo}</span>
              <span>
                {op.id === TOMADO && parcialDeVarias ? 'Tomei mais uma' : op.rotulo}
              </span>
            </button>
          ))}
        </div>

        {erro && <div className="fd-erro" role="alert">{erro}</div>}

        <div className="fd-rodape">
          {jaRespondeu && (
            <button
              type="button" className="btn btn-sec btn-sm" disabled={salvando}
              onClick={onLimpar}
              title="Volta o dia para 'não registrado', sem afirmar que você tomou ou não"
            >
              Apagar registro
            </button>
          )}
          <button type="button" className="btn btn-sec btn-sm" onClick={onFechar} disabled={salvando}>
            {salvando ? 'Salvando...' : 'Fechar'}
          </button>
        </div>

        <p className="fd-nota">
          Sem resposta, o dia fica como <strong>{SIMBOLOS[NAO_REGISTRADO]} não registrado</strong>.
          O app nunca conclui sozinho que você não tomou.
        </p>
      </div>
    </div>
  )
}
