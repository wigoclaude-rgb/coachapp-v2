import { useEffect, useMemo, useState } from 'react'
import { ref, onValue, push } from 'firebase/database'
import { db } from '../firebase'
import { imagemExercicio, comKg } from '../lib/util'
import {
  LETRAS, normalizarPlano, indiceSeguro, duracaoEstimada, totalSeries,
  agruparBlocos, chaveSerie, resumoExercicio
} from '../lib/treinoModel'
import { IcCheck, IcFechar, IcTrofeu, IcHalter } from './Icones.jsx'

/*
  Tela do treino do dia de um uid qualquer. Serve a três usos:

    - o personal espiando o treino do aluno   (modal, sem marcar)
    - o personal treinando o próprio treino   (embutido, marcando)
    - qualquer futuro "ver treino de alguém"

  `podeMarcar` decide se as séries respondem ao toque. Quando o personal olha o
  aluno é sempre false: quem toma a carga é quem está na academia, e marcar por
  ele transformaria o histórico em ficção.
*/
export default function TreinoDoDia({
  uid, nome, podeMarcar = false, embutido = false, onFechar, onProgramar
}) {
  const [treinoBruto, setTreinoBruto] = useState(null)
  const [execucoes, setExecucoes] = useState({})
  const [carregando, setCarregando] = useState(true)
  const [pesos, setPesos] = useState({})
  const [erro, setErro] = useState('')

  useEffect(() => {
    if (!uid) return
    const u1 = onValue(ref(db, 'treinos/' + uid), s => {
      setTreinoBruto(s.exists() ? s.val() : null)
      setCarregando(false)
    })
    const u2 = onValue(ref(db, 'execucoes/' + uid), s => setExecucoes(s.val() || {}))
    return () => { u1(); u2() }
  }, [uid])

  /* Séries marcadas hoje — é o que conta como progresso do dia. */
  const feitas = useMemo(() => {
    const hoje = new Date().toDateString()
    const f = {}
    Object.values(execucoes).forEach(e => {
      if (new Date(e.ts).toDateString() === hoje) f[e.exercicio + '_' + e.serie] = true
    })
    return f
  }, [execucoes])

  /** Última carga registrada, ignorando as séries de hoje. */
  const cargaAnterior = useMemo(() => {
    const mapa = {}
    const hoje = new Date().toDateString()
    Object.values(execucoes)
      .sort((a, b) => b.ts - a.ts)
      .forEach(e => {
        if (new Date(e.ts).toDateString() === hoje) return
        if (mapa[e.exercicio] === undefined && e.peso) mapa[e.exercicio] = Number(e.peso)
      })
    return n => mapa[n] ?? null
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
  const primeiro = (nome || '').split(' ')[0]

  async function marcar(ex, serie, linha) {
    if (!podeMarcar || feitas[chaveSerie(ex.nome, serie)]) return
    const alvo = Number(linha.carga) || 0
    const digitado = pesos[ex.nome]
    const peso = digitado !== undefined && digitado !== '' ? Number(digitado) : alvo

    if (alvo > 0 && peso < alvo) {
      setErro(`A carga não pode ser menor que ${alvo} kg neste exercício.`)
      return
    }
    try {
      await push(ref(db, 'execucoes/' + uid), {
        exercicio: ex.nome, serie, peso: peso || '', ts: Date.now()
      })
      setErro('')
      setPesos(p => ({ ...p, [ex.nome]: '' }))
    } catch (e) {
      setErro('Não foi possível registrar a série. Tente de novo.')
      console.warn('Falha ao marcar série:', e)
    }
  }

  const conteudo = (
    <>
      {carregando && <p className="muted">Carregando...</p>}

      {!carregando && !plano && (
        <div className="vazio-estado">
          <div className="ve-icone"><IcHalter /></div>
          <h2>Nenhum treino montado</h2>
          <p className="muted">
            {podeMarcar
              ? 'Monte o seu plano para começar a registrar os treinos.'
              : `${primeiro || 'O aluno'} abre o app e não encontra nada. Monte o plano em "Treino".`}
          </p>
          {onProgramar && (
            <button className="btn btn-sm btn-auto" style={{ marginTop: 14 }} onClick={onProgramar}>
              Montar treino
            </button>
          )}
        </div>
      )}

      {plano && (
        <>
          {!podeMarcar && (
            <p className="previa-nota">
              Espelho da tela dele. As séries mostram o que ele já marcou hoje — aqui não dá para marcar.
            </p>
          )}

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

          {erro && <div className="erro">{erro}</div>}

          <div className="section-title">
            Exercícios de hoje
            {podeMarcar && <span className="st-dica">Toque na série para marcar</span>}
          </div>

          {blocos.map((b, i) => (
            <div key={i} className={'tr-bloco' + (b.combinado ? ' biset' : '')}>
              {b.combinado && <span className="tr-biset-tag">Bi-set</span>}
              {b.exercicios.map((ex, k) => {
                const total = ex.linhas.length
                let n = 0
                for (let s = 1; s <= total; s++) if (feitas[chaveSerie(ex.nome, s)]) n++
                const exOk = total > 0 && n >= total
                const img = imagemExercicio(ex)
                const anterior = cargaAnterior(ex.nome)
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

                      {podeMarcar && anterior && (
                        <p className="tr-ex-anterior">
                          Da última vez você usou <strong>{comKg(anterior)}</strong>
                        </p>
                      )}

                      <div className="tr-series">
                        {ex.linhas.map((linha, li) => {
                          const s = li + 1
                          const feita = !!feitas[chaveSerie(ex.nome, s)]
                          const rotulo = (
                            <>
                              <span className="tr-serie-n">{feita ? <IcCheck /> : s + 'ª'}</span>
                              <span className="tr-serie-alvo">
                                {linha.reps}{linha.carga ? ' · ' + comKg(linha.carga) : ''}
                              </span>
                            </>
                          )
                          return podeMarcar ? (
                            <button
                              key={s} type="button"
                              className={'tr-serie' + (feita ? ' feita' : '')}
                              onClick={() => marcar(ex, s, linha)}
                              disabled={feita}
                              title={feita ? `Série ${s} registrada` : `Marcar a série ${s}`}
                            >
                              {rotulo}
                            </button>
                          ) : (
                            <div key={s} className={'tr-serie previa' + (feita ? ' feita' : '')}>
                              {rotulo}
                            </div>
                          )
                        })}
                      </div>

                      {podeMarcar && !exOk && (
                        <div className="tr-ex-carga">
                          <label htmlFor={'mtc-' + i + '-' + k}>Carga usada (kg)</label>
                          <input
                            id={'mtc-' + i + '-' + k}
                            type="number" inputMode="decimal"
                            value={pesos[ex.nome] ?? ''}
                            onChange={e => setPesos(p => ({ ...p, [ex.nome]: e.target.value }))}
                            placeholder={ex.linhas[n]?.carga || 'igual ao alvo'}
                          />
                          <p className="mini">Deixe em branco para registrar a carga do plano.</p>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          ))}

          {onProgramar && (
            <button className="btn btn-sec btn-sm btn-auto" style={{ marginTop: 14 }} onClick={onProgramar}>
              Editar meu plano
            </button>
          )}
        </>
      )}
    </>
  )

  // Embutido entra direto na página; senão, vira o painel sobreposto.
  if (embutido) return conteudo

  return (
    <div className="espiada" onClick={onFechar}>
      <div className="espiada-caixa" onClick={e => e.stopPropagation()}>
        <header className="espiada-topo">
          <div>
            <span className="espiada-letra">Visão do aluno</span>
            <h2>O que {primeiro || 'o aluno'} está vendo</h2>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onFechar} title="Fechar"><IcFechar /></button>
        </header>
        <div className="espiada-corpo">{conteudo}</div>
      </div>
    </div>
  )
}
