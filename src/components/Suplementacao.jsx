import { useEffect, useMemo, useState } from 'react'
import { ref, onValue, push, update, remove } from 'firebase/database'
import { db } from '../firebase'
import {
  DIAS_SEMANA, QUEM_INDICOU, diaISO, suplementoVazio, normalizarSuplemento,
  tocaHoje, vezesNoDia, sequencia, aderencia, resumoSuplemento
} from '../lib/suplementos'
import { IcMais, IcCheck, IcLixeira, IcEditar, IcFogo, IcAlerta } from './Icones.jsx'

/*
  Tela de suplementação, usada pelos dois lados.

  `podeMarcar` só é verdadeiro para o aluno: quem toma é ele. O personal cadastra
  e acompanha, mas não confirma dose — senão a aderência deixa de significar algo.
*/
export default function Suplementacao({ alunoId, podeMarcar = false, quemSou = 'proprio', nomeAluno }) {
  const [suplementos, setSuplementos] = useState({})
  const [tomados, setTomados] = useState({})
  const [form, setForm] = useState(null)   // objeto em edição, ou null
  const [editandoId, setEditandoId] = useState(null)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  useEffect(() => {
    if (!alunoId) return
    const u1 = onValue(ref(db, 'suplementos/' + alunoId), s => setSuplementos(s.val() || {}))
    const u2 = onValue(ref(db, 'suplementosTomados/' + alunoId), s => setTomados(s.val() || {}))
    return () => { u1(); u2() }
  }, [alunoId])

  const lista = useMemo(() => (
    Object.entries(suplementos)
      .map(([id, s]) => ({ id, ...normalizarSuplemento(s) }))
      .sort((a, b) => (a.nome || '').localeCompare(b.nome || ''))
  ), [suplementos])

  const hoje = diaISO()
  const doDia = lista.filter(s => tocaHoje(s))
  const pendentes = doDia.filter(s => vezesNoDia(tomados, s.id, hoje) < s.vezesAoDia)

  /* ---------- ações ---------- */

  async function marcar(sup) {
    if (!podeMarcar) return
    const feitas = vezesNoDia(tomados, sup.id, hoje)
    if (feitas >= sup.vezesAoDia) return
    try {
      await update(ref(db, `suplementosTomados/${alunoId}/${hoje}/${sup.id}`), {
        vezes: feitas + 1,
        ts: Date.now()
      })
      setErro('')
    } catch (err) {
      setErro('Não foi possível registrar a dose. Tente de novo.')
      console.warn('Falha ao marcar suplemento:', err)
    }
  }

  async function desmarcar(sup) {
    if (!podeMarcar) return
    const feitas = vezesNoDia(tomados, sup.id, hoje)
    if (feitas <= 0) return
    if (feitas === 1) {
      await remove(ref(db, `suplementosTomados/${alunoId}/${hoje}/${sup.id}`))
    } else {
      await update(ref(db, `suplementosTomados/${alunoId}/${hoje}/${sup.id}`), { vezes: feitas - 1 })
    }
  }

  async function salvar(e) {
    e.preventDefault()
    if (!form.nome.trim() || salvando) return
    setSalvando(true)
    setErro('')

    const dados = {
      ...form,
      nome: form.nome.trim(),
      marca: form.marca.trim(),
      dose: form.dose.trim(),
      observacao: form.observacao.trim(),
      vezesAoDia: Math.max(1, Number(form.vezesAoDia) || 1)
    }

    try {
      if (editandoId) {
        await update(ref(db, `suplementos/${alunoId}/${editandoId}`), dados)
      } else {
        await push(ref(db, 'suplementos/' + alunoId), {
          ...dados, inicio: Date.now(), criadoPor: quemSou
        })
      }
      setForm(null); setEditandoId(null)
    } catch (err) {
      // Sem isto o botão ficava preso em "Salvando..." e ninguém descobria por quê.
      setErro(
        String(err?.message || '').toLowerCase().includes('permission')
          ? 'O banco recusou a gravação. As regras de "suplementos" precisam ser publicadas no Firebase.'
          : 'Não foi possível salvar. Confira sua conexão e tente de novo.'
      )
      console.warn('Falha ao salvar suplemento:', err)
    }
    setSalvando(false)
  }

  async function apagar(sup) {
    if (!confirm(`Remover ${sup.nome} da lista?`)) return
    await remove(ref(db, `suplementos/${alunoId}/${sup.id}`))
  }

  function editar(sup) {
    const { id, ...resto } = sup
    setForm({ ...suplementoVazio(), ...resto })
    setEditandoId(id)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const mudar = (campo, valor) => setForm(f => ({ ...f, [campo]: valor }))

  function alternarDia(d) {
    setForm(f => ({
      ...f,
      dias: f.dias.includes(d) ? f.dias.filter(x => x !== d) : [...f.dias, d]
    }))
  }

  /* ---------- tela ---------- */

  return (
    <>
      {/* --- o que falta hoje --- */}
      {doDia.length > 0 && (
        <div className="card">
          <div className="card-titulo">
            <div style={{ minWidth: 0 }}>
              <h2>Hoje</h2>
              <p className="mini">
                {pendentes.length === 0
                  ? 'Tudo tomado. '
                  : `${pendentes.length} de ${doDia.length} ainda ${pendentes.length === 1 ? 'falta' : 'faltam'}. `}
                {podeMarcar ? 'Toque para marcar.' : `Quem marca é ${(nomeAluno || 'o aluno').split(' ')[0]}.`}
              </p>
            </div>
          </div>

          {erro && !form && <div className="erro">{erro}</div>}

          <div className="sup-hoje">
            {doDia.map(sup => {
              const feitas = vezesNoDia(tomados, sup.id, hoje)
              const ok = feitas >= sup.vezesAoDia
              return (
                <div key={sup.id} className={'sup-dose' + (ok ? ' ok' : '')}>
                  <div className="sup-dose-txt">
                    <span className="sup-dose-nome">{sup.nome}</span>
                    <span className="sup-dose-meta">
                      {sup.dose}{sup.marca ? ' · ' + sup.marca : ''}
                      {sup.horario ? ' · ' + sup.horario : ''}
                    </span>
                  </div>

                  {sup.vezesAoDia > 1 && (
                    <span className="sup-contagem">{feitas}/{sup.vezesAoDia}</span>
                  )}

                  {podeMarcar ? (
                    ok ? (
                      <button className="sup-btn feito" onClick={() => desmarcar(sup)} title="Desfazer">
                        <IcCheck /> Tomei
                      </button>
                    ) : (
                      <button className="sup-btn" onClick={() => marcar(sup)}>
                        Marcar
                      </button>
                    )
                  ) : (
                    <span className={'sup-selo' + (ok ? ' ok' : '')}>
                      {ok ? 'tomou' : 'pendente'}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* --- formulário --- */}
      <div className="barra-filtros">
        <span className="section-title" style={{ margin: 0 }}>
          {lista.length} suplemento{lista.length === 1 ? '' : 's'}
        </span>
        <button
          className="btn btn-sm"
          onClick={() => {
            if (form) { setForm(null); setEditandoId(null) }
            else setForm(suplementoVazio())
          }}
        >
          {form ? 'Fechar' : <><IcMais /> Adicionar</>}
        </button>
      </div>

      {form && (
        <div className="card">
          <div className="card-titulo">
            <h2>{editandoId ? 'Editar suplemento' : 'Novo suplemento'}</h2>
          </div>
          <form onSubmit={salvar}>
            <div className="linha-2">
              <div>
                <label>Suplemento</label>
                <input value={form.nome} onChange={e => mudar('nome', e.target.value)} placeholder="Ex: Creatina" required />
              </div>
              <div>
                <label>Marca (opcional)</label>
                <input value={form.marca} onChange={e => mudar('marca', e.target.value)} placeholder="Ex: Growth" />
              </div>
            </div>

            <div className="linha-2">
              <div>
                <label>Dose</label>
                <input value={form.dose} onChange={e => mudar('dose', e.target.value)} placeholder="Ex: 2 scoops (3g)" />
              </div>
              <div>
                <label>Vezes ao dia</label>
                <input
                  type="number" min="1" max="8"
                  value={form.vezesAoDia}
                  onChange={e => mudar('vezesAoDia', e.target.value)}
                />
              </div>
            </div>

            <label>Quando tomar</label>
            <div className="opcoes-chips">
              <button
                type="button"
                className={'chip-opcao ' + (form.frequencia === 'diario' ? 'ativo' : '')}
                onClick={() => mudar('frequencia', 'diario')}
              >
                Todo dia
              </button>
              <button
                type="button"
                className={'chip-opcao ' + (form.frequencia === 'dias' ? 'ativo' : '')}
                onClick={() => mudar('frequencia', 'dias')}
              >
                Dias específicos
              </button>
            </div>

            {form.frequencia === 'dias' && (
              <div className="opcoes-chips" style={{ marginTop: 8 }}>
                {DIAS_SEMANA.map((d, i) => (
                  <button
                    key={i}
                    type="button"
                    className={'chip-opcao ' + (form.dias.includes(i) ? 'ativo' : '')}
                    onClick={() => alternarDia(i)}
                  >
                    {d}
                  </button>
                ))}
              </div>
            )}

            <div className="linha-2" style={{ marginTop: 14 }}>
              <div>
                <label>Horário (opcional)</label>
                <input type="time" value={form.horario} onChange={e => mudar('horario', e.target.value)} />
              </div>
              <div>
                <label>Indicado por</label>
                <select value={form.indicadoPor} onChange={e => mudar('indicadoPor', e.target.value)}>
                  {QUEM_INDICOU.map(q => <option key={q.id} value={q.id}>{q.rotulo}</option>)}
                </select>
              </div>
            </div>

            <label>Observação (opcional)</label>
            <textarea
              rows={2}
              value={form.observacao}
              onChange={e => mudar('observacao', e.target.value)}
              placeholder="Ex: tomar junto com o pós-treino"
            />

            {erro && <div className="erro">{erro}</div>}

            <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
              <button className="btn" disabled={salvando}>
                {salvando ? 'Salvando...' : editandoId ? 'Salvar' : 'Adicionar'}
              </button>
              <button
                type="button" className="btn btn-sec btn-auto"
                onClick={() => { setForm(null); setEditandoId(null) }}
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* --- lista --- */}
      {lista.length === 0 && !form && (
        <div className="card">
          <div className="vazio-estado">
            <div className="ve-icone"><IcAlerta /></div>
            <h2>Nenhum suplemento cadastrado</h2>
            <p className="muted">
              Cadastre o que {podeMarcar ? 'você toma' : 'o aluno toma'} para acompanhar a constância.
            </p>
          </div>
        </div>
      )}

      {lista.map(sup => {
        const seq = sequencia(sup, sup.id, tomados)
        const ad = aderencia(sup, sup.id, tomados, 30)
        const indicou = QUEM_INDICOU.find(q => q.id === sup.indicadoPor)
        return (
          <div key={sup.id} className={'sup-card' + (sup.ativo ? '' : ' pausado')}>
            <div className="sup-card-topo">
              <div style={{ minWidth: 0 }}>
                <div className="sup-nome">
                  {sup.nome}
                  {sup.marca && <span className="sup-marca">{sup.marca}</span>}
                </div>
                <div className="sup-resumo">{resumoSuplemento(sup)}</div>
              </div>
              <div className="sup-acoes">
                <button className="btn btn-ghost btn-sm" onClick={() => editar(sup)} title="Editar"><IcEditar /></button>
                <button className="btn btn-perigo-sutil btn-sm" onClick={() => apagar(sup)} title="Remover"><IcLixeira /></button>
              </div>
            </div>

            <div className="sup-numeros">
              <div className="sup-num">
                <IcFogo />
                <span><strong>{seq}</strong> dia{seq === 1 ? '' : 's'} seguido{seq === 1 ? '' : 's'}</span>
              </div>
              <div className="sup-num">
                <span className="sup-ad">
                  {ad === null ? '—' : ad + '%'}
                </span>
                <span>nos últimos 30 dias</span>
              </div>
              {indicou && <span className="sup-tag">{indicou.rotulo}</span>}
              {!sup.ativo && <span className="sup-tag pausado">Pausado</span>}
            </div>

            {sup.observacao && <p className="sup-obs">{sup.observacao}</p>}

            <button
              className="btn btn-ghost btn-sm btn-auto"
              onClick={() => update(ref(db, `suplementos/${alunoId}/${sup.id}`), { ativo: !sup.ativo })}
            >
              {sup.ativo ? 'Pausar' : 'Retomar'}
            </button>
          </div>
        )
      })}
    </>
  )
}
