import Botao from './Botao.jsx'

/*
  Vazio, erro e sem permissão na mesma peça — são a mesma coisa do ponto de
  vista de quem olha: "não tem o que eu esperava, e agora?".

  A regra do projeto continua: bloco SEM conteúdo não aparece. Isto é para a
  tela inteira estar vazia, não para anunciar que uma seção está.
*/
export default function Estado({ tom = 'vazio', icone, titulo, children, acao }) {
  return (
    <div className={'ui-estado' + (tom === 'erro' ? ' ui-estado-perigo' : '')}>
      {icone && <span className="ui-estado-icone">{icone}</span>}
      <h3>{titulo}</h3>
      {children && <p>{children}</p>}
      {acao && <Botao tom={tom === 'erro' ? 'neutro' : 'principal'} onClick={acao.aoTocar}>{acao.rotulo}</Botao>}
    </div>
  )
}
