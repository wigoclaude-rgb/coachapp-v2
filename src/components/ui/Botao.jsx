/*
  Um botão só. As 20 telas antigas escreviam `className="btn btn-sec btn-sm"`
  à mão, e cada uma inventava a sua combinação — havia botão primário em lugar
  onde a ação nem era a principal.

  `tom` responde "qual o peso desta ação", não "qual cor eu quero".
*/
export default function Botao({
  tom = 'neutro', tamanho, cheio, carregando, icone, children, ...resto
}) {
  const classes = [
    'ui-bt', 'ui-bt-' + tom,
    tamanho === 'p' && 'ui-bt-p',
    tamanho === 'g' && 'ui-bt-g',
    cheio && 'ui-bt-cheio',
    !children && icone && 'ui-bt-icone'
  ].filter(Boolean).join(' ')

  return (
    <button className={classes} disabled={carregando || resto.disabled} {...resto}>
      {carregando ? <Girando /> : icone}
      {children}
    </button>
  )
}

/* Spinner em SVG: uma dependência a menos, e herda a cor do botão. */
function Girando() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" opacity=".25" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
        <animateTransform attributeName="transform" type="rotate"
          from="0 12 12" to="360 12 12" dur="0.7s" repeatCount="indefinite" />
      </path>
    </svg>
  )
}
