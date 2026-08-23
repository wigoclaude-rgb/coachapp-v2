import { useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ref, onValue, query, orderByChild, equalTo, limitToLast } from 'firebase/database'
import { db } from '../../firebase'
import AdminShell from './AdminShell.jsx'
import {
  PLANOS, STATUS, rotuloStatus, normalizarAssinatura,
  alterarAssinatura, registrarLog, assinaturaVencida
} from '../../lib/planos'
import { fmtData, fmtMoeda } from '../../lib/util'

const DIA = 86400000

const ROTULO_ACAO = {
  set_plan: 'mudou o plano',
  set_status: 'mudou o status',
  extend: 'mexeu na validade',
  set_limit: 'mudou o limite',
  note: 'anotou'
}

export default function AdminFicha({ adminUid }) {
  const { id } = useParams()
  const navigate = useNavigate()

  const [personal, setPersonal] = useState(null)
  const [assinatura, setAssinatura] = useState(null)
  const [alunos, setAlunos] = useState({})
  const [logs, setLogs] = useState({})
  const [nota, setNota] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [aviso, setAviso] = useState('')

  useEffect(() => {
    const u1 = onValue(ref(db, 'users/' + id), s => setPersonal(s.val()))
    const u2 = onValue(ref(db, 'planos/' + id), s => {
      const a = normalizarAssinatura(s.val())
      setAssinatura(a)
      setNota(a.adminNote)
    })
    const u3 = onValue(ref(db, 'personals/' + id + '/alunos'), s => setAlunos(s.val() || {}))
    // Os últimos movimentos deste personal, do mais novo para o mais velho.
    const u4 = onValue(
      query(ref(db, 'adminLogs'), orderByChild('targetPersonalId'), equalTo(id), limitToLast(20)),
      s => setLogs(s.val() || {}),
      e => console.warn('Sem leitura de adminLogs:', e?.code || e)
    )
    return () => { u1(); u2(); u3(); u4() }
  }, [id])

  const listaAlunos = useMemo(() => (
    Object.entries(alunos).map(([uid, a]) => ({ uid, ...a }))
  ), [alunos])

  const listaLogs = useMemo(() => (
    Object.entries(logs).map(([lid, l]) => ({ lid, ...l })).sort((a, b) => b.at - a.at)
  ), [logs])

  async function aplicar(acao, mudancas, nota) {
    setOcupado(true); setAviso('')
    try {
      await alterarAssinatura({ adminUid, personalId: id, acao, mudancas, nota })
    } catch (err) {
      setAviso('Não foi possível gravar. Confira as regras de admin no Firebase.')
      console.warn('Falha ao alterar assinatura:', err)
    }
    setOcupado(false)
  }

  async function salvarNota() {
    setOcupado(true); setAviso('')
    try {
      await alterarAssinatura({
        adminUid, personalId: id, acao: 'note',
        mudancas: { adminNote: nota }, nota: ''
      })
      setAviso('Anotação salva.')
    } catch (err) {
      setAviso('Não foi possível salvar a anotação.')
    }
    setOcupado(false)
  }

  function estender(dias) {
    const base = Math.max(assinatura.planExpiresAt || 0, Date.now())
    aplicar('extend', { planExpiresAt: base + dias * DIA }, `+${dias} dias`)
  }

  if (!assinatura) return <AdminShell titulo="Carregando..."><p className="muted">Um instante.</p></AdminShell>

  if (personal === null) {
    return (
      <AdminShell titulo="Personal não encontrado">
        <div className="card">
          <div className="vazio-estado">
            <h2>Esse UID não existe</h2>
            <p className="muted">A conta pode ter sido removida.</p>
            <button className="btn btn-sm btn-auto" onClick={() => navigate('/admin/personals')}>Voltar à lista</button>
          </div>
        </div>
      </AdminShell>
    )
  }

  const cheio = listaAlunos.length >= assinatura.studentLimit
  const vencido = assinaturaVencida(assinatura)

  return (
    <AdminShell
      titulo={personal.nome || '(sem nome)'}
      subtitulo={personal.email || id}
      acao={<button className="btn btn-ghost btn-sm" onClick={() => navigate('/admin/personals')}>Voltar</button>}
    >
      {aviso && <div className={aviso.includes('salva') ? 'ok' : 'erro'}>{aviso}</div>}

      <div className="card">
        <div className="card-titulo">
          <div style={{ minWidth: 0 }}>
            <h2>Assinatura</h2>
            <p className="mini">
              Só você grava aqui. O personal lê, mas não escreve — o nó fica fora do cadastro dele.
            </p>
          </div>
          <span className={'plano-selo ' + assinatura.plan}>{PLANOS[assinatura.plan].rotulo}</span>
        </div>

        <div className="admin-resumo">
          <div><span className="mini">Status</span><strong>{rotuloStatus(assinatura.planStatus)}</strong></div>
          <div>
            <span className="mini">Alunos</span>
            <strong className={cheio ? 'texto-vencido' : ''}>
              {listaAlunos.length}/{assinatura.studentLimit === 999 ? '∞' : assinatura.studentLimit}
            </strong>
          </div>
          <div>
            <span className="mini">Vence em</span>
            <strong className={vencido ? 'texto-vencido' : ''}>
              {assinatura.planExpiresAt ? fmtData(assinatura.planExpiresAt) : 'sem data'}
            </strong>
          </div>
          <div>
            <span className="mini">Última alteração</span>
            <strong>{assinatura.planUpdatedAt ? fmtData(assinatura.planUpdatedAt) : '—'}</strong>
          </div>
        </div>

        <label style={{ marginTop: 18 }}>Plano</label>
        <div className="opcoes-chips">
          {Object.values(PLANOS).map(p => (
            <button
              key={p.id} type="button" disabled={ocupado}
              className={'chip-opcao ' + (assinatura.plan === p.id ? 'ativo' : '')}
              onClick={() => aplicar('set_plan', { plan: p.id }, '')}
            >
              {p.rotulo}{p.preco > 0 ? ` · ${fmtMoeda(p.preco)}/mês` : ` · até ${p.limite}`}
            </button>
          ))}
        </div>

        <label style={{ marginTop: 14 }}>Status</label>
        <div className="opcoes-chips">
          {STATUS.map(s => (
            <button
              key={s.id} type="button" disabled={ocupado}
              className={'chip-opcao ' + (assinatura.planStatus === s.id ? 'ativo' : '')}
              onClick={() => aplicar('set_status', { planStatus: s.id }, '')}
            >
              {s.rotulo}
            </button>
          ))}
        </div>

        <label style={{ marginTop: 14 }}>Validade</label>
        <div className="admin-validade">
          <input
            type="date"
            value={assinatura.planExpiresAt ? new Date(assinatura.planExpiresAt).toISOString().slice(0, 10) : ''}
            onChange={e => {
              const v = e.target.value
              aplicar('extend', { planExpiresAt: v ? new Date(v + 'T12:00:00').getTime() : null }, 'data manual')
            }}
            disabled={ocupado}
          />
          <button className="btn btn-sec btn-sm" disabled={ocupado} onClick={() => estender(30)}>+30 dias</button>
          <button className="btn btn-sec btn-sm" disabled={ocupado} onClick={() => estender(90)}>+90 dias</button>
          {assinatura.planExpiresAt && (
            <button className="btn btn-ghost btn-sm" disabled={ocupado}
              onClick={() => aplicar('extend', { planExpiresAt: null }, 'removeu a data')}>
              Sem data
            </button>
          )}
        </div>

        <label style={{ marginTop: 14 }}>Anotação interna</label>
        <textarea
          rows={2} value={nota} onChange={e => setNota(e.target.value)}
          placeholder="Ex: pagou por PIX em 20/08, liberar até setembro"
        />
        <button className="btn btn-sm btn-auto" disabled={ocupado} onClick={salvarNota}>Salvar anotação</button>
      </div>

      <div className="card">
        <div className="card-titulo">
          <h2>Alunos ({listaAlunos.length})</h2>
        </div>
        {listaAlunos.length === 0 && <p className="muted">Nenhum aluno cadastrado.</p>}
        {listaAlunos.map(a => (
          <div key={a.uid} className="admin-linha">
            <div style={{ minWidth: 0 }}>
              <strong>{a.nome || '(sem nome)'}</strong>
              <div className="mini">{a.email || a.uid}</div>
            </div>
            <span className="mini">{a.codigo || ''}</span>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="card-titulo">
          <div style={{ minWidth: 0 }}>
            <h2>Histórico</h2>
            <p className="mini">Últimas 20 alterações feitas por você neste personal.</p>
          </div>
        </div>
        {listaLogs.length === 0 && <p className="muted">Nenhuma alteração registrada.</p>}
        {listaLogs.map(l => (
          <div key={l.lid} className="admin-log">
            <span className="mini">{fmtData(l.at)}</span>
            <span>
              {ROTULO_ACAO[l.action] || l.action}
              {l.from !== null && l.to !== null && <> · <em>{String(l.from)}</em> → <strong>{String(l.to)}</strong></>}
              {l.note ? ` (${l.note})` : ''}
            </span>
          </div>
        ))}
      </div>
    </AdminShell>
  )
}
