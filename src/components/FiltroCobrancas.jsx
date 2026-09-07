import { useState } from 'react'
import { IcBusca } from './Icones.jsx'
import { fmtMoeda } from '../lib/util'
import { STATUS_FILTRO, PERIODOS, ORDENS, filtroVazio, quantosAtivos } from '../lib/filtroCobrancas'

/*
  Barra de filtro do Financeiro.

  Os chips de status e a busca ficam sempre à vista, porque são o que se usa todo
  dia. Período, faixa de valor e ordenação ficam atrás de "Mais filtros": são
  úteis, mas ocupariam a tela inteira do celular se estivessem abertos sempre.
*/
export default function FiltroCobrancas({ filtro, onFiltro, totais, comBusca = true }) {
  const [aberto, setAberto] = useState(false)
  const ativos = quantosAtivos(filtro)
  const mudar = campo => valor => onFiltro({ ...filtro, [campo]: valor })

  return (
    <div className="fc">
      <div className="barra-filtros">
        {comBusca && (
          <div className="campo-busca">
            <IcBusca />
            <input
              value={filtro.busca}
              onChange={e => mudar('busca')(e.target.value)}
              placeholder="Buscar por aluno"
            />
          </div>
        )}
        <button
          className={'btn btn-sec btn-sm' + (aberto ? ' ativo' : '')}
          onClick={() => setAberto(!aberto)}
        >
          {aberto ? 'Menos filtros' : 'Mais filtros'}
          {!aberto && ativos > 0 && <span className="fc-conta">{ativos}</span>}
        </button>
        {ativos > 0 && (
          <button className="btn btn-sec btn-sm" onClick={() => onFiltro(filtroVazio())}>
            Limpar
          </button>
        )}
      </div>

      <div className="barra-filtros">
        {STATUS_FILTRO.map(s => (
          <button
            key={s.id}
            className={'filtro-chip ' + (filtro.status === s.id ? 'ativo' : '')}
            onClick={() => mudar('status')(s.id)}
          >
            {s.rotulo}
          </button>
        ))}
      </div>

      {aberto && (
        <div className="fc-painel">
          <div className="fc-campo">
            <label htmlFor="fc-per">Período de vencimento</label>
            <select id="fc-per" value={filtro.periodo} onChange={e => mudar('periodo')(e.target.value)}>
              {PERIODOS.map(p => <option key={p.id} value={p.id}>{p.rotulo}</option>)}
            </select>
          </div>

          {filtro.periodo === 'datas' && (
            <div className="fc-par">
              <div className="fc-campo">
                <label htmlFor="fc-de">De</label>
                <input id="fc-de" type="date" value={filtro.de} onChange={e => mudar('de')(e.target.value)} />
              </div>
              <div className="fc-campo">
                <label htmlFor="fc-ate">Até</label>
                <input id="fc-ate" type="date" value={filtro.ate} onChange={e => mudar('ate')(e.target.value)} />
              </div>
            </div>
          )}

          <div className="fc-par">
            <div className="fc-campo">
              <label htmlFor="fc-min">Valor a partir de</label>
              <input
                id="fc-min" type="number" min="0" step="0.01" placeholder="R$ 0,00"
                value={filtro.min} onChange={e => mudar('min')(e.target.value)}
              />
            </div>
            <div className="fc-campo">
              <label htmlFor="fc-max">Valor até</label>
              <input
                id="fc-max" type="number" min="0" step="0.01" placeholder="sem limite"
                value={filtro.max} onChange={e => mudar('max')(e.target.value)}
              />
            </div>
          </div>

          <div className="fc-campo">
            <label htmlFor="fc-ord">Ordenar por</label>
            <select id="fc-ord" value={filtro.ordem} onChange={e => mudar('ordem')(e.target.value)}>
              {ORDENS.map(o => <option key={o.id} value={o.id}>{o.rotulo}</option>)}
            </select>
          </div>
        </div>
      )}

      {/* Filtro sem total não responde "quanto isso dá" — que é a pergunta seguinte. */}
      {totais && (
        <div className="fc-totais">
          <div><span>{totais.quantidade}</span>{totais.quantidade === 1 ? ' cobrança' : ' cobranças'}</div>
          <div><span>{fmtMoeda(totais.total)}</span> no total</div>
          {totais.recebido > 0 && <div className="t-ok"><span>{fmtMoeda(totais.recebido)}</span> recebido</div>}
          {totais.vencido > 0 && <div className="t-erro"><span>{fmtMoeda(totais.vencido)}</span> vencido</div>}
          {totais.aguardando > 0 && <div className="t-analise"><span>{fmtMoeda(totais.aguardando)}</span> aguardando</div>}
        </div>
      )}
    </div>
  )
}
