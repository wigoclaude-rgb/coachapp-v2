import { useEffect, useMemo, useState } from 'react'
import { ref, onValue, push, update, remove } from 'firebase/database'
import { db } from '../firebase'
import {
  diaISO, suplementoVazio, normalizarSuplemento, estaPausado, tocaHoje,
  rotinaDeHoje, sequencia, melhorSequencia, registroDoDia,
  TOMADO, NAO_REGISTRADO
} from '../lib/suplementos'
import { registrarDose, desfazerDose, limparDose, mensagemErroDose } from '../lib/doses'
import { agruparBlocos, normalizarPlano, indiceSeguro } from '../lib/treinoModel'
import RotinaHoje from './suplementacao/RotinaHoje.jsx'
import Consistencia from './suplementacao/Consistencia.jsx'
import CardSuplemento from './suplementacao/CardSuplemento.jsx'
import FormSuplemento from './suplementacao/FormSuplemento.jsx'
import FolhaDose from './suplementacao/FolhaDose.jsx'
import DiaDetalhe from './suplementacao/DiaDetalhe.jsx'
import { IcMais, IcSuplemento } from './Icones.jsx'
import { normalizarLembrete } from '../lib/lembretes'
import PainelNotificacoes from './suplementacao/PainelNotificacoes.jsx'

/*
  Acompanhamento da rotina de suplementação.

  A ordem da tela é ação → contexto → progresso → gerenciamento: primeiro o que
  tomar agora, depois o dia inteiro, a constância, e só então a lista e o
  cadastro. A versão anterior abria pelo cadastro, o que colocava um formulário
  entre a pessoa e a dose das 5h.

  `podeMarcar` só é verdadeiro para o aluno: quem toma é ele. O personal cadastra
  e acompanha, mas não confirma dose — senão a aderência deixa de significar algo.
*/
export default function Suplementacao({ alunoId, podeMarcar = false, quemSou = 'proprio', nomeAluno, destacar = null }) {
  const [suplementos, setSuplementos] = useState({})
  const [tomados, setTomados] = useState({})
  const [execucoes, setExecucoes] = useState({})
  const [treinoBruto, setTreinoBruto] = useState(null)

  const [carregando, setCarregando] = useState(true)
  const [erroCarga, setErroCarga] = useState('')
  const [erroAcao, setErroAcao] = useState('')
  const [marcando, setMarcando] = useState('')
  // { sup, dia } — a dose aberta na folha de registro, de hoje ou de outro dia.
  const [doseAberta, setDoseAberta] = useState(null)
  const [diaAberto, setDiaAberto] = useState(null)

  const [form, setForm] = useState(null)
  const [editandoId, setEditandoId] = useState(null)
  const [salvando, setSalvando] = useState(false)
  const [filtroLista, setFiltroLista] = useState('ativos')

  /*
    Chegou pela notificação: leva a tela até a dose e a destaca por alguns
    segundos. Sem isso o aluno abriria a lista inteira e teria que caçar o item
    — com sete suplementos, o lembrete perde a graça.
  */
  useEffect(() => {
    if (!destacar || carregando) return
    const alvo = document.getElementById('sup-' + destacar)
    if (!alvo) return
    alvo.scrollIntoView({ behavior: 'smooth', block: 'center' })
    alvo.classList.add('sup-destaque')
    const t = setTimeout(() => alvo.classList.remove('sup-destaque'), 4000)
    return () => clearTimeout(t)
  }, [destacar, carregando, suplementos])

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

  /*
    "Havia dose prevista neste dia?" — precisa saber se houve treino NAQUELE dia,
    senão um pós-treino aparece como omissão em todo dia de descanso. Antes o
    histórico passava `treinou = true` para todos os dias, de tão difícil que era
    responder isso sem os dados de execução em mãos.
  */
  const diasComTreino = useMemo(() => {
    const set = new Set()
    Object.values(execucoes || {}).forEach(e => { if (e?.ts) set.add(diaISO(new Date(e.ts))) })
    return set
  }, [execucoes])

  const previstoNoDia = useMemo(
    () => (sup, data) => tocaHoje(sup, data, diasComTreino.has(diaISO(data))),
    [diasComTreino]
  )

  /* ---------------- ações ---------------- */

  /*
    Um toque = "tomei". É o caso de 9 em cada 10 vezes, e ele não passa por
    formulário nenhum. Os outros dois estados ficam na folha, a um toque de
    distância no texto da dose.

    A contagem vem do servidor, dentro de uma transação (ver lib/doses.js): o
    duplo toque não cria dois registros nem pula uma dose.
  */
  async function registrar(sup, estado, dia = diaISO()) {
    if (!podeMarcar || marcando) return
    setMarcando(sup.id); setErroAcao('')
    try {
      await registrarDose({ alunoId, supId: sup.id, dia, estado, vezesAoDia: sup.vezesAoDia })
      setDoseAberta(null)
    } catch (err) {
      setErroAcao(mensagemErroDose(err))
      console.warn('Falha ao registrar dose:', err)
    }
    setMarcando('')
  }

  async function desfazer(sup, dia = diaISO()) {
    if (!podeMarcar || marcando) return
    setMarcando(sup.id); setErroAcao('')
    try {
      await desfazerDose({ alunoId, supId: sup.id, dia, vezesAoDia: sup.vezesAoDia })
    } catch (err) {
      setErroAcao(mensagemErroDose(err))
      console.warn('Falha ao desfazer dose:', err)
    }
    setMarcando('')
  }

  /* Apagar ≠ dizer que não tomou: o dia volta a "não registrado". */
  async function apagarRegistro(sup, dia) {
    if (!podeMarcar || marcando) return
    setMarcando(sup.id); setErroAcao('')
    try {
      await limparDose({ alunoId, supId: sup.id, dia })
      setDoseAberta(null)
    } catch (err) {
      setErroAcao(mensagemErroDose(err))
    }
    setMarcando('')
  }

  /* Atalho para quem toma tudo junto. Sequencial: cada dose tem a sua transação,
     e dispará-las em paralelo faria uma competir com a outra. */
  async function marcarTodas() {
    if (!podeMarcar || marcando) return
    setErroAcao('')
    for (const s of rotina.pendentes) {
      // eslint-disable-next-line no-await-in-loop
      await registrar(s, TOMADO)
    }
  }

  async function salvar(e) {
    e.preventDefault()
    if (!form.nome.trim() || salvando) return
    setSalvando(true); setErroAcao('')

    const vezesAoDia = Math.max(1, Number(form.vezesAoDia) || 1)
    const lembrete = normalizarLembrete(form)
    // Nunca mais horários do que doses: reduzir "3x ao dia" para 1 deixaria dois
    // lembretes órfãos tocando para doses que não existem mais.
    const horarios = lembrete.horarios.slice(0, vezesAoDia)

    const dados = {
      ...form,
      nome: form.nome.trim(),
      marca: form.marca.trim(),
      dose: form.dose.trim(),
      observacao: form.observacao.trim(),
      vezesAoDia,
      /*
        `horario` continua sendo o primeiro da lista. O resto da tela (ordem da
        rotina, "em 42 min") lê esse campo, e mantê-lo derivado evita duas fontes
        de verdade — trocar o lembrete das 05:00 para 07:00 reordena a rotina junto.
      */
      horario: form.frequencia === 'treino' ? '' : (horarios[0] || ''),
      lembrete: { ...lembrete, horarios, ativo: lembrete.ativo && horarios.length > 0 }
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
        onMarcar={s => registrar(s, TOMADO)}
        onDesfazer={s => desfazer(s)}
        onAbrirFolha={s => setDoseAberta({ sup: s, dia: diaISO() })}
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
        onAbrirDia={setDiaAberto}
        previsto={previstoNoDia}
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

      {/* Controle geral dos lembretes: só para quem toma a dose. */}
      {podeMarcar && !form && <PainelNotificacoes uid={alunoId} />}

      {/*
        Um dia do histórico, aberto para conferir e corrigir.
        Some enquanto a folha de dose está aberta: dois painéis empilhados
        escurecem o fundo duas vezes. Fechar a folha traz o dia de volta, que é
        para onde a pessoa espera voltar.
      */}
      {diaAberto && !doseAberta && (
        <DiaDetalhe
          dia={diaAberto}
          podeEditar={podeMarcar}
          onFechar={() => setDiaAberto(null)}
          onAbrirDose={it => {
            const sup = lista.find(x => x.id === it.id)
            if (sup) setDoseAberta({ sup, dia: diaAberto.iso })
          }}
        />
      )}

      {/* A pergunta "o que aconteceu com esta dose?", de hoje ou de outro dia. */}
      {doseAberta && (() => {
        const reg = registroDoDia(tomados, doseAberta.sup.id, doseAberta.dia, doseAberta.sup.vezesAoDia)
        return (
          <FolhaDose
            sup={doseAberta.sup}
            dia={doseAberta.dia}
            estadoAtual={reg ? reg.estado : NAO_REGISTRADO}
            vezes={reg?.vezes || 0}
            salvando={marcando === doseAberta.sup.id}
            erro={erroAcao}
            onEscolher={estado => registrar(doseAberta.sup, estado, doseAberta.dia)}
            onLimpar={() => apagarRegistro(doseAberta.sup, doseAberta.dia)}
            onFechar={() => { setDoseAberta(null); setErroAcao('') }}
          />
        )
      })()}

      {form && (
        <FormSuplemento
          uid={alunoId}
          podeAtivarPush={podeMarcar}
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
