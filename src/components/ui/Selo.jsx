/*
  Estado em uma palavra. `ponto` acrescenta um marcador antes do texto — cor
  sozinha não comunica para quem não a distingue, e o brief pede isso (item 60).
*/
export default function Selo({ tom = 'neutro', ponto, children }) {
  return (
    <span className={'ui-selo' + (tom !== 'neutro' ? ' ui-selo-' + tom : '')}>
      {ponto && <i className="ui-selo-ponto" aria-hidden="true" />}
      {children}
    </span>
  )
}
