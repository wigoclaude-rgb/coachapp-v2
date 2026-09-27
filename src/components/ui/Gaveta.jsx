import { useEffect, useRef } from 'react'

/*
  Para detalhe e formulário sem sair da tela de origem. No celular sobe de
  baixo (perto do polegar); no desktop entra pela direita, sem cobrir a lista
  que originou a ação — a diferença está no CSS, não aqui.
*/
export default function Gaveta({ titulo, aoFechar, children, pe }) {
  const caixa = useRef(null)

  useEffect(() => {
    const antes = document.activeElement
    caixa.current?.focus()
    const rolagem = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const aoTeclar = e => { if (e.key === 'Escape') { e.stopPropagation(); aoFechar?.() } }
    document.addEventListener('keydown', aoTeclar, true)
    return () => {
      document.removeEventListener('keydown', aoTeclar, true)
      document.body.style.overflow = rolagem
      antes?.focus?.()
    }
  }, [aoFechar])

  return (
    <>
      <div className="ui-gaveta-fundo" onMouseDown={aoFechar} />
      <aside className="ui-gaveta" ref={caixa} tabIndex={-1} role="dialog" aria-modal="true" aria-label={titulo}>
        <span className="ui-gaveta-puxador" aria-hidden="true" />
        <div className="ui-gaveta-topo">
          <h2>{titulo}</h2>
          {aoFechar && <button className="ui-fechar" onClick={aoFechar} aria-label="Fechar">×</button>}
        </div>
        <div className="ui-gaveta-corpo">{children}</div>
        {pe && <div className="ui-modal-pe">{pe}</div>}
      </aside>
    </>
  )
}
