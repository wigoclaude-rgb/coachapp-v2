import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { ref, onValue, push, remove, set } from 'firebase/database'
import { db } from '../../firebase'
import { fmtData } from '../../lib/util'
import { soDigitos } from '../../lib/cpf'
import { atividadeDe, resumoAtividade } from '../../lib/atividades'
import { normalizarPlano, resumoLinhas, LETRAS } from '../../lib/treinoModel'

/* Espelha PERGUNTAS_FEEDBACK do AlunoHome. `alerta` é a resposta que pede ação. */
const PERGUNTAS_FB = [
  { id: 'carga', curto: 'Carga adequada', alerta: 'nao' },
  { id: 'dor', curto: 'Sentiu dor', alerta: 'sim' },
  { id: 'completou', curto: 'Completou as reps', alerta: 'nao' }
]
import { CAMPOS_MEDIDAS, rotuloMedida } from '../../lib/medidas'
import { IcEvolucao, IcOlho, IcMais, IcEditar, IcLixeira } from '../../components/Icones.jsx'
import FormAvaliacao from '../../components/FormAvaliacao.jsx'
import AvaliacaoDetalhe from '../../components/AvaliacaoDetalhe.jsx'
import EvolucaoCorporal from '../../components/EvolucaoCorporal.jsx'
import {
  normalizarAvaliacao, prepararParaSalvar, avaliacaoVazia, classificarIMC
} from '../../lib/avaliacao'
import TreinoDoDia from '../../components/TreinoDoDia.jsx'
import Suplementacao from '../../components/Suplementacao.jsx'
import Anexos from '../../components/Anexos.jsx'
import { organizar } from '../../lib/anexos'
import LineChart from '../../components/LineChart.jsx'
import Heatmap from '../../components/Heatmap.jsx'
import FotoInput from '../../components/FotoInput.jsx'
import { apagarFoto as apagarDoStorage } from '../../lib/fotos'

export default function AlunoDetalhe({ user }) {
  const { alunoId } = useParams()
  const navigate = useNavigate()
  const [aluno, setAluno] = useState(null)
  const [aba, setAba] = useState('perfil')
  const [execucoes, setExecucoes] = useState({})
  const [avaliacoes, setAvaliacoes] = useState({})
  const [fotos, setFotos] = useState({})
  const [diario, setDiario] = useState({})
  const [historico, setHistorico] = useState({})
  const [formAval, setFormAval] = useState(null)      // avaliação em edição, ou null
  const [avalAberta, setAvalAberta] = useState(null)  // qual linha está expandida
  const [avalSalvando, setAvalSalvando] = useState(false)
  const [avalErro, setAvalErro] = useState('')
  const [feedbacks, setFeedbacks] = useState({})
  const [verComoAluno, setVerComoAluno] = useState(false)
  const [anexos, setAnexos] = useState({})
  const [exercicioGrafico, setExercicioGrafico] = useState('')
  const [tipoFoto, setTipoFoto] = useState('frente')

  useEffect(() => {
    const u1 = onValue(ref(db, 'users/' + alunoId), s => setAluno(s.val()))
    const u2 = onValue(ref(db, 'execucoes/' + alunoId), s => setExecucoes(s.val() || {}))
    const u3 = onValue(ref(db, 'avaliacoes/' + alunoId), s => setAvaliacoes(s.val() || {}))
    const u4 = onValue(ref(db, 'fotosProgresso/' + alunoId), s => setFotos(s.val() || {}))
    const u5 = onValue(ref(db, 'treinosHistorico/' + alunoId), s => setHistorico(s.val() || {}))
    // Só o espelho do que o aluno compartilhou — `diario/` é privado dele.
    const u6 = onValue(ref(db, 'diarioCompartilhado/' + alunoId), s => setDiario(s.val() || {}))
    const u7 = onValue(ref(db, 'feedbacks/' + alunoId), s => setFeedbacks(s.val() || {}))
    // Só o metadado. O conteúdo em base64 vive em `anexosDados` e é lido no clique.
    const u8 = onValue(ref(db, 'anexos/' + alunoId), s => setAnexos(s.val() || {}))
    return () => { u1(); u2(); u3(); u4(); u5(); u6(); u7(); u8() }
  }, [alunoId])

  if (!aluno) return <div className="loading">Carregando...</div>

  const listaExec = Object.values(execucoes).sort((a, b) => b.ts - a.ts)

  /* Séries feitas com menos carga que a do plano. `alvo` só existe nesses casos. */
  const reducoes = listaExec.filter(e => e.alvo).slice(0, 15)
  const listaAval = Object.entries(avaliacoes).map(([id, a]) => ({ id, ...a })).sort((a, b) => a.ts - b.ts)
  const { doAluno: anexosDoAluno, porAvaliacao: anexosPorAval } = organizar(anexos)
  const listaFotos = Object.entries(fotos).map(([id, f]) => ({ id, ...f })).sort((a, b) => b.ts - a.ts)
  const listaHist = Object.entries(historico).map(([id, t]) => ({ id, ...t })).sort((a, b) => (b.arquivadoEm || 0) - (a.arquivadoEm || 0))
  const listaFeedback = Object.entries(feedbacks)
    .map(([id, f]) => ({ id, ...f }))
    .sort((a, b) => b.ts - a.ts)

  const listaDiario = Object.entries(diario)
    .map(([id, r]) => ({ id, ...r }))
    .sort((a, b) => (b.ts || 0) - (a.ts || 0))

  // Evolução de carga por exercício
  const exercicios = [...new Set(listaExec.map(e => e.exercicio))]
  const exSel = exercicioGrafico || exercicios[0] || ''
  const pontosCarga = listaExec
    .filter(e => e.exercicio === exSel && e.peso)
    .sort((a, b) => a.ts - b.ts)
    .map(e => ({ label: fmtData(e.ts).slice(0, 5), valor: Number(e.peso) }))
  const pontosCargaReduzidos = pontosCarga.length > 12 ? pontosCarga.filter((_, i) => i % Math.ceil(pontosCarga.length / 12) === 0) : pontosCarga

  // Frequência
  const diasTreinados = new Set(listaExec.map(e => {
    const d = new Date(e.ts)
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')
  }))
  const seteDias = Date.now() - 7 * 24 * 3600 * 1000
  const diasSemana = new Set(listaExec.filter(e => e.ts >= seteDias).map(e => new Date(e.ts).toDateString())).size

  /*
    Salva a avaliação inteira. `prepararParaSalvar` recalcula IMC, relação
    cintura/quadril, dobras e resumo — assim um registro salvo pela metade e
    completado depois fica consistente sem ninguém apertar "recalcular".
  */
  async function salvarAvaliacao(form) {
    setAvalSalvando(true)
    setAvalErro('')
    try {
      const doc = prepararParaSalvar(form, {
        personalId: user.uid, sexo: aluno.sexo, nascimento: aluno.nascimento
      })
      if (formAval?.id) await set(ref(db, 'avaliacoes/' + alunoId + '/' + formAval.id), doc)
      else await push(ref(db, 'avaliacoes/' + alunoId), doc)
      setFormAval(null)
    } catch (err) {
      setAvalErro(
        String(err?.message || '').toLowerCase().includes('permission')
          ? 'O banco recusou a gravação. Confira se este aluno é seu.'
          : 'Não foi possível salvar. Confira sua conexão e tente de novo.'
      )
      console.warn('Falha ao salvar avaliação:', err)
    }
    setAvalSalvando(false)
  }

  function novaAvaliacao() {
    setAvalErro('')
    setFormAval(avaliacaoVazia(listaAval.length === 0))
  }

  function editarAvaliacao(a) {
    setAvalErro('')
    setFormAval({ ...normalizarAvaliacao(a), id: a.id })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function apagarAvaliacao(a) {
    if (!confirm('Excluir a avaliação de ' + fmtData(a.ts) + '? Não tem como desfazer.')) return
    await remove(ref(db, 'avaliacoes/' + alunoId + '/' + a.id))
    setAvalAberta(null)
  }

  /** Linha da lista: o que a avaliação mediu, em uma frase. */
  function resumoLinha(n) {
    const r = n.resumo || {}
    const partes = []
    if (r.peso ?? n.medidas.peso) partes.push((r.peso ?? n.medidas.peso) + ' kg')
    if (r.imc) partes.push('IMC ' + r.imc.toFixed(1).replace('.', ',') + ' · ' + classificarIMC(r.imc))
    if (r.percentualGordura) partes.push(r.percentualGordura.toFixed(1).replace('.', ',') + '% gordura')
    if (r.cintura ?? n.medidas.cintura) partes.push('cintura ' + (r.cintura ?? n.medidas.cintura) + ' cm')
    return partes.length ? partes.join(' · ') : 'Sem medidas registradas'
  }

  async function salvarFoto(img) {
    await push(ref(db, 'fotosProgresso/' + alunoId), { ts: Date.now(), tipo: tipoFoto, img })
  }

  async function apagarFoto(id, img) {
    if (!confirm('Apagar esta foto?')) return
    await remove(ref(db, 'fotosProgresso/' + alunoId + '/' + id))
    await apagarDoStorage(img)
  }

  const ganhoKg = (() => {
    const comPeso = listaAval.filter(a => a.medidas && a.medidas.peso)
    if (comPeso.length < 2) return null
    return (comPeso[comPeso.length - 1].medidas.peso - comPeso[0].medidas.peso).toFixed(1)
  })()

  /*
    Apaga tudo que pertence ao aluno.

    O `cpfs/{cpf}` é o que mais dói se ficar para trás: ele existe justamente para
    barrar cadastro duplicado, então um CPF esquecido bloqueia para sempre quem
    quiser voltar a treinar. O `codigos/{codigo}` tem o mesmo problema em menor
    grau. Os dois vivem fora do registro do aluno, por isso é fácil esquecer.

    A conta de login continua no Authentication — apagar de lá exige Admin SDK e
    não dá do navegador. Fica avisado na confirmação.
  */
  async function deletarAluno() {
    const nome = aluno.nome || 'este aluno'
    if (!confirm(
      `Deletar ${nome}?\n\n` +
      'Apaga treinos, execuções, cobranças, avaliações, fotos, diário, ' +
      'feedbacks e suplementos. Não tem como desfazer.'
    )) return

    /*
      A ORDEM IMPORTA. Quase toda regra deste banco autoriza o personal olhando
      `users/{aluno}/personalId`. Apagar o registro do aluno junto com o resto
      derrubaria essa checagem no meio e o Firebase negaria o que faltasse —
      deixando exatamente o lixo que esta função existe para evitar.
      Por isso `users` sai por último.
    */
    const dependemDoRegistro = [
      'treinos/' + alunoId,
      'treinosHistorico/' + alunoId,
      'execucoes/' + alunoId,
      'cobrancas/' + alunoId,
      'avaliacoes/' + alunoId,
      'fotosProgresso/' + alunoId,
      'diarioCompartilhado/' + alunoId,
      'feedbacks/' + alunoId,
      'suplementos/' + alunoId,
      'suplementosTomados/' + alunoId,
      'diario/' + alunoId,
      'notificacoes/' + alunoId
    ]
    // Só existem quando o aluno tem código/CPF; sem eles a chave sairia inválida.
    if (aluno.codigo) dependemDoRegistro.push('codigos/' + aluno.codigo)
    if (aluno.cpf) dependemDoRegistro.push('cpfs/' + soDigitos(aluno.cpf))

    try {
      await Promise.all(dependemDoRegistro.map(c => remove(ref(db, c))))
      await remove(ref(db, 'users/' + alunoId))
      await remove(ref(db, 'personals/' + user.uid + '/alunos/' + alunoId))
      navigate('/personal')
    } catch (err) {
      alert('Não foi possível apagar tudo. Parte dos dados pode ter ficado. Tente de novo.')
      console.warn('Falha ao deletar aluno:', err)
    }
  }

  return (
    <div className="container">
      {verComoAluno && (
        <TreinoDoDia
          uid={alunoId}
          nome={aluno.nome}
          onFechar={() => setVerComoAluno(false)}
        />
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {aluno.foto ? <img src={aluno.foto} className="foto-perfil" alt="" /> : null}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
  <h2 style={{ fontSize: 22, margin: 0 }}>{aluno.nome}</h2>
  <button
    className="btn btn-sec btn-sm"
    onClick={() => setVerComoAluno(true)}
    title="Ver a tela de treino como o aluno vê"
  >
    <IcOlho /> Ver como o aluno
  </button>
  <button
    className="btn btn-sec btn-sm"
    onClick={deletarAluno}
  >
    Deletar
  </button>
</div>
            <span className="muted">{aluno.objetivo || 'Sem objetivo definido'}</span>
          </div>
        </div>
        <div className="aluno-acoes">
          <Link to={'/personal-treino/' + alunoId}><button className="btn btn-sm">Editar treino</button></Link>
          <button className="btn btn-sec btn-sm" onClick={() => navigate('/personal')}>Voltar</button>
        </div>
      </div>

      <div className="tabs">
        <button className={'tab ' + (aba === 'perfil' ? 'ativa' : '')} onClick={() => setAba('perfil')}>Perfil</button>
        <button className={'tab ' + (aba === 'avaliacao' ? 'ativa' : '')} onClick={() => setAba('avaliacao')}>Avaliação física</button>
        <button className={'tab ' + (aba === 'fotos' ? 'ativa' : '')} onClick={() => setAba('fotos')}>Fotos</button>
        <button className={'tab ' + (aba === 'diario' ? 'ativa' : '')} onClick={() => setAba('diario')}>
          Check-in{listaDiario.length > 0 ? ` (${listaDiario.length})` : ''}
        </button>
        <button className={'tab ' + (aba === 'suplementos' ? 'ativa' : '')} onClick={() => setAba('suplementos')}>
          Suplementação
        </button>
        <button className={'tab ' + (aba === 'feedback' ? 'ativa' : '')} onClick={() => setAba('feedback')}>
          Feedback{listaFeedback.length > 0 ? ` (${listaFeedback.length})` : ''}
        </button>
        <button className={'tab ' + (aba === 'relatorios' ? 'ativa' : '')} onClick={() => setAba('relatorios')}>Relatórios</button>
        <button className={'tab ' + (aba === 'historico' ? 'ativa' : '')} onClick={() => setAba('historico')}>Treinos antigos</button>
      </div>

      {aba === 'perfil' && (
        <>
          <div className="stats-grid">
            <div className="stat-card"><span className="stat-num">{diasSemana}</span><span className="stat-label">Treinos últimos 7 dias</span></div>
            <div className="stat-card"><span className="stat-num">{listaExec.length}</span><span className="stat-label">Séries registradas</span></div>
            <div className="stat-card"><span className="stat-num">{ganhoKg !== null ? (ganhoKg > 0 ? '+' : '') + ganhoKg + ' kg' : '-'}</span><span className="stat-label">Variação de peso corporal</span></div>
            <div className="stat-card"><span className="stat-num">{listaAval.length}</span><span className="stat-label">Avaliações físicas</span></div>
          </div>
          <div className="card">
            <h2>Dados do aluno</h2>
            <p><strong>E-mail:</strong> {aluno.email}</p>
            <p><strong>Telefone:</strong> {aluno.telefone || '-'}</p>
            <p><strong>Código de acesso:</strong> {aluno.codigo}</p>
            <p><strong>Objetivo:</strong> {aluno.objetivo || '-'}</p>
          </div>
          <div className="card">
            <h2>Frequência (calendário)</h2>
            <Heatmap diasTreinados={diasTreinados} />
          </div>
        </>
      )}

      {aba === 'avaliacao' && (
        <>
          {!formAval && (
            <div className="barra-filtros">
              <span className="section-title" style={{ margin: 0 }}>
                {listaAval.length} avaliaç{listaAval.length === 1 ? 'ão' : 'ões'}
              </span>
              <button className="btn btn-sm" onClick={novaAvaliacao}>
                <IcMais /> Nova avaliação
              </button>
            </div>
          )}

          {formAval && (
            <FormAvaliacao
              inicial={formAval.id ? formAval : null}
              aluno={aluno}
              primeira={listaAval.length === 0}
              onSalvar={salvarAvaliacao}
              onCancelar={() => { setFormAval(null); setAvalErro('') }}
              salvando={avalSalvando}
              erro={avalErro}
            />
          )}

          {!formAval && (
            <>
              <div className="card">
                <div className="card-titulo">
                  <div style={{ minWidth: 0 }}>
                    <h2>Documentos do aluno</h2>
                    <p className="mini">
                      Atestado, liberação médica, exame — vale para qualquer avaliação.
                    </p>
                  </div>
                </div>
                <Anexos alunoId={alunoId} lista={anexosDoAluno} podeEditar />
              </div>

              <EvolucaoCorporal avaliacoes={listaAval} />

              {listaAval.length === 0 && (
                <div className="card">
                  <div className="vazio-estado">
                    <div className="ve-icone"><IcEvolucao /></div>
                    <h2>Nenhuma avaliação registrada</h2>
                    <p className="muted">
                      Registre a primeira para acompanhar a evolução corporal do aluno.
                    </p>
                  </div>
                </div>
              )}

              {[...listaAval].reverse().map(a => {
                const n = normalizarAvaliacao(a)
                const aberto = avalAberta === a.id
                const oculta = !n.visibilidade.alunoPodeVer
                return (
                  <div key={a.id} className="card av-linha">
                    <button
                      type="button"
                      className="av-linha-cab"
                      onClick={() => setAvalAberta(aberto ? null : a.id)}
                      aria-expanded={aberto}
                    >
                      <div className="av-linha-txt">
                        <strong>{fmtData(a.ts)}</strong>
                        <span className="muted">{resumoLinha(n)}</span>
                      </div>
                      {oculta && <span className="av-oculta">Oculta do aluno</span>}
                      <span className="av-seta">{aberto ? '−' : '+'}</span>
                    </button>

                    {aberto && (
                      <>
                        <AvaliacaoDetalhe avaliacao={a} />
                        <div style={{ padding: '0 16px' }}>
                          <Anexos
                            alunoId={alunoId}
                            lista={anexosPorAval[a.id] || []}
                            avaliacaoId={a.id}
                            podeEditar
                            titulo="Anexos desta avaliação"
                          />
                        </div>
                        <div className="av-acoes">
                          <button className="btn btn-sec btn-sm btn-auto" onClick={() => editarAvaliacao(a)}>
                            <IcEditar /> Editar
                          </button>
                          <button className="btn btn-perigo-sutil btn-sm btn-auto" onClick={() => apagarAvaliacao(a)}>
                            <IcLixeira /> Excluir
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )
              })}
            </>
          )}
        </>
      )}

      {aba === 'suplementos' && (
        <Suplementacao alunoId={alunoId} quemSou="personal" nomeAluno={aluno.nome} />
      )}

      {aba === 'feedback' && reducoes.length > 0 && (
        <div className="card">
          <div className="card-titulo">
            <div style={{ minWidth: 0 }}>
              <h2>Carga abaixo do plano</h2>
              <p className="mini">
                O app não bloqueia mais — registra o motivo. Se repetir no mesmo
                exercício, o alvo provavelmente está alto.
              </p>
            </div>
          </div>
          {reducoes.map((r, i) => (
            <div key={i} className="fb-item atencao">
              <div className="fb-topo">
                <strong>{r.exercicio}</strong>
                <span className="mini">{r.serie}ª série · {fmtData(r.ts)}</span>
              </div>
              <div className="fb-respostas">
                <span className="fb-tag ruim">{r.peso} kg (plano: {r.alvo} kg)</span>
                <span className="fb-tag">{r.motivo}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {aba === 'feedback' && (
        <div className="card">
          <div className="card-titulo">
            <div style={{ minWidth: 0 }}>
              <h2>O que o aluno respondeu</h2>
              <p className="mini">Enviado por {aluno.nome?.split(' ')[0] || 'ele'} dentro de cada exercício.</p>
            </div>
          </div>

          {listaFeedback.length === 0 && (
            <p className="muted">Nenhum feedback ainda.</p>
          )}

          {listaFeedback.map(f => {
            const alertas = PERGUNTAS_FB.filter(p => f.respostas?.[p.id] === p.alerta)
            return (
              <div key={f.id} className={'fb-item' + (alertas.length ? ' atencao' : '')}>
                <div className="fb-topo">
                  <strong>{f.exercicio}</strong>
                  <span className="mini">{f.treino ? f.treino + ' · ' : ''}{fmtData(f.ts)}</span>
                </div>

                <div className="fb-respostas">
                  {PERGUNTAS_FB.map(p => {
                    const r = f.respostas?.[p.id]
                    if (!r) return null
                    return (
                      <span key={p.id} className={'fb-tag' + (r === p.alerta ? ' ruim' : '')}>
                        {p.curto}: {r === 'sim' ? 'sim' : 'não'}
                      </span>
                    )
                  })}
                </div>

                {f.comentario && <p className="fb-comentario">{f.comentario}</p>}
              </div>
            )
          })}
        </div>
      )}

      {aba === 'fotos' && (
        <div className="card">
          <h2>Fotos de progresso (antes/depois)</h2>
          <label>Tipo da foto</label>
          <select value={tipoFoto} onChange={e => setTipoFoto(e.target.value)} style={{ maxWidth: 220 }}>
            <option value="frente">Frente</option>
            <option value="lado">Lado</option>
            <option value="costas">Costas</option>
          </select>
          <div style={{ marginTop: 12 }}>
            <FotoInput atual={null} onFoto={salvarFoto} rotulo="Adicionar foto" pasta={'progresso/' + alunoId} />
          </div>
          <div className="galeria">
            {listaFotos.map(f => (
              <div key={f.id} className="galeria-item">
                <img src={f.img} alt={f.tipo} />
                <div className="galeria-info">
                  <span>{f.tipo} · {fmtData(f.ts)}</span>
                  <button onClick={() => apagarFoto(f.id, f.img)}>Apagar</button>
                </div>
              </div>
            ))}
          </div>
          {listaFotos.length === 0 && <p className="muted" style={{ marginTop: 12 }}>Nenhuma foto ainda.</p>}
        </div>
      )}

      {aba === 'diario' && (
        <div className="card">
          <div className="card-titulo">
            <div style={{ minWidth: 0 }}>
              <h2>Diário do aluno</h2>
              <p className="mini">Só aparece o que {aluno.nome?.split(' ')[0] || 'o aluno'} escolheu compartilhar.</p>
            </div>
          </div>

          {listaDiario.length === 0 ? (
            <div className="vazio-estado">
              <div className="ve-icone"><IcEvolucao /></div>
              <h2>Nada compartilhado</h2>
              <p className="muted">
                O diário é privado do aluno. Quando ele marcar um registro como compartilhado, aparece aqui.
              </p>
            </div>
          ) : listaDiario.map(r => (
            <div key={r.id} className="diario-registro">
              <div className="dr-topo">
                {r.atividade && (
                  <span className="dr-atv">
                    <span className="dr-atv-icone" aria-hidden="true">{atividadeDe(r.atividade)?.emoji}</span>
                    {resumoAtividade(r)}
                  </span>
                )}
                <span className="dr-data">{fmtData(r.ts)}</span>
              </div>
              {r.foto && <img src={r.foto} alt="" className="dr-foto" loading="lazy" />}
              {r.nota && <p className="dr-nota">{r.nota}</p>}
              {r.medidas && Object.keys(r.medidas).length > 0 && (
                <div className="dr-medidas">
                  {Object.entries(r.medidas).map(([campo, valor]) => (
                    <span key={campo} className="dr-medida">
                      <span className="dm-rotulo">{rotuloMedida(campo).replace(/\s*\(.*\)/, '')}</span>
                      <span className="dm-valor">{valor}</span>
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {aba === 'relatorios' && (
        <>
          <div className="card">
            <h2>Evolução de carga por exercício</h2>
            <label>Exercício</label>
            <select value={exSel} onChange={e => setExercicioGrafico(e.target.value)}>
              {exercicios.length === 0 && <option value="">Sem registros</option>}
              {exercicios.map(ex => <option key={ex} value={ex}>{ex}</option>)}
            </select>
            <div style={{ marginTop: 14 }}>
              <LineChart pontos={pontosCargaReduzidos} unidade="kg" />
            </div>
          </div>
          <div className="card">
            <h2>Últimas séries registradas</h2>
            {listaExec.slice(0, 25).map((e, i) => (
              <div key={i} className="serie-row">
                <span className="muted" style={{ minWidth: 84 }}>{fmtData(e.ts)}</span>
                <span style={{ fontWeight: 600 }}>{e.exercicio}</span>
                <span>Série {e.serie}</span>
                <span>{e.peso ? e.peso + ' kg' : ''}</span>
              </div>
            ))}
            {listaExec.length === 0 && <p className="muted">Nenhuma série registrada.</p>}
          </div>
        </>
      )}

      {aba === 'historico' && (
        <div className="card">
          <h2>Treinos anteriores</h2>
          {listaHist.length === 0 && <p className="muted">Nenhum treino arquivado. Quando você salvar um novo treino, o anterior fica guardado aqui.</p>}
          {listaHist.map(t => {
            const antigo = normalizarPlano(t)
            if (!antigo) return null
            return (
              <div key={t.id} className="exercicio-card">
                <div className="titulo">
                  <span>{antigo.nome}</span>
                  <span className="mini">arquivado em {t.arquivadoEm ? fmtData(t.arquivadoEm) : '-'}</span>
                </div>
                {antigo.lista.map((d, i) => (
                  <div key={i} style={{ marginTop: 10 }}>
                    <div className="template-dia">
                      <span className="td-letra">{LETRAS[i] || i + 1}</span>
                      <span className="td-nome">{d.nome}</span>
                      <span className="td-qtd">{d.exercicios.length} ex.</span>
                    </div>
                    {d.exercicios.map((ex, k) => (
                      <div key={k} className="serie-row">
                        <span style={{ fontWeight: 600, flex: 1 }}>{ex.nome}</span>
                        <span className="mini">{resumoLinhas(ex.linhas)}</span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
