import { useId } from 'react'

/*
  Rótulo, campo, dica e erro numa peça. Separados, o `htmlFor` era esquecido
  metade das vezes e o leitor de tela anunciava "caixa de texto" sem dizer de quê.

  `erro` é string: se existe, aparece e marca o campo. A tela não precisa
  lembrar de fazer as duas coisas.
*/
export default function Campo({ rotulo, dica, erro, como = 'input', children, ...resto }) {
  const id = useId()
  const idAjuda = id + '-ajuda'
  const Tag = como
  const classes = 'ui-entrada' + (erro ? ' ui-invalido' : '')

  return (
    <div className="ui-campo">
      {rotulo && <label htmlFor={id}>{rotulo}</label>}
      {como === 'select'
        ? <select id={id} className={classes} aria-invalid={!!erro}
                  aria-describedby={erro || dica ? idAjuda : undefined} {...resto}>{children}</select>
        : <Tag id={id} className={classes} aria-invalid={!!erro}
               aria-describedby={erro || dica ? idAjuda : undefined} {...resto} />}
      {erro && <span id={idAjuda} className="ui-campo-erro" role="alert">{erro}</span>}
      {!erro && dica && <span id={idAjuda} className="ui-campo-dica">{dica}</span>}
    </div>
  )
}
