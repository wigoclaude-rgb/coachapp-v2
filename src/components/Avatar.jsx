import { iniciais } from '../lib/util'

/**
 * Foto da pessoa, ou as iniciais do nome quando não há foto.
 * `online` mostra o ponto verde; use undefined para não mostrar nada.
 */
export default function Avatar({ foto, nome, tamanho = 40, online }) {
  const estilo = { width: tamanho, height: tamanho, fontSize: Math.round(tamanho * 0.38) }

  return (
    <span className="avatar-wrap" style={{ width: tamanho, height: tamanho }}>
      {foto
        ? <img src={foto} alt="" className="avatar-img" style={estilo} />
        : <span className="avatar-img avatar-iniciais" style={estilo} aria-hidden="true">{iniciais(nome)}</span>}
      {online !== undefined && (
        <span className={'avatar-ponto ' + (online ? 'on' : 'off')} title={online ? 'Online' : 'Offline'} />
      )}
    </span>
  )
}
