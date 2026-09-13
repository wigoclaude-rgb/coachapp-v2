import { useState } from 'react'
import {
  IcCheck, IcHalter, IcSeta, IcSuplemento, IcCalendario, IcChat,
  IcPagamentos, IcEvolucao, IcTreino, IcSino, IcMais
} from '../Icones.jsx'

/*
  A Home do aluno.

  Um foco por vez. Antes o app abria direto na execução do treino — útil na hora
  de treinar, desorientador nas outras vinte horas do dia, quando a pergunta é
  "o que eu preciso fazer agora?" e a resposta pode ser uma dose, um check-in,
  uma mensagem ou uma cobrança.

  O que decide o conteúdo e a ordem é `src/lib/painel.js`. Aqui só se desenha.

  Sobre os números: nenhum é inventado. Frequência sai de `frequenciaDoMes` (dias
  treinados sobre os previstos pelo personal) e a carga de `evolucaoDeCarga`
  (média do ganho por exercício desde a primeira vez). Quando não há base, o
  bloco não aparece — 0% para quem começou ontem é pior que silêncio.
*/

const ICONES = {
  treino: <IcTreino />, suplemento: <IcSuplemento />, checkin: <IcCalendario />,
  chat: <IcChat />, pagamento: <IcPagamentos />
}
const ICONES_ACAO = {
  treino: <IcTreino />, suplementos: <IcSuplemento />, diario: <IcCalendario />,
  chat: <IcChat />, pagamentos: <IcPagamentos />, evolucao: <IcEvolucao />
}

/* Anel de progresso em SVG. Sem biblioteca: é um círculo com dash offset. */
function Anel({ pct }) {
  const r = 26
  const volta = 2 * Math.PI * r
  return (
    <svg className="in-anel" viewBox="0 0 64 64" aria-hidden="true">
      <circle cx="32" cy="32" r={r} className="in-anel-trilho" />
      <circle
        cx="32" cy="32" r={r} className="in-anel-valor"
        strokeDasharray={volta}
        strokeDashoffset={volta * (1 - Math.max(0, Math.min(100, pct)) / 100)}
      />
    </svg>
  )
}

export default function Inicio({ painel, resumo, proximo, atualizacoes = [], onIr, carregando, erro }) {
  const [verMais, setVerMais] = useState(false)

  if (carregando) {
    return <div className="in"><div className="in-esqueleto" /><div className="in-esqueleto curto" /></div>
  }

  const { saudacao, foco, pendencias, acoes, tudoEmDia } = painel
  const freq = resumo?.frequencia
  const freqPct = freq?.tipo === 'pct' && freq.valor !== null ? freq.valor : null

  return (
    <div className="in">
      <header className="in-topo">
        <div>
          <h2>{saudacao.texto}</h2>
          <p>Aqui está o que você precisa saber hoje.</p>
        </div>
        <span className="in-data"><IcCalendario /> {saudacao.data}</span>
      </header>

      {erro && <div className="erro">{erro}</div>}

      <div className="in-grade">
        <div className="in-col">
          {/* ---------- o foco ---------- */}
          <section className={'in-foco ' + foco.tipo}>
            <span className="in-foco-rot">
              {foco.tipo === 'bloqueado' ? 'Precisa resolver'
                : foco.tipo === 'descanso' ? 'Hoje'
                : foco.tipo === 'treino_concluido' ? 'Concluído'
                : foco.tipo === 'sem_plano' ? 'Seu treino'
                : foco.tipo === 'treino_andamento' ? 'Treino em andamento'
                : 'Seu treino de hoje'}
            </span>

            <h3>{foco.titulo}</h3>

            {foco.exercicios?.length > 0 && (
              <p className="in-foco-ex">
                {foco.exercicios.slice(0, 2).join(' · ')}
                {foco.exercicios.length > 2 && ` · +${foco.exercicios.length - 2}`}
              </p>
            )}

            <div className="in-foco-meta">
              <span><IcHalter /> {foco.subtitulo}</span>
            </div>

            {typeof foco.progresso === 'number' && foco.progresso > 0 && foco.progresso < 100 && (
              <div className="in-barra"><div className="in-barra-fill" style={{ width: foco.progresso + '%' }} /></div>
            )}

            {foco.acao && (
              <button className="btn in-foco-btn" onClick={() => onIr(foco.acao.aba)}>
                {foco.acao.rotulo}
              </button>
            )}
          </section>

          {/* ---------- ações rápidas ---------- */}
          <section className="in-secao">
            <h4>Ações rápidas</h4>
            <div className="in-acoes">
              {acoes.grade.map(a => (
                <button
                  key={a.id}
                  className={'in-acao' + (a.destaque ? ' destaque' : '')}
                  onClick={() => onIr(a.aba)}
                >
                  <span className="in-acao-icone">{ICONES_ACAO[a.aba] || <IcTreino />}</span>
                  <strong>{a.rotulo}</strong>
                  <span>{a.sub}</span>
                </button>
              ))}
              {acoes.resto.length > 0 && (
                <button className="in-acao" onClick={() => setVerMais(true)}>
                  <span className="in-acao-icone"><IcMais /></span>
                  <strong>Ver mais</strong>
                  <span>Outras telas</span>
                </button>
              )}
            </div>
          </section>

          {/* ---------- pendências: linhas, não cards ---------- */}
          {pendencias.length > 0 && (
            <section className="in-secao">
              <h4>Pendências de hoje</h4>
              <ul className="in-pend">
                {pendencias.map(p => (
                  <li key={p.id} className={p.urgente ? 'urgente' : ''}>
                    <button className="in-pend-linha" onClick={() => onIr(p.acao.aba)}>
                      <span className="in-pend-icone">{ICONES[p.tipo]}</span>
                      <span className="in-pend-txt">
                        <strong>{p.titulo}</strong>
                        <span>{p.detalhe}</span>
                      </span>
                      <span className="in-pend-lado">
                        {p.selo && <span className="in-selo">{p.selo}</span>}
                        <span className="in-pend-acao">{p.acao.rotulo} <IcSeta /></span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {tudoEmDia && (
            <p className="in-em-dia"><IcCheck /> Nada pendente. Seu dia está resolvido.</p>
          )}
        </div>

        {/* ---------- coluna lateral ---------- */}
        <aside className="in-lado">
          {resumo && (
            <section className="in-secao">
              <h4><IcEvolucao /> Sua evolução</h4>
              <div className="in-evo">
                {freqPct !== null && <Anel pct={freqPct} />}
                <div>
                  <strong>
                    {freqPct !== null ? freqPct + '%' : (freq?.valor ?? '—')}
                  </strong>
                  <span>
                    {freqPct !== null
                      ? 'da frequência do mês'
                      : freq?.valor != null ? 'treinos por semana' : 'sem dados ainda'}
                  </span>
                </div>
              </div>

              <div className="in-evo-nums">
                <div><span>Treinos</span><strong>{resumo.treinos}</strong></div>
                <div><span>Sequência</span><strong>{resumo.sequencia}d</strong></div>
                {resumo.carga && (
                  <div><span>Cargas</span><strong className="sobe">+{resumo.carga.pct}%</strong></div>
                )}
              </div>

              <button className="in-link" onClick={() => onIr('evolucao')}>
                Ver evolução <IcSeta />
              </button>
            </section>
          )}

          {proximo && (
            <section className="in-secao">
              <h4><IcCalendario /> Próximo treino</h4>
              <p className="in-prox-quando">{proximo.quando}</p>
              <strong className="in-prox-nome">{proximo.nome}</strong>
              <button className="in-link" onClick={() => onIr('treino')}>
                Ver treino <IcSeta />
              </button>
            </section>
          )}

          {atualizacoes.length > 0 && (
            <section className="in-secao">
              <h4><IcSino /> Atualizações</h4>
              <ul className="in-avisos">
                {atualizacoes.map(a => (
                  <li key={a.id}>
                    <span className="in-aviso-icone"><IcSino /></span>
                    <span>
                      <strong>{a.texto}</strong>
                      <span>{quando(a.ts)}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </aside>
      </div>

      {/* ---------- "Ver mais" ---------- */}
      {verMais && (
        <div className="fd-fundo" onClick={() => setVerMais(false)}>
          <div className="fd" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">
            <h2>Ir para</h2>
            <ul className="fd-lista">
              {acoes.resto.map(a => (
                <li key={a.id}>
                  <button className="fd-item" onClick={() => { setVerMais(false); onIr(a.aba) }}>
                    <span className="fd-item-selo">{ICONES_ACAO[a.aba] || <IcTreino />}</span>
                    <span className="fd-item-txt"><strong>{a.rotulo}</strong></span>
                    <span className="fd-item-acao"><IcSeta /></span>
                  </button>
                </li>
              ))}
            </ul>
            <div className="fd-rodape">
              <button className="btn btn-sec btn-sm" onClick={() => setVerMais(false)}>Fechar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* "Hoje · 10:24" / "Ontem" / "12/09" — a mesma régua do resto do app. */
function quando(ts) {
  if (!ts) return ''
  const d = new Date(ts)
  const hoje = new Date()
  const mesmoDia = (a, b) => a.toDateString() === b.toDateString()
  const hora = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0')
  if (mesmoDia(d, hoje)) return `Hoje · ${hora}`
  const ontem = new Date(hoje)
  ontem.setDate(ontem.getDate() - 1)
  if (mesmoDia(d, ontem)) return `Ontem · ${hora}`
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')} · ${hora}`
}
