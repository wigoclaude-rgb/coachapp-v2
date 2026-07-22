import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ref, get, set, push, remove } from 'firebase/database'
import { db } from '../../firebase'
import { BIBLIOTECA_EXERCICIOS } from '../../lib/exercicios'
import { TEMPLATES } from '../../lib/templates'
import { notificar } from '../../lib/notify'

const exercicioVazio = () => ({ nome: '', series: 3, reps: 12, carga: '', descanso: 60, video: '' })
const LETRAS = ['A', 'B', 'C', 'D', 'E', 'F']
const MAX_DIAS = 6
const diaVazio = (i) => ({ nome: 'Treino ' + (LETRAS[i] || (i + 1)), exercicios: [exercicioVazio()] })

export default function CriarTreino({ user }) {
  const { alunoId } = useParams()
  const navigate = useNavigate()
  const [nomeAluno, setNomeAluno] = useState('')
  const [planoNome, setPlanoNome] = useState('')
  const [dias, setDias] = useState([diaVazio(0)])
  const [diaAtivo, setDiaAtivo] = useState(0)
  const [treinoExistente, setTreinoExistente] = useState(null)
  const [indiceAtualExistente, setIndiceAtualExistente] = useState(0)
  const [meusTemplates, setMeusTemplates] = useState({})
  const [salvo, setSalvo] = useState(false)
  const [enviando, setEnviando] = useState(false)

  useEffect(() => {
    get(ref(db, 'personals/' + user.uid + '/alunos/' + alunoId)).then(s => {
      if (s.exists()) setNomeAluno(s.val().nome)
    })
    get(ref(db, 'personals/' + user.uid + '/meusTemplates')).then(s => {
      if (s.exists()) setMeusTemplates(s.val())
    })
    get(ref(db, 'treinos/' + alunoId)).then(s => {
      if (s.exists()) {
        const t = s.val()
        setTreinoExistente(t)
        setPlanoNome(t.nome || '')
        if (Array.isArray(t.lista) && t.lista.length > 0) {
          // Formato novo (cíclico)
          setDias(t.lista.map(d => ({
            nome: d.nome || '',
            exercicios: (d.exercicios || [exercicioVazio()]).map(ex => ({ ...exercicioVazio(), ...ex }))
          })))
          setIndiceAtualExistente(Number(t.indiceAtual) || 0)
        } else {
          // Formato antigo (treino único) → converte em um dia
          setDias([{
            nome: t.nome || 'Treino A',
            exercicios: (t.exercicios || [exercicioVazio()]).map(ex => ({ ...exercicioVazio(), ...ex }))
          }])
        }
      }
    })
  }, [alunoId, user.uid])

  const dia = dias[diaAtivo] || dias[0]

  function atualizarExercicios(fn) {
    setDias(ds => ds.map((d, i) => i === diaAtivo ? { ...d, exercicios: fn(d.exercicios) } : d))
  }
  function mudar(i, campo, valor) {
    atualizarExercicios(exs => exs.map((ex, idx) => idx === i ? { ...ex, [campo]: valor } : ex))
  }
  function addExercicio() {
    atualizarExercicios(exs => [...exs, exercicioVazio()])
  }
  function removerExercicio(i) {
    atualizarExercicios(exs => exs.filter((_, idx) => idx !== i))
  }
  function mudarNomeDia(valor) {
    setDias(ds => ds.map((d, i) => i === diaAtivo ? { ...d, nome: valor } : d))
  }

  function addDia() {
    if (dias.length >= MAX_DIAS) return
    setDias(ds => [...ds, diaVazio(ds.length)])
    setDiaAtivo(dias.length)
  }
  function removerDia(idx) {
    if (dias.length <= 1) return
    if (!confirm('Remover "' + (dias[idx].nome || 'este treino') + '"?')) return
    setDias(ds => ds.filter((_, i) => i !== idx))
    setDiaAtivo(a => Math.max(0, a >= idx ? a - 1 : a))
  }
  function moverDia(idx, dir) {
    const alvo = idx + dir
    if (alvo < 0 || alvo >= dias.length) return
    setDias(ds => {
      const novo = [...ds]
      const tmp = novo[idx]; novo[idx] = novo[alvo]; novo[alvo] = tmp
      return novo
    })
    setDiaAtivo(alvo)
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
    if (dia.exercicios.some(ex => ex.nome) && !confirm('Substituir os exercícios de "' + (dia.nome || 'este treino') + '" pelo template "' + template.nome + '"?')) return
    setDias(ds => ds.map((d, i) => i === diaAtivo
      ? { nome: d.nome || template.nome, exercicios: (template.exercicios || []).map(ex => ({ ...exercicioVazio(), ...ex })) }
      : d))
  }

  async function salvar(e) {
    e.preventDefault()
    setEnviando(true)

    // arquivar treino anterior no histórico
    if (treinoExistente) {
      await push(ref(db, 'treinosHistorico/' + alunoId), { ...treinoExistente, arquivadoEm: Date.now() })
    }

    const lista = dias
      .map(d => ({ nome: d.nome || 'Treino', exercicios: (d.exercicios || []).filter(ex => ex.nome.trim() !== '') }))
      .filter(d => d.exercicios.length > 0)

    if (lista.length === 0) {
      setEnviando(false)
      alert('Adicione pelo menos um exercício.')
      return
    }

    const indiceAtual = Math.min(indiceAtualExistente || 0, lista.length - 1)
    const novo = {
      nome: planoNome || lista[0].nome,
      lista,
      indiceAtual,
      atualizadoEm: Date.now(),
      personalId: user.uid
    }
    await set(ref(db, 'treinos/' + alunoId), novo)
    setTreinoExistente(novo)
    setIndiceAtualExistente(indiceAtual)
    notificar(alunoId, 'Seu treino foi atualizado: ' + novo.nome, '/aluno')
    setSalvo(true)
    setEnviando(false)
    setTimeout(() => setSalvo(false), 3000)
  }

  return (
    <div className="container">
      <div className="subrota-topo">
        <button className="btn btn-sec btn-sm" onClick={() => navigate('/personal')}>← Voltar</button>
        <h2 style={{ flex: 1 }}>Treino de {nomeAluno || 'aluno'}</h2>
        <button
          className="btn btn-perigo btn-sm"
          onClick={() => {
            if (confirm('Deletar TODO o treino deste aluno?')) {
              remove(ref(db, 'treinos/' + alunoId))
              navigate('/personal')
            }
          }}
        >
          Deletar
        </button>
      </div>

      <div className="card">
        <label>Nome do plano (opcional)</label>
        <input value={planoNome} onChange={e => setPlanoNome(e.target.value)} placeholder="Ex: ABC Split, Treino de Hipertrofia" />
        <p className="muted" style={{ marginTop: 6 }}>
          Crie um ou mais treinos (A, B, C...). O aluno faz um por vez e, ao concluir, o próximo aparece automaticamente — reiniciando o ciclo no fim.
        </p>

        {/* Seletor de dias/treinos */}
        <div className="dias-tabs">
          {dias.map((d, i) => (
            <button
              key={i}
              className={'dia-tab ' + (diaAtivo === i ? 'ativo' : '')}
              onClick={() => setDiaAtivo(i)}
              type="button"
            >
              <span className="dia-letra">{LETRAS[i] || i + 1}</span>
              <span className="dia-nome-tab">{d.nome || 'Treino'}</span>
            </button>
          ))}
          {dias.length < MAX_DIAS && (
            <button className="dia-tab add" onClick={addDia} type="button">+ Treino</button>
          )}
        </div>
      </div>

      {/* Editor do dia ativo */}
      <div className="card">
        <div className="card-titulo">
          <h2>Treino {LETRAS[diaAtivo] || diaAtivo + 1}</h2>
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="btn btn-ghost btn-sm" type="button" onClick={() => moverDia(diaAtivo, -1)} disabled={diaAtivo === 0} title="Mover para cima">↑</button>
            <button className="btn btn-ghost btn-sm" type="button" onClick={() => moverDia(diaAtivo, 1)} disabled={diaAtivo === dias.length - 1} title="Mover para baixo">↓</button>
            {dias.length > 1 && <button className="btn btn-sec btn-sm" type="button" onClick={() => removerDia(diaAtivo)}>Remover</button>}
          </div>
        </div>

        <label>Nome deste treino</label>
        <input value={dia.nome} onChange={e => mudarNomeDia(e.target.value)} placeholder="Ex: Treino A - Peito e Tríceps" />

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

        <h3 style={{ margin: '20px 0 6px' }}>Exercícios</h3>
        <p className="muted" style={{ marginBottom: 10 }}>
          Digite ou escolha o exercício na lista. O link do YouTube mostra a execução para o aluno.
        </p>

        <datalist id="lista-exercicios">
          {BIBLIOTECA_EXERCICIOS.map(ex => <option key={ex} value={ex} />)}
        </datalist>

        {dia.exercicios.map((ex, i) => (
          <div className="exercicio-editor" key={i}>
            <div className="exercicio-editor-topo">
              <strong>Exercício {i + 1}</strong>
              <button type="button" className="remove-btn" onClick={() => removerExercicio(i)}>Remover</button>
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
        <button type="button" className="btn btn-sec" onClick={addExercicio}>+ Adicionar exercício</button>

        {salvo && <div className="ok">Treino salvo. O aluno foi notificado e o treino anterior ficou no histórico.</div>}
        <button className="btn" disabled={enviando} onClick={salvar}>{enviando ? 'Salvando...' : 'Salvar treino'}</button>
      </div>
    </div>
  )
}
