import { useNavigate } from 'react-router-dom'
import AdminShell, { useDadosAdmin } from './AdminShell.jsx'
import { PLANOS, assinaturaVencida } from '../../lib/planos'
import { fmtMoeda } from '../../lib/util'

const DIA = 86400000

/*
  Retrato do negócio. Cada card leva para a lista já filtrada — número que não
  responde "quem são eles?" obriga a refazer a conta na mão.

  Nada de "7d/30d" aqui: o app não guarda histórico de assinatura, e período
  inventado a partir de dado que não existe é pior que período nenhum.
*/
export default function AdminHome() {
  const { lista, carregando, erro } = useDadosAdmin()
  const navigate = useNavigate()

  const pro = lista.filter(p => p.assinatura.plan === 'pro')
  const proAtivos = pro.filter(p => p.assinatura.planStatus === 'active')
  const free = lista.filter(p => p.assinatura.plan === 'free')
  const bloqueados = lista.filter(p => p.assinatura.planStatus === 'blocked')
  const totalAlunos = lista.reduce((s, p) => s + p.studentCount, 0)

  const noLimite = free.filter(p => p.studentCount >= PLANOS.free.limite)
  const semAlunos = lista.filter(p => p.studentCount === 0)
  const vencendo = pro.filter(p => {
    const q = p.assinatura.planExpiresAt
    return q && q > Date.now() && q <= Date.now() + 7 * DIA
  })
  const vencidos = lista.filter(p => assinaturaVencida(p.assinatura))

  const mrr = proAtivos.length * PLANOS.pro.preco

  const cards = [
    { n: lista.length, rot: 'personais no app', para: '' },
    { n: proAtivos.length, rot: 'Pro ativos', para: '?plano=pro&status=active', destaque: true },
    { n: free.length, rot: 'no Free', para: '?plano=free' },
    { n: bloqueados.length, rot: 'bloqueados', para: '?status=blocked', alerta: bloqueados.length > 0 },
    { n: totalAlunos, rot: 'alunos somados', para: '' },
    { n: noLimite.length, rot: `Free no limite de ${PLANOS.free.limite}`, para: '?plano=free&alunos=5', alerta: noLimite.length > 0 },
    { n: semAlunos.length, rot: 'sem nenhum aluno', para: '?alunos=0' },
    { n: vencendo.length, rot: 'vencem em 7 dias', para: '?venc=next_7d', alerta: vencendo.length > 0 },
    { n: vencidos.length, rot: 'já vencidos', para: '?venc=expired', alerta: vencidos.length > 0 }
  ]

  return (
    <AdminShell titulo="Visão geral" subtitulo="Estado atual da base — sem período, só o retrato de agora.">
      {erro && <div className="erro">{erro}</div>}
      {carregando && <p className="muted">Carregando...</p>}

      {!carregando && !erro && (
        <>
          <div className="admin-mrr">
            <span className="mrr-rot">Receita recorrente estimada</span>
            <span className="mrr-num">{fmtMoeda(mrr)}<small>/mês</small></span>
            <span className="mrr-nota">
              {proAtivos.length} Pro ativo{proAtivos.length === 1 ? '' : 's'} × {fmtMoeda(PLANOS.pro.preco)}.
              Conta os ativos apenas — atrasados e cancelados ficam de fora.
            </span>
          </div>

          <div className="admin-cards">
            {cards.map((c, i) => (
              <button
                key={i}
                className={'admin-card' + (c.destaque ? ' destaque' : '') + (c.alerta ? ' alerta' : '')}
                onClick={() => navigate('/admin/personals' + c.para)}
                disabled={!c.para}
              >
                <span className="ac-num">{c.n}</span>
                <span className="ac-rot">{c.rot}</span>
              </button>
            ))}
          </div>

          {noLimite.length > 0 && (
            <div className="card">
              <div className="card-titulo">
                <div style={{ minWidth: 0 }}>
                  <h2>Prontos para converter</h2>
                  <p className="mini">Free com {PLANOS.free.limite} alunos: não conseguem cadastrar mais ninguém.</p>
                </div>
              </div>
              {noLimite.map(p => (
                <div key={p.uid} className="admin-linha" onClick={() => navigate('/admin/personals/' + p.uid)}>
                  <div style={{ minWidth: 0 }}>
                    <strong>{p.nome}</strong>
                    <div className="mini">{p.email}</div>
                  </div>
                  <span className="mini">{p.studentCount} alunos</span>
                </div>
              ))}
            </div>
          )}

          {lista.length === 0 && (
            <div className="card">
              <div className="vazio-estado">
                <h2>Nenhum personal ainda</h2>
                <p className="muted">Quando alguém criar conta de personal, aparece aqui.</p>
              </div>
            </div>
          )}
        </>
      )}
    </AdminShell>
  )
}
