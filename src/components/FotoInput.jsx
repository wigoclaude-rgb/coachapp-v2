import { useRef, useState } from 'react'
import { redimensionarImagem } from '../lib/util'

export default function FotoInput({ atual, onFoto, rotulo = 'Escolher foto', circular = false }) {
  const inputRef = useRef(null)
  const [carregando, setCarregando] = useState(false)

  async function escolher(e) {
    const file = e.target.files[0]
    if (!file) return
    setCarregando(true)
    try {
      const img = await redimensionarImagem(file)
      onFoto(img)
    } catch (err) {
      alert('Não foi possível carregar a imagem.')
    }
    setCarregando(false)
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
      {atual
        ? <img src={atual} alt="foto" className={circular ? 'foto-perfil' : 'foto-quadrada'} />
        : <div className={(circular ? 'foto-perfil' : 'foto-quadrada') + ' foto-vazia'}>Sem foto</div>}
      <div>
        <button type="button" className="btn btn-sec btn-sm" onClick={() => inputRef.current.click()} disabled={carregando}>
          {carregando ? 'Carregando...' : rotulo}
        </button>
        <input ref={inputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={escolher} />
      </div>
    </div>
  )
}
