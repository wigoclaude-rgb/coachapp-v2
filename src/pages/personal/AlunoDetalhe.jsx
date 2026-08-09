import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { ref, onValue, push, remove } from 'firebase/database'
import { db } from '../../firebase'
import { fmtData } from '../../lib/util'
import { normalizarPlano, resumoLinhas, LETRAS } from '../../lib/treinoModel'
import LineChart from '../../components/LineChart.jsx'
import Heatmap from '../../components/Heatmap.jsx'
import FotoInput from '../../components/FotoInput.jsx'
import { apagarFoto as apagarDoStorage } from '../../lib/fotos'

const CAMPOS_MEDIDAS = [
  ['peso', 'Peso (kg)'], ['altura', 'Altura (cm)'], ['pescoco', 'Pescoço (cm)'],
  ['ombro', 'Ombro (cm)'], ['peito', 'Peito (cm)'], ['cintura', 'Cintura (cm)'],
  ['abdomen', 'Abdômen (cm)'], ['quadril', 'Quadril (cm)'],
  ['bracoD', 'Braço dir. (cm)'], ['bracoE', 'Braço esq. (cm)'],
  ['antebracoD', 'Antebraço dir. (cm)'], ['antebracoE', 'Antebraço esq. (cm)'],
  ['coxaD', 'Coxa dir. (cm)'], ['coxaE', 'Coxa esq. (cm)'],
  ['panturrilhaD', 'Panturrilha dir. (cm)'], ['panturrilhaE', 'Panturrilha esq. (cm)']
]

export default function AlunoDetalhe({ user }) {
  const { alunoId } = useParams()
  const navigate = useNavigate()
  const [aluno, setAluno] = useState(null)
  const [aba, setAba] = useState('perfil')
  const [execucoes, setExecucoes] = useState({})
  const [avaliacoes, setAvaliacoes] = useState({})
  const [fotos, setFotos] = useState({})
  const [historico, setHistorico] = useState({})
  const [medidas, setMedidas] = useState({})
  const [medMsg, setMedMsg] = useState('')
  const [medidaGrafico, setMedidaGrafico] = useState('peso')
  const [exercicioGrafico, setExercicioGrafico] = useState('')
  const [tipoFoto, setTipoFoto] = useState('frente')

  useEffect(() => {
    const u1 = onValue(ref(db, 'users/' + alunoId), s => setAluno(s.val()))
    const u2 = onValue(ref(db, 'execucoes/' + alunoId), s => setExecucoes(s.val() || {}))
    const u3 = onValue(ref(db, 'avaliacoes/' + alunoId), s => setAvaliacoes(s.val() || {}))
    const u4 = onValue(ref(db, 'fotosProgresso/' + alunoId), s => setFotos(s.val() || {}))
    const u5 = onValue(ref(db, 'treinosHistorico/' + alunoId), s => setHistorico(s.val() || {}))
    return () => { u1(); u2(); u3(); u4(); u5() }
  }, [alunoId])

  if (!aluno) return <div className="loading">Carregando...</div>

  const listaExec = Object.values(execucoes).sort((a, b) => b.ts - a.ts)
  const listaAval = Object.entries(avaliacoes).map(([id, a]) => ({ id, ...a })).sort((a, b) => a.ts - b.ts)
  const listaFotos = Object.entries(fotos).map(([id, f]) => ({ id, ...f })).sort((a, b) => b.ts - a.ts)
  const listaHist = Object.entries(historico).map(([id, t]) => ({ id, ...t })).sort((a, b) => (b.arquivadoEm || 0) - (a.arquivadoEm || 0))

  // Evolução de carga por exercício
  const exercicios = [...new Set(listaExec.map(e => e.exercicio))]
  const exSel = exercicioGrafico || exercicios[0] || ''
  const pontosCarga = listaExec
    .filter(e => e.exercicio === exSel && e.peso)
    .sort((a, b) => a.ts - b.ts)
    .map(e => ({ label: fmtData(e.ts).slice(0, 5), valor: Number(e.peso) }))
  const pontosCargaReduzidos = pontosCarga.length > 12 ? pontosCarga.filter((_, i) => i % Math.ceil(pontosCarga.length / 12) === 0) : pontosCarga

  // Evolução de medidas
  const pontosMedida = listaAval
    .filter(a => a.medidas && a.medidas[medidaGrafico])
    .map(a => ({ label: fmtData(a.ts).slice(0, 5), valor: Number(a.medidas[medidaGrafico]) }))

  // Frequência
  const diasTreinados = new Set(listaExec.map(e => {
    const d = new Date(e.ts)
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')
  }))
  const seteDias = Date.now() - 7 * 24 * 3600 * 1000
  const diasSemana = new Set(listaExec.filter(e => e.ts >= seteDias).map(e => new Date(e.ts).toDateString())).size

  async function salvarAvaliacao(e) {
    e.preventDefault()
    setMedMsg('')
    const preenchidas = {}
    Object.entries(medidas).forEach(([k, v]) => { if (v !== '') preenchidas[k] = Number(v) })
    if (Object.keys(preenchidas).length === 0) return
    await push(ref(db, 'avaliacoes/' + alunoId), { ts: Date.now(), medidas: preenchidas })
    setMedMsg('Avaliação registrada.')
    setMedidas({})
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

  return (
    <div className="container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {aluno.foto ? <img src={aluno.foto} className="foto-perfil" alt="" /> : null}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
  <h2 style={{ fontSize: 22, margin: 0 }}>{aluno.nome}</h2>
  <button 
    className="btn btn-sec btn-sm" 
    onClick={() => {
      if (confirm('Deletar aluno ' + aluno.nome + '? Vai deletar tudo!')) {
        remove(ref(db, 'personals/' + user.uid + '/alunos/' + alunoId))
        remove(ref(db, 'users/' + alunoId))
        remove(ref(db, 'treinos/' + alunoId))
        remove(ref(db, 'execucoes/' + alunoId))
        remove(ref(db, 'cobrancas/' + alunoId))
        navigate('/personal')
      }
    }}
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
          <div className="card">
            <h2>Nova avaliação física</h2>
            <p className="muted">Preencha apenas as medidas que tirou hoje.</p>
            <form onSubmit={salvarAvaliacao}>
              <div className="grid-medidas">
                {CAMPOS_MEDIDAS.map(([campo, rotulo]) => (
                  <div key={campo}>
                    <label>{rotulo}</label>
                    <input type="number" step="0.1" value={medidas[campo] || ''}
                      onChange={e => setMedidas({ ...medidas, [campo]: e.target.value })} />
                  </div>
                ))}
              </div>
              {medMsg && <div className="ok">{medMsg}</div>}
              <button className="btn">Salvar avaliação</button>
            </form>
          </div>
          <div className="card">
            <h2>Evolução das medidas</h2>
            <label>Medida</label>
            <select value={medidaGrafico} onChange={e => setMedidaGrafico(e.target.value)}>
              {CAMPOS_MEDIDAS.map(([campo, rotulo]) => <option key={campo} value={campo}>{rotulo}</option>)}
            </select>
            <div style={{ marginTop: 14 }}>
              <LineChart pontos={pontosMedida} unidade="" />
            </div>
          </div>
          <div className="card">
            <h2>Histórico de avaliações</h2>
            {listaAval.length === 0 && <p className="muted">Nenhuma avaliação registrada.</p>}
            {[...listaAval].reverse().map(a => (
              <div key={a.id} className="aval-item">
                <strong>{fmtData(a.ts)}</strong>
                <div className="muted">
                  {Object.entries(a.medidas).map(([k, v]) => {
                    const rot = CAMPOS_MEDIDAS.find(c => c[0] === k)
                    return (rot ? rot[1].split(' (')[0] : k) + ': ' + v
                  }).join(' · ')}
                </div>
              </div>
            ))}
          </div>
        </>
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
