import { useEffect, useState } from 'react'
import { ref, onValue, push, update, remove } from 'firebase/database'
import { db } from '../../firebase'
import { BIBLIOTECA_EXERCICIOS } from '../../lib/exercicios'
import { IcTemplates } from '../../components/Icones.jsx'

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
    <>
      <div className="card">
        <div className="card-titulo">
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

      <div className="section-title">Templates criados ({templates.length})</div>
      {templates.length === 0 && (
        <div className="card">
          <div className="vazio-estado">
            <div className="ve-icone">📋</div>
            <p className="muted">Nenhum template ainda. Clique em "+ Criar Template" para começar.</p>
          </div>
        </div>
      )}

      <div className="templates-grid">
        {templates.map(t => (
          <div key={t.id} className="template-card">
            <div className="template-card-topo">
              <span className="t-icone"><IcTemplates /></span>
              <div style={{ minWidth: 0 }}>
                <div className="t-nome">{t.nome}</div>
                <div className="t-qtd">{(t.exercicios || []).length} exercício(s)</div>
              </div>
            </div>

            {(t.exercicios || []).slice(0, 4).map((ex, i) => (
              <div key={i} className="template-ex">
                <strong>{ex.nome}</strong> · {ex.series}x{ex.reps}{ex.carga ? ` · ${ex.carga}kg` : ''}
              </div>
            ))}
            {(t.exercicios || []).length > 4 && (
              <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>+{(t.exercicios || []).length - 4} exercício(s)</div>
            )}

            <div className="template-card-acoes">
              <button className="btn btn-ghost btn-sm" onClick={() => editar(t)}>Editar</button>
              <button className="btn btn-sec btn-sm" onClick={() => deletar(t.id)}>Deletar</button>
            </div>
          </div>
        ))}
      </div>
    </>
  )
}
