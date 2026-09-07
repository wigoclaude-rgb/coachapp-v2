import { fmtMoeda } from '../../lib/util'
import { selo, legenda, referencia, dataBR } from '../../lib/cobrancas'

/*
  Uma cobrança numa linha. Serve para a lista de abertas e para o histórico —
  a diferença é só o botão, que aparece apenas onde faz sentido informar.
*/
export default function LinhaCobranca({ cob, podeInformar, onInformar }) {
  const s = selo(cob)
  return (
    <div className="pag-linha">
      <div className="pag-linha-info">
        <div className="pag-linha-topo">
          <strong>{referencia(cob) || dataBR(cob.vencimento)}</strong>
          <span className="pag-linha-valor">{fmtMoeda(cob.valor)}</span>
        </div>
        <span className="pag-linha-sub">{legenda(cob)}</span>
      </div>
      <div className="pag-linha-dir">
        <span className={'pag-selo ' + s.tom}>{s.rotulo}</span>
        {podeInformar && (
          <button className="btn btn-sm" onClick={() => onInformar(cob)}>Já paguei</button>
        )}
      </div>
    </div>
  )
}
