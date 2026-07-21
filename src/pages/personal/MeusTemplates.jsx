import { useEffect, useState } from 'react'
import { ref, onValue, push, update, remove } from 'firebase/database'
import { db } from '../../firebase'
import { BIBLIOTECA_EXERCICIOS } from '../../lib/exercicios'

const exercicioVazio = () => ({ nome: '', series: 3, reps: 12, carga: '', descanso: 60, video: '' })

export default function MeusTemplates({ user }) {
  const [templates, setTemplates] = useState({})
  const [novoNome, setNovoNome] = useState('')
  const [exercicios, setExercicios] = useState([exercicioVazio()])
  const [editandoId, setEditandoId] = useState(null)
  const [salvo, setSalvo] = useState(false)
  const [mostrarForm, setMostrarForm] = useState(false)

  useEffect(() => {
    const unsub = onValue(ref(db, 'personals/' + user.uid + '/meusTemplates'), snap => {
      setTemplates(snap.val() || {})
    })
    return unsub
  }, [user.uid])

  function mudar(i, campo, valor) {
    const novo = [...exercicios]
    novo[i] = { ...novo[i], [campo]: valor }
    setExercicios(novo)
  }

  function limparForm() {
    setNovoNome('')
    setExercicios([exercicioVazio()])
    setEditandoId(null)
  }

  async function salvarTemplate(e) {
    e.preventDefault()
    if (!novoNome.trim()) return

    const template = {
      nome: novoNome,
      exercicios: exercicios.filter(ex => ex.nome.trim() !== ''),
      criadoEm: Date.now()
    }

    if (editandoId) {
      await update(ref(db, 'personals/' + user.uid + '/meusTemplates/' + editandoId), template)
    } else {
      await push(ref(db, 'personals/' + user.uid + '/meusTemplates'), template)
    }

    limparForm()
    setMostrarForm(false)
    setSalvo(true)
    setTimeout(() => setSalvo(false), 3000)
  }

  function editar(id, template) {
    setEditandoId(id)
    setNovoNome(template.nome)
    setExercicios((template.exercicios || [exercicioVazio()]).map(ex => ({ video: '', ...ex })))
    setMostrarForm(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function deletar(id) {
    if (confirm('Deletar este template? Essa ação não pode ser desfeita.')) {
      await remove(ref(db, 'personals/' + user.uid + '/meusTemplates/' + id))
    }
  }

  const lista = Object.entries(templates).sort((a, b) => (b[1].criadoEm || 0) - (a[1].criadoEm || 0))

  return (
    <>
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2>Meus templates de treino</h2>
          <button className="btn btn-sm" onClick={() => { if (mostrarForm) { limparForm() } setMostrarForm(!mostrarForm) }}>
            {mostrarForm ? 'Fechar' : 'Criar template'}
          </button>
        </div>
        <p className="muted" style={{ marginTop: 4 }}>
          Crie modelos de treino prontos para reutilizar ao montar o treino dos seus alunos.
        </p>

        {mostrarForm && (
          <form onSubmit={salvarTemplate} style={{ marginTop: 14, borderTop: '1px solid #ececee', paddingTop: 14 }}>
            <label>Nome do template</label>
            <input value={novoNome} onChange={e => setNovoNome(e.target.value)} placeholder="Ex: Treino A - Peito e Tríceps" required />

            <h3 style={{ margin: '18px 0 6px' }}>Exercícios</h3>
            <p className="muted" style={{ marginBottom: 10 }}>Digite ou escolha o exercício na lista. O link do YouTube é opcional.</p>

            <datalist id="lista-exercicios-template">
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
                    <input list="lista-exercicios-template" value={ex.nome} onChange={e => mudar(i, 'nome', e.target.value)} placeholder="Digite ou escolha" />
                  </div>
                  <div>
                    <label>Vídeo do YouTube (opcional)</label>
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
            <button className="btn">{editandoId ? 'Atualizar template' : 'Salvar template'}</button>
          </form>
        )}

        {salvo && <div className="ok" style={{ marginTop: 14 }}>Template salvo com sucesso.</div>}
      </div>

      <div className="card">
        <h2>Templates criados ({lista.length})</h2>
        {lista.length === 0 && <p className="muted">Nenhum template ainda. Clique em "Criar template" para começar.</p>}
        {lista.map(([id, t]) => (
          <div key={id} className="exercicio-card">
            <div className="titulo">
              <span>{t.nome}</span>
              <span className="muted">{(t.exercicios || []).length} exercício(s)</span>
            </div>
            {(t.exercicios || []).map((ex, i) => (
              <div key={i} className="serie-row">
                <span style={{ fontWeight: 600 }}>{ex.nome}</span>
                <span>{ex.series}x{ex.reps}</span>
                <span>{ex.carga ? ex.carga + ' kg' : ''}</span>
                <span className="muted">descanso {ex.descanso}s</span>
              </div>
            ))}
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button className="btn btn-sm" onClick={() => editar(id, t)}>Editar</button>
              <button className="btn btn-sec btn-sm" onClick={() => deletar(id)}>Deletar</button>
            </div>
          </div>
        ))}
      </div>
    </>
  )
}
