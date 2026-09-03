import { useMemo, useState } from 'react'
import {
  ordenar, diasTreinados, sequenciaAtual, treinosNoMes, frequenciaDoMes,
  recordes, prsNoMes, melhoresResultados, porSemana, resumoDoDia,
  mesGrade, ESTADOS, conquistas, semanasSeguidas, diaISO
} from '../lib/evolucao'
import EvolucaoCorporal from './EvolucaoCorporal.jsx'
import { IcFogo, IcCalendario, IcTrofeu, IcEvolucao, IcHalter } from './Icones.jsx'

/*
  Central de evolução do aluno.

  A tela responde três perguntas, nesta ordem: estou treinando com constância,
  estou ficando mais forte, meu corpo está mudando. Cada seção existe para
  responder uma delas — e some quando não tem dado, em vez de mostrar zero.
*/

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
const MESES_LONGOS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
]
// Domingo primeiro, como nos calendários brasileiros.
const DOW = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']

const METRICAS = [
  { id: 'carga', rotulo: 'Carga', unidade: 'kg', ajuda: 'Maior peso levantado na semana.' },
  { id: 'series', rotulo: 'Séries', unidade: '', ajuda: 'Séries registradas na semana.' },
  { id: 'dias', rotulo: 'Frequência', unidade: 'dias', ajuda: 'Dias treinados na semana.' }
]

/** Gráfico de barras enxuto. Sem eixos nem grade — a comparação entre semanas basta. */
function Barras({ pontos, campo, unidade }) {
  const max = Math.max(...pontos.map(p => p[campo]), 1)
  const temAlgo = pontos.some(p => p[campo] > 0)
  if (!temAlgo) return <p className="muted ev-sem-grafico">Ainda não há registros suficientes.</p>

  return (
    <div className="ev-barras" role="img" aria-label={`Evolução por semana em ${campo}`}>
      {pontos.map((p, i) => {
        const alt = p[campo] > 0 ? Math.max(4, (p[campo] / max) * 100) : 0
        const ultimo = i === pontos.length - 1
        return (
          <div key={i} className="ev-barra-col" title={`Semana de ${p.rotulo}: ${p[campo]} ${unidade}`}>
            <span className="ev-barra-valor">{p[campo] > 0 ? p[campo] : ''}</span>
            <div className={'ev-barra' + (ultimo ? ' atual' : '')} style={{ height: alt + '%' }} />
            <span className="ev-barra-rot">{p.rotulo}</span>
          </div>
        )
      })}
    </div>
  )
}

export default function Evolucao({ execucoes, avaliacoes, diasSemana, nomeDoDia }) {
  const [metrica, setMetrica] = useState('carga')
  const [diaAberto, setDiaAberto] = useState(null)
  const [mesVisto, setMesVisto] = useState(() => {
    const h = new Date()
    return { ano: h.getFullYear(), mes: h.getMonth() }
  })

  const lista = useMemo(() => ordenar(execucoes), [execucoes])
  const dias = useMemo(() => diasTreinados(lista), [lista])
  const { melhor, marcos } = useMemo(() => recordes(lista), [lista])

  const sequencia = sequenciaAtual(dias)
  const noMes = treinosNoMes(dias)
  const freq = frequenciaDoMes(dias, diasSemana)
  const prs = prsNoMes(marcos)
  const semanas = semanasSeguidas(dias)

  const evolucao = useMemo(() => melhoresResultados(melhor), [melhor])
  const semanal = useMemo(() => porSemana(lista, 12), [lista])
  const celulas = useMemo(
    () => mesGrade(mesVisto.ano, mesVisto.mes, dias, diasSemana),
    [mesVisto, dias, diasSemana]
  )

  const agora = new Date()
  const ehMesAtual = mesVisto.ano === agora.getFullYear() && mesVisto.mes === agora.getMonth()

  /** Muda de mês e fecha o dia aberto — ele não existe mais na grade nova. */
  function mudarMes(passo) {
    setDiaAberto(null)
    setMesVisto(m => {
      const d = new Date(m.ano, m.mes + passo, 1)
      return { ano: d.getFullYear(), mes: d.getMonth() }
    })
  }
  const marcosLista = useMemo(() => conquistas(dias, marcos, semanas), [dias, marcos, semanas])
  const resumo = useMemo(
    () => (diaAberto ? resumoDoDia(lista, diaAberto, marcos) : null),
    [lista, diaAberto, marcos]
  )

  const nuncaTreinou = dias.size === 0

  if (nuncaTreinou) {
    return (
      <div className="card">
        <div className="vazio-estado">
          <div className="ve-icone"><IcEvolucao /></div>
          <h2>Sua evolução começa no primeiro treino</h2>
          <p className="muted">
            Assim que você marcar as primeiras séries, esta tela passa a mostrar sua
            constância, seus recordes e o quanto você evoluiu em cada exercício.
          </p>
        </div>
      </div>
    )
  }

  const metricaAtual = METRICAS.find(m => m.id === metrica)

  return (
    <>
      {/* ---------- 1. estou treinando bem? ---------- */}
      <div className="ev-kpis">
        <div className="ev-kpi">
          <span className="ev-kpi-num">{noMes}</span>
          <span className="ev-kpi-rot">treinos este mês</span>
        </div>

        <div className="ev-kpi">
          <span className="ev-kpi-num">
            {freq.tipo === 'pct' ? (freq.valor === null ? '—' : freq.valor + '%') : freq.valor + 'x'}
          </span>
          <span className="ev-kpi-rot">
            {freq.tipo === 'pct' ? 'do previsto' : 'por semana'}
          </span>
        </div>

        <div className="ev-kpi">
          <span className="ev-kpi-num">{sequencia}</span>
          <span className="ev-kpi-rot">
            {sequencia === 1 ? 'dia seguido' : 'dias seguidos'}
          </span>
        </div>

        <div className="ev-kpi">
          <span className="ev-kpi-num">{prs}</span>
          <span className="ev-kpi-rot">
            {prs === 1 ? 'recorde no mês' : 'recordes no mês'}
          </span>
        </div>
      </div>

      {freq.tipo === 'media' && (
        <p className="ev-nota">
          Seu personal ainda não definiu em quais dias você treina. Com isso definido,
          aqui aparece o quanto você cumpriu do combinado.
        </p>
      )}

      {/* ---------- 2. calendário como histórico ---------- */}
      <div className="card">
        <div className="card-titulo">
          <div style={{ minWidth: 0 }}>
            <h2>Histórico</h2>
            <p className="mini">Toque num dia treinado para ver o que você fez.</p>
          </div>
        </div>

        <div className="ev-cal">
          <div className="ev-mes-nav">
            <button
              type="button" className="ev-nav" onClick={() => mudarMes(-1)}
              aria-label="Mês anterior"
            >‹</button>
            <span className="ev-mes-nome">{MESES_LONGOS[mesVisto.mes]} de {mesVisto.ano}</span>
            <button
              type="button" className="ev-nav" onClick={() => mudarMes(1)}
              disabled={ehMesAtual}
              aria-label="Próximo mês"
            >›</button>
          </div>

          <div className="ev-mes-dow">
            {DOW.map((d, i) => <span key={i}>{d}</span>)}
          </div>

          <div className="ev-mes-grade">
            {celulas.map(c => (
              <button
                key={c.iso}
                type="button"
                className={
                  'ev-cel ' + c.estado +
                  (c.doMes ? '' : ' fora') +
                  (c.ehHoje ? ' hoje' : '') +
                  (c.iso === diaAberto ? ' aberto' : '')
                }
                onClick={() => setDiaAberto(c.treinou ? (diaAberto === c.iso ? null : c.iso) : null)}
                disabled={!c.treinou}
                aria-label={`${c.dia} de ${MESES_LONGOS[mesVisto.mes]}${c.treinou ? ', treinou' : ''}`}
              >
                {c.dia}
              </button>
            ))}
          </div>

          {/* A amostra usa a mesma classe das células, para nunca descrever outra coisa. */}
          <div className="ev-legenda">
            <span><i className="ev-cel treinou" /> treinou</span>
            {diasSemana?.length > 0 && (
              <span><i className="ev-cel perdido" /> dia de treino sem registro</span>
            )}
            <span><i className="ev-cel" /> descanso</span>
          </div>
        </div>

        {resumo && (
          <div className="ev-dia-resumo">
            <div className="ev-dr-topo">
              <strong>
                {Number(resumo.dia.slice(8))} de {MESES[Number(resumo.dia.slice(5, 7)) - 1]}
              </strong>
              <span className="ev-dr-selo">Concluído</span>
            </div>
            <div className="ev-dr-nums">
              {resumo.minutos && <span><strong>{resumo.minutos}</strong> min</span>}
              <span><strong>{resumo.exercicios.length}</strong> exercícios</span>
              <span><strong>{resumo.series}</strong> séries</span>
              {resumo.prs > 0 && <span className="ev-dr-pr"><strong>+{resumo.prs}</strong> recorde{resumo.prs > 1 ? 's' : ''}</span>}
            </div>
            <p className="ev-dr-lista">{resumo.exercicios.join(' · ')}</p>
            {resumo.reduzidas > 0 && (
              <p className="mini">
                {resumo.reduzidas} série{resumo.reduzidas > 1 ? 's' : ''} com carga abaixo do plano.
              </p>
            )}
          </div>
        )}
      </div>

      {/* ---------- 3. estou ficando mais forte? ---------- */}
      <div className="card">
        <div className="card-titulo">
          <div style={{ minWidth: 0 }}>
            <h2>Evolução de desempenho</h2>
            <p className="mini">{metricaAtual.ajuda}</p>
          </div>
        </div>

        <div className="ev-filtros" role="tablist">
          {METRICAS.map(m => (
            <button
              key={m.id} type="button" role="tab"
              aria-selected={metrica === m.id}
              className={'ev-filtro' + (metrica === m.id ? ' ativo' : '')}
              onClick={() => setMetrica(m.id)}
            >
              {m.rotulo}
            </button>
          ))}
        </div>

        <Barras pontos={semanal} campo={metrica} unidade={metricaAtual.unidade} />
      </div>

      {evolucao.length > 0 && (
        <div className="card">
          <div className="card-titulo">
            <div style={{ minWidth: 0 }}>
              <h2>Melhores resultados</h2>
              <p className="mini">Do primeiro registro até a sua melhor carga.</p>
            </div>
          </div>
          {evolucao.map(r => (
            <div key={r.exercicio} className="ev-res">
              <div className="ev-res-txt">
                <span className="ev-res-nome">{r.exercicio}</span>
                <span className="ev-res-de-para">{r.de} kg → {r.para} kg</span>
              </div>
              <span className="ev-res-ganho">+{r.ganho} kg</span>
            </div>
          ))}
        </div>
      )}

      {/* ---------- 4. meu corpo está mudando? ---------- */}
      <EvolucaoCorporal avaliacoes={avaliacoes} />

      {marcosLista.length > 0 && (
        <div className="card">
          <div className="card-titulo">
            <h2>Conquistas</h2>
          </div>
          <div className="ev-conquistas">
            {marcosLista.map(c => (
              <div key={c.id} className="ev-conq">
                <span className="ev-conq-tit">{c.titulo}</span>
                <span className="ev-conq-desc">{c.desc}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  )
}
