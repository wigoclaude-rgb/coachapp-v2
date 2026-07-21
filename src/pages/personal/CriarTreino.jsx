import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ref, get, set, push } from 'firebase/database'
import { db } from '../../firebase'
import { BIBLIOTECA_EXERCICIOS } from '../../lib/exercicios'
import { TEMPLATES } from '../../lib/templates'
import { get } from 'firebase/database'
import { notificar } from '../../lib/notify'

const exercicioVazio = () => ({ nome: '', series: 3, reps: 12, carga: '', descanso: 60, video: '' })

export default function CriarTreino({ user }) {
  const { alunoId } = useParams()
  const navigate = useNavigate()
  const [nomeAluno, setNomeAluno] = useState('')
  const [nomeTreino, setNomeTreino] = useState('')
  const [exercicios, setExercicios] = useState([exercicioVazio()])
  const [treinoExistente, setTreinoExistente] = useState(null)
  const [meusTemplates, setMeusTemplates] = useState({})
  const [salvo, setSalvo] = useState(false)
  const [enviando, setEnviando] = useState(false)

  useEffect(() => {
    get(ref(db, 'personals/' + user.uid + '/alunos/' + alunoId)).then(s => {
      if (s.exists()) setNomeAluno(s.val().nome)
get(ref(db, 'personals/' + user.uid + '/meusTemplates')).then(s => {
    if (s.exists()) setMeusTemplates(s.val())
  })
    })
    get(ref(db, 'treinos/' + alunoId)).then(s => {
      if (s.exists()) {
        const t = s.val()
        setTreinoExistente(t)
        setNomeTreino(t.nome || '')
        setExercicios((t.exercicios || [exercicioVazio()]).map(ex => ({ video: '', ...ex })))
      }
    })
  }, [alunoId, user.uid])

  function mudar(i, campo, valor) {
    const novo = [...exercicios]
    novo[i] = { ...novo[i], [campo]: valor }
    setExercicios(novo)
  }

function aplicarTemplate(idx) {
  if (idx === '') return
  
  let template
  if (idx.startsWith('pessoal_')) {
    const templateId = idx.replace('pessoal_', '')
    template = meusTemplates[templateId]
  } else {
    template = TEMPLATES[Number(idx)]
  }
  
  if (!template) return
  if (exercicios.some(ex => ex.nome) && !confirm('Substituir os exercícios atuais pelo template "' + template.nome + '"?')) return
  setNomeTreino(template.nome)
  setExercicios((template.exercicios || []).map(ex => ({ ...ex, video: ex.video || '' })))
}
  async function salvar(e) {
    e.preventDefault()
    setEnviando(true)
    // arquivar treino anterior no histórico
    if (treinoExistente && treinoExistente.exercicios) {
      await push(ref(db, 'treinosHistorico/' + alunoId), { ...treinoExistente, arquivadoEm: Date.now() })
    }
    const novo = {
      nome: nomeTreino,
      exercicios: exercicios.filter(ex => ex.nome.trim() !== ''),
      atualizadoEm: Date.now(),
      personalId: user.uid
    }
    await set(ref(db, 'treinos/' + alunoId), novo)
    setTreinoExistente(novo)
    notificar(alunoId, 'Seu treino foi atualizado: ' + nomeTreino, '/aluno')
    setSalvo(true)
    setEnviando(false)
    setTimeout(() => setSalvo(false), 3000)
  }

  return (
    <div className="container">
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h2>Treino de {nomeAluno || 'aluno'}</h2>
          <button className="btn btn-sec btn-sm" onClick={() => navigate('/personal')}>Voltar</button>
        </div>

        <label>Começar por um modelo (opcional)</label>
        <select defaultValue="" onChange={e => { aplicarTemplate(e.target.value); e.target.value = '' }}>
  <option value="">Escolher template de treino...</option>
  {Object.keys(meusTemplates).length > 0 && <optgroup label="Meus Templates">
    {Object.entries(meusTemplates).map(([id, t]) => (
      <option key={id} value={'pessoal_' + id}>{t.nome}</option>
    ))}
  </optgroup>}
  <optgroup label="Templates Padrão">
    {TEMPLATES.map((t, i) => <option key={i} value={i}>{t.nome}</option>)}
  </optgroup>
</select>

        <form onSubmit={salvar}>
          <label>Nome do treino</label>
          <input value={nomeTreino} onChange={e => setNomeTreino(e.target.value)} placeholder="Ex: Treino A - Peito e Tríceps" required />

          <h3 style={{ margin: '20px 0 6px' }}>Exercícios</h3>
          <p className="muted" style={{ marginBottom: 10 }}>
            Digite ou escolha o exercício na lista. O link do YouTube mostra a execução para o aluno.
          </p>

          <datalist id="lista-exercicios">
            {BIBLIOTECA_EXERCICIOS.map(ex => <option key={ex} value={ex} />)}
          </datalist>

          {exercicios.map((ex, i) => (
            <div className="exercicio-editor" key={i}>
              <div className="exercicio-editor-topo">
                <strong>Exercício {i + 1}</strong>
                <button type="button" className="remove-btn" onClick={() => setExercicios(exercicios.filter((_, idx) => idx !== i))}>Remover</button>
              </div>
              <div className="linha-2">
                <div>
                  <label>Nome do exercício</label>
                  <input list="lista-exercicios" value={ex.nome} onChange={e => mudar(i, 'nome', e.target.value)} placeholder="Digite ou escolha" />
                </div>
                <div>
                  <label>Vídeo do YouTube (link)</label>
                  <input value={ex.video || ''} onChange={e => mudar(i, 'video', e.target.value)} placeholder="https://youtube.com/..." />
                </div>
              </div>
              <div className="linha-4">
                <div>
                  <label>Séries</label>
                  <input type="number" min="1" value={ex.series} onChange={e => mudar(i, 'series', Number(e.target.value))} />
                </div>
                <div>
                  <label>Repetições</label>
                  <input type="number" min="1" value={ex.reps} onChange={e => mudar(i, 'reps', Number(e.target.value))} />
                </div>
                <div>
                  <label>Carga (kg)</label>
                  <input value={ex.carga} onChange={e => mudar(i, 'carga', e.target.value)} placeholder="kg" />
                </div>
                <div>
                  <label>Descanso (seg)</label>
                  <input type="number" min="0" value={ex.descanso} onChange={e => mudar(i, 'descanso', Number(e.target.value))} />
                </div>
              </div>
            </div>
          ))}
          <button type="button" className="btn btn-sec" onClick={() => setExercicios([...exercicios, exercicioVazio()])}>Adicionar exercício</button>
          {salvo && <div className="ok">Treino salvo. O aluno foi notificado e o treino anterior ficou no histórico.</div>}
          <button className="btn" disabled={enviando}>{enviando ? 'Salvando...' : 'Salvar treino'}</button>
        </form>
      </div>
    </div>
  )
}
