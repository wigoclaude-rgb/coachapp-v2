import { useRef, useState } from 'react'
import { redimensionarImagem } from '../lib/util'
import { enviarFoto } from '../lib/fotos'

/**
 * Escolhe uma imagem e devolve a URL em onFoto.
 *
 * Com `pasta`, envia ao Firebase Storage e devolve a URL pública (caminho novo).
 * Sem `pasta`, cai no base64 antigo — mantido só para não quebrar chamadas legadas.
 */
export default function FotoInput({ atual, onFoto, rotulo = 'Escolher foto', circular = false, pasta = null, maxLado = 1080 }) {
  const inputRef = useRef(null)
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState('')

  async function escolher(e) {
    const file = e.target.files[0]
    e.target.value = '' // permite reescolher o mesmo arquivo
    if (!file) return

    setErro('')
    setCarregando(true)
    try {
      const url = pasta ? await enviarFoto(file, pasta, maxLado) : await redimensionarImagem(file)
      onFoto(url)
    } catch (err) {
      const codigo = err?.code || ''
      if (codigo === 'storage/unauthorized') setErro('Sem permissão para enviar. Confira as regras do Storage.')
      else if (codigo.startsWith('storage/')) setErro('Falha no envio. Verifique sua conexão e tente de novo.')
      else setErro('Não foi possível carregar a imagem.')
      console.warn('Falha ao enviar foto:', err)
    }
    setCarregando(false)
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        {atual
          ? <img src={atual} alt="foto" className={circular ? 'foto-perfil' : 'foto-quadrada'} />
          : <div className={(circular ? 'foto-perfil' : 'foto-quadrada') + ' foto-vazia'}>Sem foto</div>}
        <div>
          <button type="button" className="btn btn-sec btn-sm" onClick={() => inputRef.current.click()} disabled={carregando}>
            {carregando ? 'Enviando...' : rotulo}
          </button>
          <input ref={inputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={escolher} />
        </div>
      </div>
      {erro && <div className="erro" style={{ marginTop: 8 }}>{erro}</div>}
    </div>
  )
}
