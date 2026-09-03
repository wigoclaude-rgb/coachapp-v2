import { useState } from 'react'
import {
  resumoSuplemento, aderencia, sequencia, motivoPausa, estaPausado, diaISO
} from '../../lib/suplementos'
import { IcEditar, IcLixeira, IcRelogio, IcSeta } from '../Icones.jsx'

const PAUSAS = [
  { dias: 1, rotulo: '1 dia' },
  { dias: 7, rotulo: '7 dias' },
  { dias: 30, rotulo: '30 dias' }
]

/*
  Card de um suplemento cadastrado — seção de gerenciamento, não de ação.

  Editar e Excluir ficam atrás do menu: são raras, e a lixeira permanentemente ao
  lado do lápis é um convite ao toque errado.
*/
export default function CardSuplemento({ sup, tomados, onEditar, onPausar, onRetomar, onExcluir }) {
  const [menu, setMenu] = useState(false)
  const [escolhendoPausa, setEscolhendoPausa] = useState(false)

  const ades = aderencia(sup, sup.id, tomados, 30)
  const seq = sequencia(sup, sup.id, tomados)
  const pausa = motivoPausa(sup)
  const pausado = estaPausado(sup)

  function pausarPor(dias) {
    const ate = new Date()
    ate.setDate(ate.getDate() + dias - 1)
    onPausar(sup, diaISO(ate))
    setEscolhendoPausa(false)
    setMenu(false)
  }

  return (
    <div className={'sp-card' + (pausado ? ' pausado' : '')}>
      <div className="sp-card-topo">
        <div style={{ minWidth: 0 }}>
          <div className="sp-card-nome">
            {sup.nome}
            {sup.marca && <span className="sp-card-marca">{sup.marca}</span>}
          </div>
          <div className="sp-card-resumo">{resumoSuplemento(sup)}</div>
        </div>

        <div className="sp-menu-wrap">
          <button
            type="button" className="sp-menu-btn"
            onClick={() => { setMenu(m => !m); setEscolhendoPausa(false) }}
            aria-expanded={menu}
            aria-label={`Ações de ${sup.nome}`}
          >⋯</button>

          {menu && (
            <>
              <div className="sp-menu-fundo" onClick={() => setMenu(false)} />
              <div className="sp-menu" role="menu">
                {escolhendoPausa ? (
                  <>
                    <span className="sp-menu-tit">Pausar por</span>
                    {PAUSAS.map(p => (
                      <button key={p.dias} type="button" role="menuitem" onClick={() => pausarPor(p.dias)}>
                        {p.rotulo}
                      </button>
                    ))}
                    <label className="sp-menu-data">
                      <span>Até uma data</span>
                      <input
                        type="date"
                        min={diaISO()}
                        onChange={e => {
                          if (!e.target.value) return
                          onPausar(sup, e.target.value)
                          setEscolhendoPausa(false); setMenu(false)
                        }}
                      />
                    </label>
                    <button type="button" role="menuitem" onClick={() => setEscolhendoPausa(false)}>Voltar</button>
                  </>
                ) : (
                  <>
                    <button type="button" role="menuitem" onClick={() => { onEditar(sup); setMenu(false) }}>
                      <IcEditar /> Editar
                    </button>
                    {pausado ? (
                      <button type="button" role="menuitem" onClick={() => { onRetomar(sup); setMenu(false) }}>
                        <IcRelogio /> Retomar agora
                      </button>
                    ) : (
                      <button type="button" role="menuitem" onClick={() => setEscolhendoPausa(true)}>
                        <IcRelogio /> Pausar <IcSeta />
                      </button>
                    )}
                    <button
                      type="button" role="menuitem" className="perigo"
                      onClick={() => { onExcluir(sup); setMenu(false) }}
                    >
                      <IcLixeira /> Excluir
                    </button>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {pausa && <span className="sp-selo-pausa">{pausa}</span>}

      {!pausado && (
        <div className="sp-card-nums">
          <span>
            {ades ? <><strong>{ades.pct}%</strong> de adesão · {ades.cumpridas} de {ades.esperadas} doses</>
                  : 'Sem doses previstas ainda'}
          </span>
          {seq > 0 && <span><strong>{seq}</strong> {seq === 1 ? 'dia seguido' : 'dias seguidos'}</span>}
        </div>
      )}

      {sup.observacao && <p className="sp-card-obs">{sup.observacao}</p>}
    </div>
  )
}
