import { useEffect, useState } from 'react'
import { ref, update } from 'firebase/database'
import { db } from '../firebase'
import { novidadesDesde, VERSAO_ATUAL } from '../lib/novidades'
import { IcRaio, IcCheck } from './Icones.jsx'

/*
  Avisa o que mudou desde a última vez que a pessoa abriu o app.

  Conta nova não vê nada: `novidadesDesde` devolve vazio quando não há versão
  registrada, e a marca é gravada em silêncio — quem está chegando já tem o
  tutorial de primeiro acesso para digerir.
*/
export default function Novidades({ user, perfil }) {
  const [fechado, setFechado] = useState(false)
  const blocos = novidadesDesde(perfil?.versaoVista, perfil?.role)

  const marcar = () =>
    update(ref(db, 'users/' + user.uid), { versaoVista: VERSAO_ATUAL })
      .catch(err => console.warn('Não foi possível marcar a versão:', err))

  // Sem nada a mostrar, só registra a versão e sai da frente.
  useEffect(() => {
    if (!user?.uid) return
    if (perfil?.versaoVista === VERSAO_ATUAL) return
    if (blocos.length === 0) marcar()
  }, [user?.uid, perfil?.versaoVista, blocos.length])

  if (fechado || blocos.length === 0) return null

  function fechar() {
    setFechado(true)
    marcar()
  }

  return (
    <div className="espiada" onClick={fechar}>
      <div className="espiada-caixa nov-caixa" onClick={e => e.stopPropagation()}>
        <header className="nov-topo">
          <span className="nov-icone"><IcRaio /></span>
          <div>
            <span className="espiada-letra">Novidades · {blocos[0].data}</span>
            <h2>{blocos[0].titulo}</h2>
          </div>
        </header>

        <div className="espiada-corpo">
          {blocos.map(bloco => (
            <div key={bloco.versao}>
              {blocos.length > 1 && <div className="section-title">Versão {bloco.versao}</div>}
              <ul className="nov-lista">
                {bloco.itens.map((item, i) => (
                  <li key={i}><IcCheck /><span>{item.texto}</span></li>
                ))}
              </ul>
            </div>
          ))}

          <button className="btn" style={{ marginTop: 18 }} onClick={fechar}>
            Entendi
          </button>
        </div>
      </div>
    </div>
  )
}
