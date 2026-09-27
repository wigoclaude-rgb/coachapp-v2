import { createContext, useCallback, useContext, useEffect, useState } from 'react'

/*
  Confirmação de que a ação aconteceu — série marcada, dose registrada,
  pagamento informado. Some sozinho; nunca exige um toque a mais.

  Por que um contexto e não um estado por tela: o aviso precisa sobreviver à
  troca de tela. Quem informa o pagamento é levado para o status logo depois,
  e a confirmação tem que chegar junto, não ficar na tela que já saiu.
*/
const Ctx = createContext(() => {})

export function useAviso() { return useContext(Ctx) }

export function ProvedorDeAvisos({ children }) {
  const [avisos, setAvisos] = useState([])

  const avisar = useCallback((texto, opcoes = {}) => {
    const id = Math.random().toString(36).slice(2)
    setAvisos(a => [...a, { id, texto, tom: opcoes.tom || 'ok', acao: opcoes.acao, duracao: opcoes.duracao }])
    return id
  }, [])

  const fechar = useCallback(id => setAvisos(a => a.filter(x => x.id !== id)), [])

  return (
    <Ctx.Provider value={avisar}>
      {children}
      {avisos.length > 0 && (
        <div className="ui-avisos" role="status" aria-live="polite">
          {avisos.map(a => <Um key={a.id} {...a} aoFechar={() => fechar(a.id)} />)}
        </div>
      )}
    </Ctx.Provider>
  )
}

function Um({ texto, tom, acao, duracao, aoFechar }) {
  const [saindo, setSaindo] = useState(false)

  useEffect(() => {
    /* Erro fica até a pessoa ler; confirmação some. Um erro que pisca e some
       é um erro que ninguém viu. */
    const ms = duracao ?? (tom === 'perigo' ? 7000 : 3200)
    const t1 = setTimeout(() => setSaindo(true), ms)
    const t2 = setTimeout(aoFechar, ms + 200)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [duracao, tom, aoFechar])

  return (
    <div className={'ui-aviso ui-aviso-' + tom + (saindo ? ' ui-saindo' : '')}>
      <span className="ui-aviso-icone" aria-hidden="true">
        {tom === 'perigo' ? <IcErro /> : <IcOk />}
      </span>
      <span className="ui-aviso-txt">{texto}</span>
      {acao && <button className="ui-aviso-acao" onClick={() => { acao.aoTocar(); aoFechar() }}>{acao.rotulo}</button>}
    </div>
  )
}

const IcOk = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 6 9 17l-5-5" />
  </svg>
)
const IcErro = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <circle cx="12" cy="12" r="9" /><path d="M12 7v6M12 16.5v.5" />
  </svg>
)
