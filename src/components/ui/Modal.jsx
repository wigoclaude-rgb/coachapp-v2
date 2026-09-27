import { useEffect, useRef } from 'react'

/*
  Modal interrompe. Existe só para decisão que não pode esperar — confirmar
  algo destrutivo, escolher antes de seguir. Para "mostrar mais", use Gaveta.

  Esc fecha, clique fora fecha, e o foco entra no diálogo e não sai dele
  enquanto estiver aberto: sem isso o Tab passeia pela página atrás do modal e
  quem usa teclado se perde.
*/
export default function Modal({ titulo, descricao, aoFechar, pe, children, largura }) {
  const caixa = useRef(null)

  useEffect(() => {
    const antes = document.activeElement
    caixa.current?.focus()
    /* Trava a rolagem do fundo: no celular o corpo rolava por baixo do modal
       e a pessoa perdia o diálogo de vista. */
    const rolagem = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    function aoTeclar(e) {
      if (e.key === 'Escape') { e.stopPropagation(); aoFechar?.(); return }
      if (e.key !== 'Tab' || !caixa.current) return
      const focaveis = caixa.current.querySelectorAll(
        'button:not([disabled]), [href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])'
      )
      if (!focaveis.length) return
      const primeiro = focaveis[0], ultimo = focaveis[focaveis.length - 1]
      if (e.shiftKey && document.activeElement === primeiro) { e.preventDefault(); ultimo.focus() }
      else if (!e.shiftKey && document.activeElement === ultimo) { e.preventDefault(); primeiro.focus() }
    }
    document.addEventListener('keydown', aoTeclar, true)
    return () => {
      document.removeEventListener('keydown', aoTeclar, true)
      document.body.style.overflow = rolagem
      antes?.focus?.()
    }
  }, [aoFechar])

  return (
    <div className="ui-fundo" onMouseDown={e => e.target === e.currentTarget && aoFechar?.()}>
      <div className="ui-modal" ref={caixa} tabIndex={-1}
           role="dialog" aria-modal="true" aria-label={titulo}
           style={largura ? { maxWidth: largura } : undefined}>
        <div className="ui-modal-topo">
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2>{titulo}</h2>
            {descricao && <p>{descricao}</p>}
          </div>
          {aoFechar && <button className="ui-fechar" onClick={aoFechar} aria-label="Fechar">×</button>}
        </div>
        <div className="ui-modal-corpo">{children}</div>
        {pe && <div className="ui-modal-pe">{pe}</div>}
      </div>
    </div>
  )
}
