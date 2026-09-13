import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import AdminShell, { useDadosAdmin } from './AdminShell.jsx'
import { PLANOS, STATUS, rotuloStatus, alterarAssinatura, assinaturaVencida } from '../../lib/planos'
import { fmtData } from '../../lib/util'
import { rotuloAcesso } from '../../lib/admin'
import { IcBusca } from '../../components/Icones.jsx'

const DIA = 86400000

/* Os filtros vivem na URL: os cards da home apontam para cá já filtrados,
   e o link pode ser guardado ou recarregado sem perder o estado. */
export default function AdminPersonals({ adminUid }) {
  const { lista, temPresenca, carregando, erro } = useDadosAdmin()
  const [params, setParams] = useSearchParams()
  const [ordem, setOrdem] = useState('nome')
  const [ocupado, setOcupado] = useState('')
  const navigate = useNavigate()

  const busca = params.get('q') || ''
  const fPlano = params.get('plano') || 'todos'
  const fStatus = params.get('status') || 'todos'
  const fAlunos = params.get('alunos') || 'todos'
  const fVenc = params.get('venc') || 'todos'

  const setFiltro = (chave, valor) => {
    const p = new URLSearchParams(params)
    if (!valor || valor === 'todos') p.delete(chave)
    else p.set(chave, valor)
    setParams(p, { replace: true })
  }

  const visiveis = useMemo(() => {
    const q = busca.trim().toLowerCase()
    const agora = Date.now()

    const filtrada = lista.filter(p => {
      if (q && ![p.nome, p.email, p.uid].some(v => (v || '').toLowerCase().includes(q))) return false
      if (fPlano !== 'todos' && p.assinatura.plan !== fPlano) return false
      if (fStatus !== 'todos' && p.assinatura.planStatus !== fStatus) return false

      if (fAlunos === '0' && p.alunos !== 0) return false
      if (fAlunos === '1-4' && (p.alunos < 1 || p.alunos > 4)) return false
      if (fAlunos === '5' && p.alunos < 5) return false
      // "No limite" é relativo ao plano: 4 de 4 no Free aperta, 4 de 999 não.
      if (fAlunos === 'limite' && !p.noLimite) return false

      const venc = p.assinatura.planExpiresAt
      if (fVenc === 'none' && venc) return false
      if (fVenc === 'expired' && !(venc && venc < agora)) return false
      if (fVenc === 'next_7d' && !(venc && venc > agora && venc <= agora + 7 * DIA)) return false
      if (fVenc === 'next_30d' && !(venc && venc > agora && venc <= agora + 30 * DIA)) return false
      return true
    })

    return filtrada.sort((a, b) => {
      if (ordem === 'alunos') return b.alunos - a.alunos
      if (ordem === 'recentes') return (b.criadoEm || 0) - (a.criadoEm || 0)
      if (ordem === 'parados') return (b.acesso.dias ?? Infinity) - (a.acesso.dias ?? Infinity)
      return a.nome.localeCompare(b.nome)
    })
  }, [lista, busca, fPlano, fStatus, fAlunos, fVenc, ordem])

  /* Ações rápidas. O log sai de dentro de alterarAssinatura. */
  async function acao(p, tipo) {
    const rotulo = { pro: 'tornar Pro', free: 'voltar para Free', blocked: 'bloquear' }[tipo]
    if (!confirm(`Confirma ${rotulo} para ${p.nome}?`)) return
    setOcupado(p.uid)
    try {
      if (tipo === 'blocked') {
        await alterarAssinatura({
          adminUid, personalId: p.uid, acao: 'set_status',
          mudancas: { planStatus: 'blocked' }, nota: 'ação rápida na lista'
        })
      } else {
        await alterarAssinatura({
          adminUid, personalId: p.uid, acao: 'set_plan',
          mudancas: { plan: tipo, planStatus: 'active' }, nota: 'ação rápida na lista'
        })
      }
    } catch (err) {
      alert('Não foi possível alterar. Confira as regras de admin no Firebase.')
      console.warn('Falha ao alterar assinatura:', err)
    }
    setOcupado('')
  }

  return (
    <AdminShell titulo="Personais" subtitulo={`${visiveis.length} de ${lista.length}`}>
      {erro && <div className="erro">{erro}</div>}

      <div className="adm-filtros">
        <div className="campo-busca">
          <IcBusca />
          <input
            value={busca}
            onChange={e => setFiltro('q', e.target.value)}
            placeholder="Nome, e-mail ou UID"
          />
        </div>

        <select value={fPlano} onChange={e => setFiltro('plano', e.target.value)}>
          <option value="todos">Todos os planos</option>
          <option value="free">Free</option>
          <option value="pro">Pro</option>
        </select>

        <select value={fStatus} onChange={e => setFiltro('status', e.target.value)}>
          <option value="todos">Todos os status</option>
          {STATUS.map(s => <option key={s.id} value={s.id}>{s.rotulo}</option>)}
        </select>

        <select value={fAlunos} onChange={e => setFiltro('alunos', e.target.value)}>
          <option value="todos">Qualquer nº de alunos</option>
          <option value="0">Nenhum aluno</option>
          <option value="1-4">1 a 4 alunos</option>
          <option value="5">5 ou mais</option>
          <option value="limite">No limite do plano</option>
        </select>

        <select value={fVenc} onChange={e => setFiltro('venc', e.target.value)}>
          <option value="todos">Qualquer vencimento</option>
          <option value="expired">Vencidos</option>
          <option value="next_7d">Vencem em 7 dias</option>
          <option value="next_30d">Vencem em 30 dias</option>
          <option value="none">Sem data</option>
        </select>

        <select value={ordem} onChange={e => setOrdem(e.target.value)}>
          <option value="nome">Por nome</option>
          <option value="alunos">Mais alunos</option>
          <option value="recentes">Mais recentes</option>
          <option value="parados">Mais tempo sem entrar</option>
        </select>
      </div>

      {carregando && <p className="muted">Carregando...</p>}

      {!carregando && visiveis.length === 0 && (
        <div className="card">
          <div className="vazio-estado">
            <h2>Nada encontrado</h2>
            <p className="muted">
              {lista.length === 0 ? 'Ainda não existe personal cadastrado.' : 'Nenhum personal bate com esses filtros.'}
            </p>
          </div>
        </div>
      )}

      {visiveis.length > 0 && (
        <div className="adm-tabela-rolagem">
          <table className="adm-tabela">
            <thead>
              <tr>
                <th>Personal</th>
                <th>Plano</th>
                <th>Alunos</th>
                <th>Vencimento</th>
                <th>Último acesso</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {visiveis.map(p => {
                const a = p.assinatura
                const cheio = p.alunos >= a.studentLimit
                const vencido = assinaturaVencida(a)
                return (
                  <tr key={p.uid}>
                    <td>
                      <button className="adm-nome" onClick={() => navigate('/admin/personals/' + p.uid)}>
                        {p.nome}
                      </button>
                      <div className="mini">{p.email || p.uid}</div>
                    </td>
                    <td>
                      <span className={'plano-selo ' + a.plan}>{PLANOS[a.plan].rotulo}</span>
                      <div className={'mini ' + (a.planStatus !== 'active' ? 'texto-vencido' : '')}>
                        {rotuloStatus(a.planStatus)}
                      </div>
                    </td>
                    <td>
                      <span className={cheio ? 'texto-vencido' : ''}>
                        {p.alunos}/{a.studentLimit === 999 ? '∞' : a.studentLimit}
                      </span>
                    </td>
                    <td className={vencido ? 'texto-vencido' : ''}>
                      {a.planExpiresAt ? fmtData(a.planExpiresAt) : '—'}
                    </td>
                    <td>
                      {/* Vem de `presenca`, gravada pelo próprio usuário ao conectar.
                          Quem nunca abriu depois de Ago/2026 não tem registro. */}
                      <span className={'adm-selo ' + rotuloAcesso(p.acesso, temPresenca).tom}>
                        {rotuloAcesso(p.acesso, temPresenca).texto}
                      </span>
                    </td>
                    <td>
                      <div className="adm-acoes">
                        {/* As duas direções ficam neutras: numa lista de sete linhas, sete
                            botões vermelhos disputam a atenção com o que é de fato urgente
                            (a data vencida, o limite estourado). O rótulo já diz o destino. */}
                        {a.plan === 'free'
                          ? <button className="btn btn-sec btn-sm" disabled={ocupado === p.uid} onClick={() => acao(p, 'pro')}>Passar a Pro</button>
                          : <button className="btn btn-sec btn-sm" disabled={ocupado === p.uid} onClick={() => acao(p, 'free')}>Voltar a Free</button>}
                        {a.planStatus !== 'blocked' && (
                          <button className="btn btn-perigo-sutil btn-sm" disabled={ocupado === p.uid} onClick={() => acao(p, 'blocked')}>
                            Bloquear
                          </button>
                        )}
                        <button className="btn btn-ghost btn-sm" onClick={() => navigate('/admin/personals/' + p.uid)}>
                          Abrir
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </AdminShell>
  )
}
