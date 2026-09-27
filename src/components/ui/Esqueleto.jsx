/*
  Carregamento com a forma do que vem. Uma barra genérica não diz nada; um
  bloco do tamanho certo já prepara o olho e o conteúdo não "pula" ao chegar.
*/
export function Esqueleto({ altura, largura, raio }) {
  return <span className="ui-esq" style={{ display: 'block', height: altura, width: largura, borderRadius: raio }} />
}

export function EsqueletoLista({ linhas = 3 }) {
  return (
    <div aria-hidden="true">
      {Array.from({ length: linhas }, (_, i) => (
        <div key={i} className="ui-esq ui-esq-bloco" />
      ))}
    </div>
  )
}

export function EsqueletoTexto({ linhas = 3, titulo }) {
  return (
    <div aria-hidden="true">
      {titulo && <div className="ui-esq ui-esq-titulo" />}
      {Array.from({ length: linhas }, (_, i) => (
        <div key={i} className="ui-esq ui-esq-linha" style={{ width: i === linhas - 1 ? '65%' : '100%' }} />
      ))}
    </div>
  )
}
