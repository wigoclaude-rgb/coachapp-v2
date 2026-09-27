/*
  Barra COM texto, sempre. "3 de 7 exercícios" diz o que 43% não diz, e o
  brief pede exatamente isso (item 28). Por isso `feito` e `total` são
  contagens, não uma porcentagem já calculada.
*/
export default function Progresso({ feito, total, rotulo, completo }) {
  const pct = total > 0 ? Math.min(100, Math.round((feito / total) * 100)) : 0
  return (
    <div className="ui-prog">
      <span className="ui-prog-trilho"
            role="progressbar" aria-valuenow={feito} aria-valuemin={0} aria-valuemax={total}
            aria-label={rotulo || `${feito} de ${total}`}>
        <span className={'ui-prog-fita' + (completo ? ' ui-completo' : '')} style={{ width: pct + '%' }} />
      </span>
      <span className="ui-prog-txt">{rotulo || `${feito} de ${total}`}</span>
    </div>
  )
}
