import { useEffect, useMemo, useState } from 'react'
import { ref, onValue, push, update, remove } from 'firebase/database'
import { db } from '../../firebase'
import { normalizarTemplate, LETRAS, MAX_DIAS, exercicioVazio, diaVazio, resumoLinhas } from '../../lib/treinoModel'
import EditorExercicios from '../../components/EditorExercicios.jsx'
import { IcTemplates, IcBusca, IcMais, IcEditar, IcLixeira, IcDuplicar } from '../../components/Icones.jsx'

export default function MeusTemplates({ user }) {
  const [templates, setTemplates] = useState([])
  const [busca, setBusca] = useState('')
  const [nome, setNome] = useState('')
  const [dias, setDias] = useState([diaVazio(0)])
  const [diaAtivo, setDiaAtivo] = useState(0)
  const [editando, setEditando] = useState(null)
  const [mostrarForm, setMostrarForm] = useState(false)

  useEffect(() => {
    if (!user?.uid) return
    return onValue(ref(db, `personals/${user.uid}/meusTemplates`), snap => {
      const dados = snap.val() || {}
      setTemplates(Object.entries(dados).map(([id, t]) => ({ id, ...normalizarTemplate(t) })))
    })
  }, [user?.uid])

  const visiveis = useMemo(() => {
    const q = busca.trim().toLowerCase()
    if (!q) return templates
    return templates.filter(t =>
      t.nome.toLowerCase().includes(q) ||
      t.lista.some(d => d.nome.toLowerCase().includes(q) || d.exercicios.some(ex => (ex.nome || '').toLowerCase().includes(q)))
    )
  }, [templates, busca])

  // Coleta todos os nomes de exercícios já criados (sem duplicatas) para autocomplete
  const exerciciosCriados = useMemo(() => {
    const nomes = new Set()
    templates.forEach(t => {
      t.lista.forEach(d => {
        d.exercicios.forEach(ex => {
          if (ex.nome?.trim()) nomes.add(ex.nome.trim())
        })
      })
    })
    return Array.from(nomes).sort()
  }, [templates])

  const dia = dias[diaAtivo] || dias[0]

  function atualizarDia(fn) {
    setDias(ds => ds.map((d, i) => (i === diaAtivo ? fn(d) : d)))
  }

  function addDia() {
    if (dias.length >= MAX_DIAS) return
    setDias(ds => [...ds, diaVazio(ds.length)])
    setDiaAtivo(dias.length)
  }
  function removerDia(idx) {
    if (dias.length <= 1) return
    if (!confirm(`Remover "${dias[idx].nome || 'este treino'}" do template?`)) return
    setDias(ds => ds.filter((_, i) => i !== idx))
    setDiaAtivo(a => Math.max(0, a >= idx ? a - 1 : a))
  }

  async function salvar(e) {
    e.preventDefault()
    const lista = dias
      .map(d => ({ nome: d.nome || 'Treino', exercicios: (d.exercicios || []).filter(ex => (ex.nome || '').trim() !== '') }))
      .filter(d => d.exercicios.length > 0)

    if (!nome.trim() || lista.length === 0) {
      alert('Dê um nome ao template e adicione pelo menos um exercício.')
      return
    }

    const payload = { nome: nome.trim(), lista, exercicios: null, criadoEm: Date.now() }

    if (editando) await update(ref(db, `personals/${user.uid}/meusTemplates/${editando}`), payload)
    else await push(ref(db, `personals/${user.uid}/meusTemplates`), payload)

    limpar()
  }

  function editar(t) {
    setEditando(t.id)
    setNome(t.nome)
    setDias(t.lista.map(d => ({ nome: d.nome, exercicios: d.exercicios.length ? d.exercicios : [exercicioVazio()] })))
    setDiaAtivo(0)
    setMostrarForm(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function duplicar(t) {
    await push(ref(db, `personals/${user.uid}/meusTemplates`), {
      nome: `${t.nome} (cópia)`, lista: t.lista, criadoEm: Date.now()
    })
  }

  async function deletar(id) {
    if (confirm('Deletar este template?')) await remove(ref(db, `personals/${user.uid}/meusTemplates/${id}`))
  }

  function limpar() {
    setNome('')
    setDias([diaVazio(0)])
    setDiaAtivo(0)
    setEditando(null)
    setMostrarForm(false)
  }

  return (
    <>
      <div className="barra-filtros">
        <div className="campo-busca">
          <IcBusca />
          <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar template ou exercício" />
        </div>
        <button className="btn btn-sm" onClick={() => (mostrarForm ? limpar() : setMostrarForm(true))}>
          {mostrarForm ? 'Fechar' : <><IcMais /> Novo template</>}
        </button>
      </div>

      {mostrarForm && (
        <div className="card">
          <div className="card-titulo">
            <h2>{editando ? 'Editar template' : 'Novo template'}</h2>
          </div>
          <form onSubmit={salvar}>
            <label>Nome do template</label>
            <input value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex: ABC Split — Hipertrofia" required />
            <p className="mini" style={{ marginTop: 6 }}>
              Um template guarda o plano inteiro. Adicione os treinos A, B, C… e ao aplicar num aluno todos entram de uma vez.
            </p>

            <div className="dias-tabs">
              {dias.map((d, i) => (
                <button key={i} type="button" className={'dia-tab ' + (diaAtivo === i ? 'ativo' : '')} onClick={() => setDiaAtivo(i)}>
                  <span className="dia-letra">{LETRAS[i] || i + 1}</span>
                  <span className="dia-nome-tab">{d.nome || 'Treino'}</span>
                </button>
              ))}
              {dias.length < MAX_DIAS && (
                <button type="button" className="dia-tab add" onClick={addDia}><IcMais /> Treino</button>
              )}
            </div>

            <hr className="divisor" />

            <div className="card-titulo" style={{ marginBottom: 0 }}>
              <h3>Treino {LETRAS[diaAtivo] || diaAtivo + 1}</h3>
              {dias.length > 1 && (
                <button type="button" className="btn btn-perigo-sutil btn-sm" onClick={() => removerDia(diaAtivo)}>
                  <IcLixeira /> Remover treino
                </button>
              )}
            </div>

            <label>Nome deste treino</label>
            <input value={dia.nome} onChange={e => atualizarDia(d => ({ ...d, nome: e.target.value }))} placeholder="Ex: Treino A — Peito e Tríceps" />

            <label>Exercícios</label>
            <p className="mini" style={{ marginBottom: 10 }}>
              Cada linha é uma série — use várias para progressão de carga. Marque dois e clique em Combinar para bi-set.
            </p>

            <EditorExercicios
              exercicios={dia.exercicios}
              onChange={novos => atualizarDia(d => ({ ...d, exercicios: novos }))}
              pastaFotos={'exercicios/' + user.uid}
              exerciciosCriados={exerciciosCriados}
            />

            <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
              <button type="submit" className="btn">{editando ? 'Salvar alterações' : 'Criar template'}</button>
              <button type="button" className="btn btn-sec btn-auto" onClick={limpar}>Cancelar</button>
            </div>
          </form>
        </div>
      )}

      <div className="section-title">Biblioteca · {visiveis.length} template{visiveis.length === 1 ? '' : 's'}</div>

      {visiveis.length === 0 && (
        <div className="card">
          <div className="vazio-estado">
            <div className="ve-icone"><IcTemplates /></div>
            <h2>{busca ? 'Nada encontrado' : 'Nenhum template ainda'}</h2>
            <p className="muted">
              {busca ? 'Tente outro termo de busca.' : 'Crie um plano completo (A, B, C) e reutilize em quantos alunos quiser.'}
            </p>
          </div>
        </div>
      )}

      <div className="templates-grid">
        {visiveis.map(t => {
          const totalEx = t.lista.reduce((s, d) => s + d.exercicios.length, 0)
          const temBiset = t.lista.some(d => d.exercicios.some(ex => ex.grupo))
          return (
            <div key={t.id} className="template-card">
              <div className="template-card-topo">
                <span className="t-icone"><IcTemplates /></span>
                <div style={{ minWidth: 0 }}>
                  <div className="t-nome">{t.nome}</div>
                  <div className="t-qtd">
                    {t.lista.length} treino{t.lista.length === 1 ? '' : 's'} · {totalEx} exercícios
                    {temBiset ? ' · bi-set' : ''}
                  </div>
                </div>
              </div>

              <div className="template-dias">
                {t.lista.map((d, i) => (
                  <div key={i} className="template-dia">
                    <span className="td-letra">{LETRAS[i] || i + 1}</span>
                    <span className="td-nome">{d.nome}</span>
                    <span className="td-qtd">{d.exercicios.length} ex.</span>
                  </div>
                ))}
              </div>

              <div className="template-card-acoes">
                <button className="btn btn-sec btn-sm" onClick={() => editar(t)}><IcEditar /> Editar</button>
                <button className="btn btn-ghost btn-sm" onClick={() => duplicar(t)} title="Duplicar"><IcDuplicar /></button>
                <button className="btn btn-perigo-sutil btn-sm" onClick={() => deletar(t.id)} title="Deletar"><IcLixeira /></button>
              </div>
            </div>
          )
        })}
      </div>
    </>
  )
}
