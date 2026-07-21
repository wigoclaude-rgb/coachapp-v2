import { useEffect, useState } from 'react'
import { ref, onValue, push, update, remove } from 'firebase/database'
import { db } from '../../firebase'
import { BIBLIOTECA_EXERCICIOS } from '../../lib/exercicios'

export default function MeusTemplates({ user }) {
  const [templates, setTemplates] = useState([])
  const [nome, setNome] = useState('')
  const [exercicios, setExercicios] = useState([{ nome: '', series: 3, reps: 12, carga: '', descanso: 60, video: '' }])
  const [editando, setEditando] = useState(null)
  const [mostrarForm, setMostrarForm] = useState(false)

  useEffect(() => {
    if (!user?.uid) return
    
    const unsub = onValue(ref(db, `personals/${user.uid}/meusTemplates`), (snap) => {
      if (snap.exists()) {
        const dados = snap.val()
        const lista = Object.entries(dados).map(([id, dados]) => ({ id, ...dados }))
        setTemplates(lista)
      } else {
        setTemplates([])
      }
    })
    
    return unsub
  }, [user?.uid])

  function adicionarExercicio() {
    setExercicios([...exercicios, { nome: '', series: 3, reps: 12, carga: '', descanso: 60, video: '' }])
  }

  function removerExercicio(idx) {
    setExercicios(exercicios.filter((_, i) => i !== idx))
  }

  function mudarExercicio(idx, campo, valor) {
    const novo = [...exercicios]
    novo[idx][campo] = valor
    setExercicios(novo)
  }

  async function salvar(e) {
    e.preventDefault()
    if (!nome.trim() || exercicios.filter(ex => ex.nome).length === 0) {
      alert('Preencha o nome e adicione pelo menos um exercício')
      return
    }

    const template = {
      nome,
      exercicios: exercicios.filter(ex => ex.nome),
      criadoEm: Date.now()
    }

    if (editando) {
      await update(ref(db, `personals/${user.uid}/meusTemplates/${editando}`), template)
      setEditando(null)
    } else {
      await push(ref(db, `personals/${user.uid}/meusTemplates`), template)
    }

    setNome('')
    setExercicios([{ nome: '', series: 3, reps: 12, carga: '', descanso: 60, video: '' }])
    setMostrarForm(false)
  }

  function editar(template) {
    setEditando(template.id)
    setNome(template.nome)
    setExercicios(template.exercicios || [{ nome: '', series: 3, reps: 12, carga: '', descanso: 60, video: '' }])
    setMostrarForm(true)
  }

  async function deletar(id) {
    if (confirm('Deletar este template?')) {
      await remove(ref(db, `personals/${user.uid}/meusTemplates/${id}`))
    }
  }

  function limpar() {
    setNome('')
    setExercicios([{ nome: '', series: 3, reps: 12, carga: '', descanso: 60, video: '' }])
    setEditando(null)
    setMostrarForm(false)
  }

  return (
    <div className="container">
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2>Meus Templates de Treino</h2>
          <button className="btn btn-sm" onClick={() => { if (mostrarForm) limpar(); else setMostrarForm(true) }}>
            {mostrarForm ? 'Fechar' : '+ Criar Template'}
          </button>
        </div>

        {mostrarForm && (
          <form onSubmit={salvar} style={{ borderTop: '1px solid #eee', paddingTop: 20, marginBottom: 20 }}>
            <label>Nome do Template</label>
            <input value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex: Treino A - Peito" required />

            <h3 style={{ margin: '20px 0 10px' }}>Exercícios</h3>
            <datalist id="exercicios-list">
              {BIBLIOTECA_EXERCICIOS.map(ex => <option key={ex} value={ex} />)}
            </datalist>

            {exercicios.map((ex, i) => (
              <div key={i} style={{ background: '#f9f9f9', padding: 15, borderRadius: 8, marginBottom: 15 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                  <strong>Exercício {i + 1}</strong>
                  <button type="button" className="remove-btn" onClick={() => removerExercicio(i)}>Remover</button>
                </div>

                <label>Nome</label>
                <input list="exercicios-list" value={ex.nome} onChange={e => mudarExercicio(i, 'nome', e.target.value)} placeholder="Digite ou escolha" required />

                <label>Vídeo YouTube (opcional)</label>
                <input value={ex.video} onChange={e => mudarExercicio(i, 'video', e.target.value)} placeholder="https://youtube.com/..." />

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 10 }}>
                  <div>
                    <label>Séries</label>
                    <input type="number" min="1" value={ex.series} onChange={e => mudarExercicio(i, 'series', Number(e.target.value))} />
                  </div>
                  <div>
                    <label>Reps</label>
                    <input type="number" min="1" value={ex.reps} onChange={e => mudarExercicio(i, 'reps', Number(e.target.value))} />
                  </div>
                  <div>
                    <label>Carga (kg)</label>
                    <input value={ex.carga} onChange={e => mudarExercicio(i, 'carga', e.target.value)} />
                  </div>
                  <div>
                    <label>Descanso (seg)</label>
                    <input type="number" min="0" value={ex.descanso} onChange={e => mudarExercicio(i, 'descanso', Number(e.target.value))} />
                  </div>
                </div>
              </div>
            ))}

            <button type="button" className="btn btn-sec" onClick={adicionarExercicio} style={{ marginBottom: 15 }}>+ Adicionar Exercício</button>
            <button type="submit" className="btn">{editando ? 'Atualizar' : 'Criar'} Template</button>
          </form>
        )}
      </div>

      <div className="card">
        <h2>Templates Criados ({templates.length})</h2>
        {templates.length === 0 && <p className="muted">Nenhum template ainda. Clique em "+ Criar Template" para começar.</p>}
        
        {templates.map(t => (
          <div key={t.id} style={{ background: '#f9f9f9', padding: 15, borderRadius: 8, marginBottom: 15 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
              <strong>{t.nome}</strong>
              <span className="muted">{(t.exercicios || []).length} exercício(s)</span>
            </div>
            
            {(t.exercicios || []).map((ex, i) => (
              <div key={i} style={{ fontSize: 13, padding: 8, borderLeft: '3px solid #610A13' }}>
                <strong>{ex.nome}</strong> • {ex.series}x{ex.reps} {ex.carga && `• ${ex.carga}kg`}
              </div>
            ))}
            
            <div style={{ display: 'flex', gap: 10, marginTop: 15 }}>
              <button className="btn btn-sm" onClick={() => editar(t)}>Editar</button>
              <button className="btn btn-sec btn-sm" onClick={() => deletar(t.id)}>Deletar</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
