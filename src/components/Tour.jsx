import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { ref, update } from 'firebase/database'
import { db } from '../firebase'
import { IcFechar } from './Icones.jsx'

/*
  Tour de primeiro acesso, um por tela.

  Ilumina um elemento por vez e explica ao lado. Some para sempre depois de
  concluído — fica gravado em `users/{uid}/tours/{chave}`, então acompanha a
  pessoa em qualquer aparelho.

  Passos com alvo que não existe na tela são pulados sozinhos: muita coisa é
  condicional (o aviso de pagamento, o bloco de bi-set), e um tour apontando
  para o vazio é pior que tour nenhum.
*/

const MARGEM = 12       // respiro entre o alvo e o balão
const LARGURA_BALAO = 300

export default function Tour({ passos, chave, user, perfil, onFim }) {
  const jaFez = !!perfil?.tours?.[chave]
  const [i, setI] = useState(0)
  const [caixa, setCaixa] = useState(null)   // retângulo do alvo na tela
  const [pronto, setPronto] = useState(false)
  const balaoRef = useRef(null)

  /* Passos cujo alvo realmente existe agora. */
  const visiveis = passos.filter(p => !p.alvo || document.querySelector(p.alvo))
  const passo = visiveis[i]
  const ativo = !jaFez && !!passo

  // Espera a tela assentar antes de medir — os cards têm animação de entrada.
  useEffect(() => {
    if (jaFez) return
    const t = setTimeout(() => setPronto(true), 450)
    return () => clearTimeout(t)
  }, [jaFez])

  useLayoutEffect(() => {
    if (!ativo || !pronto) return

    function medir() {
      if (!passo.alvo) { setCaixa(null); return }
      const el = document.querySelector(passo.alvo)
      if (!el) { setCaixa(null); return }
      const r = el.getBoundingClientRect()
      setCaixa({ top: r.top, left: r.left, width: r.width, height: r.height })
    }

    const el = passo.alvo && document.querySelector(passo.alvo)
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' })

    // Uma medida logo e outra depois da rolagem terminar.
    medir()
    const t = setTimeout(medir, 400)
    window.addEventListener('resize', medir)
    window.addEventListener('scroll', medir, true)
    return () => {
      clearTimeout(t)
      window.removeEventListener('resize', medir)
      window.removeEventListener('scroll', medir, true)
    }
  }, [ativo, pronto, i, passo?.alvo])

  async function encerrar() {
    if (user?.uid) {
      await update(ref(db, 'users/' + user.uid + '/tours'), { [chave]: true })
        .catch(err => console.warn('Não foi possível salvar o tour:', err))
    }
    onFim?.()
  }

  if (!ativo || !pronto) return null

  const ultimo = i >= visiveis.length - 1

  /* Balão embaixo do alvo; se não couber, em cima. Sem alvo, fica centralizado. */
  let estiloBalao = {}
  if (caixa) {
    const cabeEmbaixo = caixa.top + caixa.height + MARGEM + 190 < window.innerHeight
    const topo = cabeEmbaixo ? caixa.top + caixa.height + MARGEM : undefined
    const base = cabeEmbaixo ? undefined : window.innerHeight - caixa.top + MARGEM
    let esq = caixa.left + caixa.width / 2 - LARGURA_BALAO / 2
    esq = Math.max(12, Math.min(esq, window.innerWidth - LARGURA_BALAO - 12))
    estiloBalao = { top: topo, bottom: base, left: esq }
  } else {
    estiloBalao = { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }
  }

  return (
    <div className="tour" role="dialog" aria-modal="true" aria-label={passo.titulo}>
      {/* O "furo" é a sombra gigante em volta do alvo. */}
      {caixa && (
        <div
          className="tour-foco"
          style={{
            top: caixa.top - 6, left: caixa.left - 6,
            width: caixa.width + 12, height: caixa.height + 12
          }}
        />
      )}
      {!caixa && <div className="tour-veu" />}

      <div className="tour-balao" style={estiloBalao} ref={balaoRef}>
        <button className="tour-x" onClick={encerrar} title="Pular tutorial"><IcFechar /></button>

        <span className="tour-passo">Passo {i + 1} de {visiveis.length}</span>
        <h3>{passo.titulo}</h3>
        <p>{passo.texto}</p>

        <div className="tour-acoes">
          {i > 0 && (
            <button className="btn btn-ghost btn-sm" onClick={() => setI(n => n - 1)}>Voltar</button>
          )}
          <span className="espaco" />
          {!ultimo && (
            <button className="btn btn-ghost btn-sm" onClick={encerrar}>Pular</button>
          )}
          <button
            className="btn btn-sm"
            onClick={() => (ultimo ? encerrar() : setI(n => n + 1))}
          >
            {ultimo ? 'Entendi' : 'Próximo'}
          </button>
        </div>
      </div>
    </div>
  )
}
