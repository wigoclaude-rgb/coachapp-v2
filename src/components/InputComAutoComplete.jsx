import { useRef, useState, useEffect } from 'react'

/**
 * Input com autocomplete que:
 * - Mostra sugestões enquanto digita
 * - Permite selecionar uma sugestão
 * - Permite digitar algo novo que não está na lista
 */
export default function InputComAutoComplete({
  value,
  onChange,
  sugestoes = [],
  placeholder = '',
  className = ''
}) {
  const [aberto, setAberto] = useState(false)
  const [filtradas, setFiltradas] = useState([])
  const inputRef = useRef(null)

  useEffect(() => {
    if (!value.trim()) {
      setFiltradas([])
      setAberto(false)
      return
    }

    const termo = value.toLowerCase().trim()
    const matches = sugestoes.filter(s =>
      s.toLowerCase().includes(termo)
    )
    setFiltradas(matches)
    setAberto(matches.length > 0)
  }, [value, sugestoes])

  function selecionarSugestao(sugestao) {
    onChange(sugestao)
    setAberto(false)
  }

  function handleKeyDown(e) {
    if (e.key === 'Escape') {
      setAberto(false)
    }
  }

  return (
    <div className="input-autocomplete-wrapper" style={{ position: 'relative' }}>
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={() => value.trim() && filtradas.length > 0 && setAberto(true)}
        placeholder={placeholder}
        className={className}
      />
      {aberto && filtradas.length > 0 && (
        <div className="autocomplete-dropdown">
          {filtradas.slice(0, 8).map((sug, i) => (
            <button
              key={i}
              type="button"
              className="autocomplete-item"
              onClick={() => selecionarSugestao(sug)}
            >
              {sug}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
