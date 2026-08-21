import { useEffect, useMemo, useState } from 'react'
import { ref, onValue } from 'firebase/database'
import { db } from '../firebase'
import { imagemExercicio, comKg } from '../lib/util'
import {
  LETRAS, normalizarPlano, indiceSeguro, duracaoEstimada, totalSeries,
  agruparBlocos, chaveSerie, resumoExercicio
} from '../lib/treinoModel'
import { IcCheck, IcFechar, IcTrofeu } from './Icones.jsx'

/*
  Mostra ao personal a mesma tela que o aluno está vendo hoje: qual treino do
  ciclo caiu, o que já foi marcado e como cada exercício aparece.

  É espelho, não controle — nada aqui grava. As séries mostram o estado, mas não
  respondem ao toque; quem marca é o aluno, na academia.

  Reaproveita as classes .tr-* da tela do aluno de propósito: se o desenho de lá
  mudar, esta prévia acompanha sozinha e continua fiel.
*/
export default function PreviaTreinoAluno({ alunoId, nome, onFechar }) {
  const [treinoBruto, setTreinoBruto] = useState(null)
  const [execucoes, setExecucoes] = useState({})
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    const u1 = onValue(ref(db, 'treinos/' + alunoId), s => {
      setTreinoBruto(s.exists() ? s.val() : null)
      setCarregando(false)
    })
    const u2 = onValue(ref(db, 'execucoes/' + alunoId), s => setExecucoes(s.val() || {}))
    return () => { u1(); u2() }
  }, [alunoId])

  /* Séries marcadas hoje — é o que o aluno enxerga como progresso do dia. */
  const feitas = useMemo(() => {
    const hoje = new Date().toDateString()
    const f = {}
    Object.values(execucoes).forEach(e => {
      if (new Date(e.ts).toDateString() === hoje) f[e.exercicio + '_' + e.serie] = true
    })
    return f
  }, [execucoes])

  const plano = useMemo(() => normalizarPlano(treinoBruto), [treinoBruto])
  const totalDias = plano ? plano.lista.length : 0
  const idxAtual = plano ? indiceSeguro(plano.indiceAtual, totalDias) : 0
  const diaAtual = plano ? plano.lista[idxAtual] : null
  const exercicios = diaAtual?.exercicios || []
  const ciclico = totalDias > 1

  const blocos = useMemo(() => agruparBlocos(exercicios), [exercicios])
  const seriesDoDia = totalSeries(exercicios)
  const feitasHoje = exercicios.reduce((soma, e) => {
    let n = 0
    for (let s = 1; s <= e.linhas.length; s++) if (feitas[chaveSerie(e.nome, s)]) n++
    return soma + n
  }, 0)
  const pct = seriesDoDia ? Math.round((feitasHoje / seriesDoDia) * 100) : 0
  const completo = seriesDoDia > 0 && feitasHoje >= seriesDoDia
  const minutos = duracaoEstimada(exercicios)
  const primeiro = (nome || '').split(' ')[0] || 'o aluno'

  return (
    <div className="espiada" onClick={onFechar}>
      <div className="espiada-caixa" onClick={e => e.stopPropagation()}>
        <header className="espiada-topo">
          <div>
            <span className="espiada-letra">Visão do aluno</span>
            <h2>O que {primeiro} está vendo</h2>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onFechar} title="Fechar"><IcFechar /></button>
        </header>

        <div className="espiada-corpo">
          {carregando && <p className="muted">Carregando...</p>}

          {!carregando && !plano && (
            <div className="vazio-estado">
              <h2>Sem treino montado</h2>
              <p className="muted">{primeiro} abre o app e não encontra nada. Monte o plano em "Treino".</p>
            </div>
          )}

          {plano && (
            <>
              <p className="previa-nota">
                Espelho da tela dele. As séries mostram o que ele já marcou hoje — aqui não dá para marcar.
              </p>

              <section className="tr-hero">
                <div className="tr-cab">
                  <span className="tr-data">Hoje</span>
                  {ciclico && (
                    <div className="tr-ciclo">
                      {plano.lista.map((d, i) => (
                        <span
                          key={i}
                          className={'tr-passo' + (i === idxAtual ? ' agora' : i < idxAtual ? ' feito' : '')}
                          title={d.nome}
                        >
                          {LETRAS[i] || i + 1}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <h2 className="tr-nome">{diaAtual?.nome || plano.nome}</h2>

                <div className="tr-progresso">
                  <div className="tr-numeros">
                    <strong>{feitasHoje}</strong>
                    <span>de {seriesDoDia} séries</span>
                    <span className="tr-restante">~{minutos} min</span>
                  </div>
                  <div className="tr-barra"><div className="tr-barra-fill" style={{ width: pct + '%' }} /></div>
                </div>

                {completo && (
                  <div className="tr-pronto">
                    <span className="tr-pronto-icone"><IcTrofeu /></span>
                    <div>
                      <strong>Treino de hoje concluído</strong>
                      <span>{seriesDoDia} séries registradas.</span>
                    </div>
                  </div>
                )}
              </section>

              <div className="section-title">Exercícios de hoje</div>

              {blocos.map((b, i) => (
                <div key={i} className={'tr-bloco' + (b.combinado ? ' biset' : '')}>
                  {b.combinado && <span className="tr-biset-tag">Bi-set</span>}
                  {b.exercicios.map((ex, k) => {
                    const total = ex.linhas.length
                    let n = 0
                    for (let s = 1; s <= total; s++) if (feitas[chaveSerie(ex.nome, s)]) n++
                    const exOk = total > 0 && n >= total
                    const img = imagemExercicio(ex)
                    return (
                      <div key={k} className={'tr-ex aberto' + (exOk ? ' feito' : '')}>
                        <div className="tr-ex-cab" style={{ cursor: 'default' }}>
                          {img
                            ? <img
                                src={img} alt="" className="tr-ex-foto" loading="lazy"
                                onError={e => { e.currentTarget.style.visibility = 'hidden' }}
                              />
                            : <span className="tr-ex-marca">{exOk ? <IcCheck /> : i + 1}</span>}
                          <span className="tr-ex-txt">
                            <span className="tr-ex-nome">{ex.nome}</span>
                            <span className="tr-ex-meta">{resumoExercicio(ex)}</span>
                          </span>
                          <span className={'tr-ex-cont' + (exOk ? ' ok' : '')}>
                            {exOk ? <IcCheck /> : `${n}/${total}`}
                          </span>
                        </div>

                        <div className="tr-ex-corpo">
                          {ex.obs && <p className="tr-ex-obs">{ex.obs}</p>}
                          <div className="tr-series">
                            {ex.linhas.map((linha, li) => {
                              const s = li + 1
                              const feita = !!feitas[chaveSerie(ex.nome, s)]
                              return (
                                <div key={s} className={'tr-serie previa' + (feita ? ' feita' : '')}>
                                  <span className="tr-serie-n">{feita ? <IcCheck /> : s + 'ª'}</span>
                                  <span className="tr-serie-alvo">
                                    {linha.reps}{linha.carga ? ' · ' + comKg(linha.carga) : ''}
                                  </span>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
