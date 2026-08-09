import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { ref, get, push } from 'firebase/database'
import { db } from '../firebase'
import { respostasVazias, validarFicha } from '../lib/ficha'
import FormularioFicha from '../components/FormularioFicha.jsx'
import { IcCheck, IcAlerta } from '../components/Icones.jsx'

/**
 * Ficha que o aluno preenche SEM login, pelo link que o personal manda.
 * Só grava em fichas/{personalId} — não cria conta nem lê dados de ninguém.
 */
export default function FichaPublica() {
  const { codigo } = useParams()
  const [link, setLink] = useState(null)      // { personalId, nome }
  const [carregando, setCarregando] = useState(true)
  const [respostas, setRespostas] = useState(respostasVazias)
  const [faltando, setFaltando] = useState([])
  const [enviando, setEnviando] = useState(false)
  const [enviada, setEnviada] = useState(false)
  const [erro, setErro] = useState('')

  useEffect(() => {
    let vivo = true
    get(ref(db, 'linksFicha/' + String(codigo || '').toUpperCase()))
      .then(snap => {
        if (!vivo) return
        setLink(snap.exists() ? snap.val() : null)
        setCarregando(false)
      })
      .catch(() => { if (vivo) { setLink(null); setCarregando(false) } })
    return () => { vivo = false }
  }, [codigo])

  function mudar(id, valor) {
    setRespostas(r => ({ ...r, [id]: valor }))
    if (faltando.length) setFaltando([])
  }

  async function enviar(e) {
    e.preventDefault()
    setErro('')
    const pendentes = validarFicha(respostas)
    if (pendentes.length) {
      setFaltando(pendentes)
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }
    setEnviando(true)
    try {
      await push(ref(db, 'fichas/' + link.personalId), {
        respostas, ts: Date.now(), status: 'nova'
      })
      setEnviada(true)
    } catch (err) {
      setErro('Não foi possível enviar. Confira sua conexão e tente de novo.')
      console.warn('Falha ao enviar ficha:', err)
    }
    setEnviando(false)
  }

  if (carregando) return <div className="loading">Carregando...</div>

  if (!link) {
    return (
      <div className="auth-wrap">
        <div className="auth-card">
          <div className="vazio-estado">
            <div className="ve-icone"><IcAlerta /></div>
            <h2>Link inválido</h2>
            <p className="muted">Este link de cadastro não existe ou foi desativado. Peça um novo ao seu personal.</p>
          </div>
        </div>
      </div>
    )
  }

  if (enviada) {
    return (
      <div className="auth-wrap">
        <div className="auth-card">
          <div className="vazio-estado">
            <div className="ve-icone ok"><IcCheck /></div>
            <h2>Ficha enviada</h2>
            <p className="muted">
              Pronto! {link.nome} recebeu seus dados e vai criar seu acesso.
              Você recebe o link de entrada em seguida.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="ficha-wrap">
      <div className="ficha-card">
        <header className="ficha-topo">
          <span className="ficha-marca">COACHAPP</span>
          <h1>Ficha de cadastro</h1>
          <p className="sub">Preencha para {link.nome} montar seu treino. Leva uns 2 minutos.</p>
        </header>

        <FormularioFicha
          respostas={respostas}
          onMudar={mudar}
          onEnviar={enviar}
          nomePersonal={link.nome}
          faltando={faltando}
          erro={erro}
          enviando={enviando}
        />
      </div>
    </div>
  )
}
