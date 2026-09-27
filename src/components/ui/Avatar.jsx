/* Iniciais quando não há foto — é o caso da maioria dos alunos. */
export default function Avatar({ nome = '', foto, tamanho, online }) {
  const iniciais = nome.trim().split(/\s+/).slice(0, 2).map(p => p[0] || '').join('')
  const corpo = (
    <span className={'ui-avatar' + (tamanho ? ' ui-avatar-' + tamanho : '')}>
      {foto ? <img src={foto} alt="" /> : (iniciais || '?')}
    </span>
  )
  if (online === undefined) return corpo
  return (
    <span className="ui-avatar-env">
      {corpo}
      {online && <i className="ui-avatar-online" title="Online" />}
    </span>
  )
}
