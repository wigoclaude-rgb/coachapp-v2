import { useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ref, get, set, push, remove } from 'firebase/database'
import { db } from '../../firebase'
import { TEMPLATES } from '../../lib/templates'
import { notificar } from '../../lib/notify'
import {
  LETRAS, MAX_DIAS, diaVazio,
  normalizarPlano, normalizarTemplate, normalizarExercicios
} from '../../lib/treinoModel'
import EditorExercicios from '../../components/EditorExercicios.jsx'

import { IcVoltar, IcMais, IcLixeira, IcCheck } from '../../components/Icones.jsx'

// 0 = domingo, alinhado com Date.getDay().
const DIAS_DA_SEMANA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']

export default function CriarTreino({ user }) {
  const { alunoId } = useParams()
  const navigate = useNavigate()
  const [nomeAluno, setNomeAluno] = useState('')
  const [planoNome, setPlanoNome] = useState('')
  const [dias, setDias] = useState([diaVazio(0)])
  const [diaAtivo, setDiaAtivo] = useState(0)
  const [treinoExistente, setTreinoExistente] = useState(null)
  const [indiceAtualExistente, setIndiceAtualExistente] = useState(0)
  // Ausente = ciclo travado, que é como o app sempre funcionou.
  const [permiteEscolha, setPermiteEscolha] = useState(false)
  // Dias da semana em que o aluno deve treinar. 0 = domingo, como no Date.getDay().
  const [diasSemana, setDiasSemana] = useState([])
  const [meusTemplates, setMeusTemplates] = useState({})
  const [salvo, setSalvo] = useState(false)
  const [enviando, setEnviando] = useState(false)

  useEffect(() => {
    // O personal também monta o próprio treino; aí não existe ficha de aluno.
    if (alunoId === user.uid) {
      setNomeAluno('você')
    } else {
      get(ref(db, 'personals/' + user.uid + '/alunos/' + alunoId)).then(s => {
        if (s.exists()) setNomeAluno(s.val().nome)
      })
    }
    get(ref(db, 'personals/' + user.uid + '/meusTemplates')).then(s => {
      if (s.exists()) setMeusTemplates(s.val())
    })
    get(ref(db, 'treinos/' + alunoId)).then(s => {
      if (!s.exists()) return
      const bruto = s.val()
      setTreinoExistente(bruto)
      const plano = normalizarPlano(bruto)
      if (!plano) return
      setPlanoNome(bruto.nome || '')
      setDias(plano.lista)
      setIndiceAtualExistente(plano.indiceAtual)
      setPermiteEscolha(bruto.permiteEscolha === true)
      setDiasSemana(Array.isArray(bruto.diasSemana) ? bruto.diasSemana : [])
    })
  }, [alunoId, user.uid])

  const dia = dias[diaAtivo] || dias[0]

  // Coleta exercícios já criados nos templates para autocomplete
  const exerciciosCriados = useMemo(() => {
    const nomes = new Set()
    Object.values(meusTemplates).forEach(t => {
      (t.lista || []).forEach(d => {
        (d.exercicios || []).forEach(ex => {
          if (ex.nome?.trim()) nomes.add(ex.nome.trim())
        })
      })
    })
    return Array.from(nomes).sort()
  }, [meusTemplates])

  function setExercicios(novos) {
    setDias(ds => ds.map((d, i) => (i === diaAtivo ? { ...d, exercicios: novos } : d)))
  }
  function mudarNomeDia(valor) {
    setDias(ds => ds.map((d, i) => (i === diaAtivo ? { ...d, nome: valor } : d)))
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
      ;[novo[idx], novo[alvo]] = [novo[alvo], novo[idx]]
      return novo
    })
    setDiaAtivo(alvo)
  }

  const temConteudo = dias.some(d => d.exercicios.some(ex => (ex.nome || '').trim() !== ''))

  function aplicarTemplate(valor) {
    if (!valor) return
    let bruto
    if (valor.startsWith('pessoal_')) bruto = meusTemplates[valor.replace('pessoal_', '')]
    else bruto = TEMPLATES[Number(valor)]
    if (!bruto) return

    const tpl = normalizarTemplate(bruto)

    // Template com vários treinos → substitui o plano inteiro.
    if (tpl.lista.length > 1) {
      if (temConteudo && !confirm(
        `Aplicar o template "${tpl.nome}"?\n\nIsso substitui o plano inteiro por ${tpl.lista.length} treinos (${tpl.lista.map((d, i) => LETRAS[i] || i + 1).join(', ')}).`
      )) return
      setDias(tpl.lista.map(d => ({ nome: d.nome, exercicios: normalizarExercicios(d.exercicios) })))
      setDiaAtivo(0)
      if (!planoNome.trim()) setPlanoNome(tpl.nome)
      return
    }

    // Template de um treino só → preenche apenas o treino aberto.
    const unico = tpl.lista[0]
    if (dia.exercicios.some(ex => ex.nome) && !confirm(
      `Substituir os exercícios de "${dia.nome || 'este treino'}" pelo template "${tpl.nome}"?`
    )) return
    setDias(ds => ds.map((d, i) => (i === diaAtivo
      ? { nome: d.nome || unico.nome, exercicios: normalizarExercicios(unico.exercicios) }
      : d)))
  }

  async function salvar(e) {
    e.preventDefault()
    setEnviando(true)

    if (treinoExistente) {
      await push(ref(db, 'treinosHistorico/' + alunoId), { ...treinoExistente, arquivadoEm: Date.now() })
    }

    const lista = dias
      .map(d => ({ nome: d.nome || 'Treino', exercicios: (d.exercicios || []).filter(ex => (ex.nome || '').trim() !== '') }))
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
      personalId: user.uid,
      permiteEscolha,
      diasSemana: diasSemana.slice().sort()
    }
    await set(ref(db, 'treinos/' + alunoId), novo)
    setTreinoExistente(novo)
    setIndiceAtualExistente(indiceAtual)
    // Montando o próprio treino não há a quem avisar.
    if (alunoId !== user.uid) {
      notificar(alunoId, 'Seu treino foi atualizado: ' + novo.nome, '/aluno')
    }
    setSalvo(true)
    setEnviando(false)
    setTimeout(() => setSalvo(false), 3000)
  }

  const templatesPessoais = Object.entries(meusTemplates).map(([id, t]) => ({ id, ...normalizarTemplate(t) }))

  return (
    <div className="container">
      <div className="subrota-topo">
        <button className="btn btn-sec btn-sm" onClick={() => navigate('/personal')}><IcVoltar /> Voltar</button>
        <h2 style={{ flex: 1 }}>Treino de {nomeAluno || 'aluno'}</h2>
        <button
          className="btn btn-perigo-sutil btn-sm"
          onClick={() => {
            if (confirm('Deletar TODO o treino deste aluno?')) {
              remove(ref(db, 'treinos/' + alunoId))
              navigate('/personal')
            }
          }}
        >
          <IcLixeira /> Deletar plano
        </button>
      </div>

      <div className="card">
        <label>Nome do plano</label>
        <input value={planoNome} onChange={e => setPlanoNome(e.target.value)} placeholder="Ex: ABC Split — Hipertrofia" />

        <label className="troca-privacidade" style={{ marginTop: 14 }}>
          <input
            type="checkbox" checked={permiteEscolha}
            onChange={e => setPermiteEscolha(e.target.checked)}
          />
          <span className="tp-caixa" aria-hidden="true"><IcCheck /></span>
          <span className="tp-texto">
            <strong>Deixar o aluno escolher qual treino fazer</strong>
            <span className="mini">
              Sem isso, ele segue a ordem do ciclo. Com isso, pode repetir o A depois do B
              quando o dia não sair como planejado.
            </span>
          </span>
        </label>

        {/*
          Sem estes dias, a tela de Evolução do aluno não tem denominador: não dá
          para dizer "86% do previsto" nem chamar um dia de perdido. Ficando vazio,
          ela mostra a média por semana em vez de inventar percentual.
        */}
        <label style={{ marginTop: 18 }}>Dias de treino na semana (opcional)</label>
        <div className="opcoes-chips">
          {DIAS_DA_SEMANA.map((d, i) => (
            <button
              key={i} type="button"
              className={'chip-opcao ' + (diasSemana.includes(i) ? 'ativo' : '')}
              onClick={() => setDiasSemana(ds => ds.includes(i) ? ds.filter(x => x !== i) : [...ds, i])}
              aria-pressed={diasSemana.includes(i)}
            >
              {d}
            </button>
          ))}
        </div>
        <p className="mini" style={{ marginTop: 6 }}>
          Marcando os dias, o aluno passa a ver a frequência dele em relação ao combinado.
          Em branco, ele vê a média de treinos por semana.
        </p>

        <label>Aplicar um template</label>
        <select defaultValue="" onChange={e => { aplicarTemplate(e.target.value); e.target.value = '' }}>
          <option value="">Escolher template...</option>
          {templatesPessoais.length > 0 && (
            <optgroup label="Meus templates">
              {templatesPessoais.map(t => (
                <option key={t.id} value={'pessoal_' + t.id}>
                  {t.nome} · {t.lista.length} treino{t.lista.length === 1 ? '' : 's'}
                </option>
              ))}
            </optgroup>
          )}
          <optgroup label="Templates padrão">
            {TEMPLATES.map((t, i) => <option key={i} value={i}>{t.nome}</option>)}
          </optgroup>
        </select>
        <p className="mini" style={{ marginTop: 6 }}>
          Template com vários treinos substitui o plano inteiro. Template de um treino só preenche o treino aberto.
        </p>

        <hr className="divisor" />

        <div className="dias-tabs">
          {dias.map((d, i) => (
            <button key={i} type="button" className={'dia-tab ' + (diaAtivo === i ? 'ativo' : '')} onClick={() => setDiaAtivo(i)}>
              <span className="dia-letra">{LETRAS[i] || i + 1}</span>
              <span className="dia-nome-tab">{d.nome || 'Treino'}</span>
            </button>
          ))}
          {dias.length < MAX_DIAS && (
            <button className="dia-tab add" onClick={addDia} type="button"><IcMais /> Treino</button>
          )}
        </div>
        <p className="mini" style={{ marginTop: 8 }}>
          O aluno faz um treino por vez. Ao concluir, o próximo aparece e o ciclo reinicia no fim.
        </p>
      </div>

      <div className="card">
        <div className="card-titulo">
          <h2>Treino {LETRAS[diaAtivo] || diaAtivo + 1}</h2>
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="btn btn-ghost btn-sm" type="button" onClick={() => moverDia(diaAtivo, -1)} disabled={diaAtivo === 0} title="Mover para a esquerda">←</button>
            <button className="btn btn-ghost btn-sm" type="button" onClick={() => moverDia(diaAtivo, 1)} disabled={diaAtivo === dias.length - 1} title="Mover para a direita">→</button>
            {dias.length > 1 && (
              <button className="btn btn-perigo-sutil btn-sm" type="button" onClick={() => removerDia(diaAtivo)}><IcLixeira /> Remover</button>
            )}
          </div>
        </div>

        <label>Nome deste treino</label>
        <input value={dia.nome} onChange={e => mudarNomeDia(e.target.value)} placeholder="Ex: Treino A — Peito e Tríceps" />

        <label>Exercícios</label>
        <p className="mini" style={{ marginBottom: 10 }}>
          Cada linha é uma série — use várias linhas para progressão de carga (12 / 10 / 8).
          Marque dois exercícios e clique em Combinar para montar um bi-set.
        </p>

        <EditorExercicios
          exercicios={dia.exercicios}
          onChange={setExercicios}
          pastaFotos={'exercicios/' + user.uid}
          exerciciosCriados={exerciciosCriados}
        />

        {salvo && <div className="ok"><IcCheck /> Treino salvo. O aluno foi notificado e o plano anterior ficou no histórico.</div>}
        <button className="btn" disabled={enviando} onClick={salvar}>{enviando ? 'Salvando...' : 'Salvar plano de treino'}</button>
      </div>
    </div>
  )
}
