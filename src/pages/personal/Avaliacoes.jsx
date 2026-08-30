import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ref, onValue } from 'firebase/database'
import { db } from '../../firebase'
import { fmtData } from '../../lib/util'
import { normalizarAvaliacao, classificarIMC } from '../../lib/avaliacao'
import { IcEvolucao, IcBusca, IcAlerta, IcSeta } from '../../components/Icones.jsx'

/*
  Avaliações de todos os alunos, em uma tela.

  A lista cronológica sozinha não responde nada que a ficha do aluno já não
  responda. O que só existe aqui é a visão de quem está atrasado — por isso ela
  vem primeiro, e é o único lugar do app que cruza a carteira inteira.
*/

const DIA = 86400000
const ATENCAO = 60      // dias sem avaliar que já pedem contato
const CRITICO = 90

export default function Avaliacoes({ user, alunos }) {
  const navigate = useNavigate()
  const [porAluno, setPorAluno] = useState({})
  const [busca, setBusca] = useState('')
  const [filtroAluno, setFiltroAluno] = useState('')

  const ids = useMemo(() => Object.keys(alunos || {}).sort().join(','), [alunos])

  /*
    Um listener por aluno. Ler o nó `avaliacoes` inteiro traria os dados de todos
    os personais do app — é o mesmo motivo pelo qual execuções e cobranças já são
    assinadas assim no PersonalHome.
  */
  useEffect(() => {
    const lista = ids ? ids.split(',') : []
    if (lista.length === 0) { setPorAluno({}); return }

    const inscricoes = lista.map(uid =>
      onValue(ref(db, 'avaliacoes/' + uid), s => {
        const val = s.val()
        setPorAluno(ant => (val ? { ...ant, [uid]: val } : (() => {
          const { [uid]: _, ...resto } = ant
          return resto
        })()))
      })
    )
    return () => inscricoes.forEach(cancelar => cancelar())
  }, [ids])

  /** Uma linha por aluno, com a última avaliação e há quantos dias ela foi. */
  const situacao = useMemo(() => {
    const agora = Date.now()
    return Object.entries(alunos || {}).map(([uid, a]) => {
      const avs = Object.entries(porAluno[uid] || {})
        .map(([id, av]) => ({ id, ...normalizarAvaliacao(av) }))
        .sort((x, y) => y.ts - x.ts)
      const ultima = avs[0] || null
      const dias = ultima ? Math.floor((agora - ultima.ts) / DIA) : null
      return { uid, nome: a.nome || 'Sem nome', foto: a.foto || '', avaliacoes: avs, ultima, dias }
    })
  }, [alunos, porAluno])

  /* Nunca avaliado vem primeiro: é o caso mais urgente e o que some numa lista por data. */
  const atrasados = useMemo(() => (
    situacao
      .filter(s => s.dias === null || s.dias >= ATENCAO)
      .sort((a, b) => {
        if (a.dias === null && b.dias === null) return a.nome.localeCompare(b.nome)
        if (a.dias === null) return -1
        if (b.dias === null) return 1
        return b.dias - a.dias
      })
  ), [situacao])

  const historico = useMemo(() => {
    const todas = situacao.flatMap(s => s.avaliacoes.map(av => ({ ...av, aluno: s.nome, uid: s.uid })))
    const termo = busca.trim().toLowerCase()
    return todas
      .filter(av => !filtroAluno || av.uid === filtroAluno)
      .filter(av => !termo || av.aluno.toLowerCase().includes(termo))
      .sort((a, b) => b.ts - a.ts)
  }, [situacao, busca, filtroAluno])

  const totalAvaliacoes = situacao.reduce((n, s) => n + s.avaliacoes.length, 0)
  const irPara = uid => navigate('/personal-aluno/' + uid)

  const rotuloAtraso = s => {
    if (s.dias === null) return 'Nunca avaliado'
    if (s.dias === 0) return 'Avaliado hoje'
    return `${s.dias} dias sem avaliar`
  }

  return (
    <>
      {/* ---------- quem está atrasado ---------- */}
      <div className="card">
        <div className="card-titulo">
          <div style={{ minWidth: 0 }}>
            <h2>Precisam de reavaliação</h2>
            <p className="mini">
              Quem nunca foi avaliado ou passou de {ATENCAO} dias desde a última.
            </p>
          </div>
        </div>

        {atrasados.length === 0 ? (
          <p className="muted">
            {situacao.length === 0
              ? 'Você ainda não tem alunos cadastrados.'
              : 'Ninguém atrasado. Todos avaliados nos últimos ' + ATENCAO + ' dias.'}
          </p>
        ) : (
          <div className="aval-atrasados">
            {atrasados.map(s => {
              const critico = s.dias === null || s.dias >= CRITICO
              return (
                <button
                  key={s.uid}
                  type="button"
                  className={'aval-atraso' + (critico ? ' critico' : '')}
                  onClick={() => irPara(s.uid)}
                >
                  <span className="aval-atraso-topo">
                    <span className="aval-nome">{s.nome}</span>
                    {critico && <IcAlerta />}
                  </span>
                  <span className="aval-atraso-txt">{rotuloAtraso(s)}</span>
                  {s.ultima && (
                    <span className="aval-atraso-ult">Última em {fmtData(s.ultima.ts)}</span>
                  )}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* ---------- histórico completo ---------- */}
      <div className="barra-filtros">
        <div className="campo-busca">
          <IcBusca />
          <input
            value={busca} onChange={e => setBusca(e.target.value)}
            placeholder="Buscar por aluno"
          />
        </div>
        <select value={filtroAluno} onChange={e => setFiltroAluno(e.target.value)}>
          <option value="">Todos os alunos</option>
          {situacao
            .slice()
            .sort((a, b) => a.nome.localeCompare(b.nome))
            .map(s => <option key={s.uid} value={s.uid}>{s.nome}</option>)}
        </select>
      </div>

      <div className="section-title">
        {totalAvaliacoes === 0
          ? 'Histórico'
          : `Histórico · ${historico.length} de ${totalAvaliacoes}`}
      </div>

      {historico.length === 0 ? (
        <div className="card">
          <div className="vazio-estado">
            <div className="ve-icone"><IcEvolucao /></div>
            <h2>Nenhuma avaliação por aqui</h2>
            <p className="muted">
              {totalAvaliacoes === 0
                ? 'Registre a primeira na ficha de um aluno, na aba Avaliação física.'
                : 'Nenhuma avaliação corresponde ao filtro.'}
            </p>
          </div>
        </div>
      ) : historico.map(av => {
        const r = av.resumo || {}
        const partes = []
        if (r.peso ?? av.medidas.peso) partes.push((r.peso ?? av.medidas.peso) + ' kg')
        if (r.imc) partes.push('IMC ' + r.imc.toFixed(1).replace('.', ',') + ' · ' + classificarIMC(r.imc))
        if (r.percentualGordura) partes.push(r.percentualGordura.toFixed(1).replace('.', ',') + '% gordura')

        return (
          <button
            key={av.uid + '_' + av.id}
            type="button"
            className="card aval-hist"
            onClick={() => irPara(av.uid)}
          >
            <span className="aval-hist-txt">
              <span className="aval-hist-topo">
                <strong>{av.aluno}</strong>
                <span className="aval-hist-data">{fmtData(av.ts)}</span>
                {!av.visibilidade.alunoPodeVer && <span className="av-oculta">Oculta</span>}
              </span>
              <span className="muted">{partes.join(' · ') || 'Sem medidas registradas'}</span>
            </span>
            <IcSeta />
          </button>
        )
      })}
    </>
  )
}
