import { fmtMoeda, fmtData } from '../../lib/util'
import { selo, titulo, dataBR, RECUSADO } from '../../lib/cobrancas'

/*
  O cartão de cima da tela: responde "quanto eu devo e o que eu faço agora" sem
  o aluno precisar ler mais nada.

  Ordem: primeiro o que pede ação (a cobrança aberta mais urgente), depois o que
  já está encaminhado (o que ele informou e aguarda confirmação). Se não há nem
  um nem outro, ele está em dia — e isso também merece ser dito.
*/
export default function SituacaoPagamento({ fin, onInformar }) {
  const { atual, emAnalise, vencidas, totalVencido } = fin

  if (!atual && emAnalise.length === 0) {
    return (
      <section className="pag-hero em-dia">
        <span className="pag-selo ok">Em dia</span>
        <h2>Nenhuma cobrança em aberto</h2>
        <p className="pag-hero-nota">
          Quando seu personal lançar a próxima mensalidade, ela aparece aqui.
        </p>
      </section>
    )
  }

  const s = atual ? selo(atual) : null
  const recusada = atual?.status === RECUSADO

  return (
    <>
      {atual && (
        <section className={'pag-hero ' + s.tom}>
          <span className="pag-hero-rotulo">{titulo(atual)}</span>
          <strong className="pag-hero-valor">{fmtMoeda(atual.valor)}</strong>

          <div className="pag-hero-meta">
            <span className={'pag-selo ' + s.tom}>{s.rotulo}</span>
            <span>Vencimento em {dataBR(atual.vencimento)}</span>
          </div>

          {recusada && (
            <div className="pag-motivo">
              <strong>O personal não confirmou este pagamento.</strong>
              {atual.motivoRecusa && <span>Motivo: “{atual.motivoRecusa}”</span>}
            </div>
          )}

          <button className="btn pag-hero-btn" onClick={() => onInformar(atual)}>
            {recusada ? 'Informar pagamento novamente' : 'Já paguei'}
          </button>

          {vencidas.length > 1 && (
            <p className="pag-hero-nota">
              Você tem {vencidas.length} cobranças vencidas, somando {fmtMoeda(totalVencido)}.
            </p>
          )}
        </section>
      )}

      {emAnalise.map(c => (
        <section key={c.id} className="pag-hero analise" aria-live="polite">
          <span className="pag-hero-rotulo">{titulo(c)}</span>
          <strong className="pag-hero-valor">{fmtMoeda(c.valor)}</strong>
          <div className="pag-hero-meta">
            <span className="pag-selo analise">Aguardando confirmação</span>
            {c.pagamento?.data && <span>Informado em {fmtData(c.pagamento.data)}</span>}
          </div>
          <p className="pag-hero-nota">
            Seu personal foi avisado. Assim que ele conferir o extrato, esta cobrança
            fica como paga.
          </p>
        </section>
      ))}
    </>
  )
}
