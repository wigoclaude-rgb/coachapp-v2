import { useEffect, useMemo, useState } from 'react'
import { ref, onValue, push, update, remove } from 'firebase/database'
import { db } from '../firebase'
import {
  diaISO, suplementoVazio, normalizarSuplemento, estaPausado,
  rotinaDeHoje, sequencia, melhorSequencia, vezesNoDia
} from '../lib/suplementos'
import { agruparBlocos, normalizarPlano, indiceSeguro } from '../lib/treinoModel'
import RotinaHoje from './suplementacao/RotinaHoje.jsx'
import Consistencia from './suplementacao/Consistencia.jsx'
import CardSuplemento from './suplementacao/CardSuplemento.jsx'
import FormSuplemento from './suplementacao/FormSuplemento.jsx'
import { IcMais, IcSuplemento } from './Icones.jsx'

/*
  Acompanhamento da rotina de suplementação.

  A ordem da tela é ação → contexto → progresso → gerenciamento: primeiro o que
  tomar agora, depois o dia inteiro, a constância, e só então a lista e o
  cadastro. A versão anterior abria pelo cadastro, o que colocava um formulário
  entre a pessoa e a dose das 5h.

  `podeMarcar` só é verdadeiro para o aluno: quem toma é ele. O personal cadastra
  e acompanha, mas não confirma dose — senão a aderência deixa de significar algo.
*/
export default function Suplementacao({ alunoId, podeMarcar = false, quemSou = 'proprio', nomeAluno }) {
  const [suplementos, setSuplementos] = useState({})
  const [tomados, setTomados] = useState({})
  const [execucoes, setExecucoes] = useState({})
  const [treinoBruto, setTreinoBruto] = useState(null)

  const [carregando, setCarregando] = useState(true)
  const [erroCarga, setErroCarga] = useState('')
  const [erroAcao, setErroAcao] = useState('')
  const [marcando, setMarcando] = useState('')

  const [form, setForm] = useState(null)
  const [editandoId, setEditandoId] = useState(null)
  const [salvando, setSalvando] = useState(false)
  const [filtroLista, setFiltroLista] = useState('ativos')

  useEffect(() => {
    if (!alunoId) return
    const falha = e => {
      setErroCarga('Não foi possível carregar seus suplementos. Verifique a conexão.')
      console.warn('Falha ao ler suplementação:', e?.code || e)
      setCarregando(false)
    }
    const u1 = onValue(ref(db, 'suplementos/' + alunoId), s => {
      setSuplementos(s.val() || {}); setCarregando(false)
    }, falha)
    const u2 = onValue(ref(db, 'suplementosTomados/' + alunoId), s => setTomados(s.val() || {}), falha)
    // Para a frequência "apenas dias de treino" e o bloco de pós-treino.
    const u3 = onValue(ref(db, 'execucoes/' + alunoId), s => setExecucoes(s.val() || {}), () => {})
    const u4 = onValue(ref(db, 'treinos/' + alunoId), s => setTreinoBruto(s.exists() ? s.val() : null), () => {})
    return () => { u1(); u2(); u3(); u4() }
  }, [alunoId])

  const lista = useMemo(() => (
    Object.entries(suplementos)
      .map(([id, s]) => ({ id, ...normalizarSuplemento(s) }))
      .sort((a, b) => (a.nome || '').localeCompare(b.nome || ''))
  ), [suplementos])

  /* O treino de hoje, quando houve — é o que dá contexto ao pós-treino. */
  const treinoDeHoje = useMemo(() => {
    const hoje = new Date().toDateString()
    const doDia = Object.values(execucoes).filter(e => new Date(e.ts).toDateString() === hoje)
    if (doDia.length === 0) return null

    const plano = normalizarPlano(treinoBruto)
    const dia = plano ? plano.lista[indiceSeguro(plano.indiceAtual, plano.lista.length)] : null
    return {
      nome: dia?.nome || 'Treino de hoje',
      exercicios: new Set(doDia.map(e => e.exercicio)).size
    }
  }, [execucoes, treinoBruto])

  const rotina = useMemo(
    () => rotinaDeHoje(lista, tomados, new Date(), !!treinoDeHoje),
    [lista, tomados, treinoDeHoje]
  )

  /* Sequência da rotina inteira: o menor entre os suplementos ativos. */
  const { seqAtual, seqMelhor } = useMemo(() => {
    const ativos = lista.filter(s => !estaPausado(s))
    if (ativos.length === 0) return { seqAtual: 0, seqMelhor: 0 }
    return {
      seqAtual: Math.min(...ativos.map(s => sequencia(s, s.id, tomados))),
      seqMelhor: Math.max(...ativos.map(s => melhorSequencia(s, s.id, tomados)))
    }
  }, [lista, tomados])

  const visiveis = useMemo(() => {
    if (filtroLista === 'ativos') return lista.filter(s => !estaPausado(s))
    if (filtroLista === 'pausados') return lista.filter(s => estaPausado(s))
    return lista
  }, [lista, filtroLista])

  /* ---------------- ações ---------------- */

  async function marcar(sup) {
    if (!podeMarcar || marcando) return
    const dia = diaISO()
    const feitas = vezesNoDia(tomados, sup.id, dia)
    if (feitas >= sup.vezesAoDia) return      // já completo: evita registro duplicado

    setMarcando(sup.id); setErroAcao('')
    try {
      await update(ref(db, `suplementosTomados/${alunoId}/${dia}/${sup.id}`), {
        vezes: feitas + 1, ts: Date.now()
      })
    } catch (err) {
      setErroAcao('Não foi possível registrar a dose. Tente de novo.')
      console.warn('Falha ao marcar dose:', err)
    }
    setMarcando('')
  }

  async function desmarcar(sup) {
    if (!podeMarcar || marcando) return
    const dia = diaISO()
    const feitas = vezesNoDia(tomados, sup.id, dia)
    if (feitas <= 0) return

    setMarcando(sup.id); setErroAcao('')
    try {
      if (feitas === 1) await remove(ref(db, `suplementosTomados/${alunoId}/${dia}/${sup.id}`))
      else await update(ref(db, `suplementosTomados/${alunoId}/${dia}/${sup.id}`), { vezes: feitas - 1 })
    } catch (err) {
      setErroAcao('Não foi possível desfazer. Tente de novo.')
    }
    setMarcando('')
  }

  async function marcarTodas() {
    for (const s of rotina.pendentes) await marcar(s)
  }

  async function salvar(e) {
    e.preventDefault()
    if (!form.nome.trim() || salvando) return
    setSalvando(true); setErroAcao('')

    const dados = {
      ...form,
      nome: form.nome.trim(),
      marca: form.marca.trim(),
      dose: form.dose.trim(),
      observacao: form.observacao.trim(),
      vezesAoDia: Math.max(1, Number(form.vezesAoDia) || 1),
      // Pós-treino não tem hora do relógio; o momento é que manda.
      horario: form.frequencia === 'treino' ? '' : form.horario
    }

    try {
      if (editandoId) await update(ref(db, `suplementos/${alunoId}/${editandoId}`), dados)
      else await push(ref(db, 'suplementos/' + alunoId), { ...dados, inicio: Date.now(), criadoPor: quemSou })
      setForm(null); setEditandoId(null)
    } catch (err) {
      setErroAcao(
        String(err?.message || '').toLowerCase().includes('permission')
          ? 'O banco recusou a gravação. As regras de "suplementos" precisam estar publicadas no Firebase.'
          : 'Não foi possível salvar. Confira sua conexão e tente de novo.'
      )
      console.warn('Falha ao salvar suplemento:', err)
    }
    setSalvando(false)
  }

  const pausar = (sup, ate) => update(ref(db, `suplementos/${alunoId}/${sup.id}`), { pausadoAte: ate, ativo: true })
  const retomar = sup => update(ref(db, `suplementos/${alunoId}/${sup.id}`), { pausadoAte: null, ativo: true })

  async function excluir(sup) {
    if (!confirm(`Remover ${sup.nome} da sua rotina?\n\nO histórico de doses já registradas é mantido.`)) return
    await remove(ref(db, `suplementos/${alunoId}/${sup.id}`))
  }

  function editar(sup) {
    const { id, ...resto } = sup
    setForm({ ...suplementoVazio(), ...resto })
    setEditandoId(id)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  /* ---------------- tela ---------------- */

  if (carregando) return <p className="muted">Carregando sua rotina...</p>

  if (erroCarga) {
    return (
      <div className="card">
        <div className="vazio-estado">
          <h2>Não deu para carregar</h2>
          <p className="muted">{erroCarga}</p>
          <button className="btn btn-sm btn-auto" onClick={() => window.location.reload()}>Tentar de novo</button>
        </div>
      </div>
    )
  }

  if (lista.length === 0 && !form) {
    return (
      <div className="card">
        <div className="vazio-estado">
          <div className="ve-icone"><IcSuplemento /></div>
          <h2>Sua rotina começa aqui</h2>
          <p className="muted">
            {podeMarcar
              ? 'Cadastre o que você toma para acompanhar a constância dia a dia.'
              : `Cadastre o que ${(nomeAluno || 'o aluno').split(' ')[0]} deve tomar.`}
          </p>
          <button className="btn btn-sm btn-auto" style={{ marginTop: 14 }} onClick={() => setForm(suplementoVazio())}>
            <IcMais /> Adicionar suplemento
          </button>
        </div>
      </div>
    )
  }

  return (
    <>
      {erroAcao && <div className="erro">{erroAcao}</div>}

      <RotinaHoje
        rotina={rotina}
        podeMarcar={podeMarcar}
        nomeAluno={nomeAluno}
        treinoDeHoje={treinoDeHoje}
        onMarcar={marcar}
        onDesmarcar={desmarcar}
        marcando={marcando}
      />

      {podeMarcar && rotina.pendentes.length > 1 && (
        <button className="btn btn-sec sp-todas" onClick={marcarTodas} disabled={!!marcando}>
          Marcar as {rotina.pendentes.length} restantes
        </button>
      )}

      {rotina.itens.length === 0 && lista.length > 0 && (
        <div className="card">
          <p className="muted" style={{ margin: 0 }}>
            Nada previsto para hoje. Seus suplementos estão pausados ou marcados
            para outros dias.
          </p>
        </div>
      )}

      <Consistencia
        lista={lista}
        tomados={tomados}
        sequenciaAtual={seqAtual}
        melhor={seqMelhor}
      />

      <div className="barra-filtros">
        <div className="sp-filtros" style={{ margin: 0 }}>
          {[
            { id: 'ativos', rotulo: 'Ativos' },
            { id: 'pausados', rotulo: 'Pausados' },
            { id: 'todos', rotulo: 'Todos' }
          ].map(f => (
            <button
              key={f.id} type="button"
              className={'sp-filtro' + (filtroLista === f.id ? ' ativo' : '')}
              onClick={() => setFiltroLista(f.id)}
              aria-pressed={filtroLista === f.id}
            >
              {f.rotulo}
            </button>
          ))}
        </div>
        <button
          className="btn btn-sm"
          onClick={() => (form ? (setForm(null), setEditandoId(null)) : setForm(suplementoVazio()))}
        >
          {form ? 'Fechar' : <><IcMais /> Adicionar</>}
        </button>
      </div>

      {form && (
        <FormSuplemento
          form={form}
          onMudar={setForm}
          onSalvar={salvar}
          onCancelar={() => { setForm(null); setEditandoId(null) }}
          salvando={salvando}
          editando={!!editandoId}
          erro={erroAcao}
        />
      )}

      {visiveis.length === 0 && !form && (
        <p className="muted">
          {filtroLista === 'pausados' ? 'Nenhum suplemento pausado.' : 'Nenhum suplemento ativo.'}
        </p>
      )}

      {visiveis.map(sup => (
        <CardSuplemento
          key={sup.id}
          sup={sup}
          tomados={tomados}
          onEditar={editar}
          onPausar={pausar}
          onRetomar={retomar}
          onExcluir={excluir}
        />
      ))}
    </>
  )
}
