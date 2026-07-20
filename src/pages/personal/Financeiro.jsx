import { useState } from 'react'
import { ref, push, update } from 'firebase/database'
import { db } from '../../firebase'
import { fmtData, fmtMoeda, vencida, hojeISO } from '../../lib/util'
import { notificar } from '../../lib/notify'

export default function Financeiro({ user, alunos, cobrancas }) {
  const [alunoSel, setAlunoSel] = useState('')
  const [valor, setValor] = useState('')
  const [vencimento, setVencimento] = useState('')
  const [tipo, setTipo] = useState('mensal')
  const [msg, setMsg] = useState('')

  const listaAlunos = Object.entries(alunos)
  const meusIds = new Set(Object.keys(alunos))

  async function lancar(e) {
    e.preventDefault()
    setMsg('')
    if (!alunoSel) return
    await push(ref(db, 'cobrancas/' + alunoSel), {
      valor: Number(valor), vencimento, tipo,
      status: 'pendente', criadaEm: Date.now(), personalId: user.uid
    })
    notificar(alunoSel, 'Nova cobrança de ' + fmtMoeda(valor) + ' com vencimento em ' + vencimento.split('-').reverse().join('/'), '/aluno')
    setMsg('Cobrança lançada para ' + (alunos[alunoSel]?.nome || 'aluno') + '.')
    setValor(''); setVencimento('')
  }

  async function validar(alunoId, cobId, aprovar) {
    await update(ref(db, 'cobrancas/' + alunoId + '/' + cobId), {
      status: aprovar ? 'pago' : 'pendente',
      validadaEm: Date.now()
    })
    notificar(alunoId, aprovar
      ? 'Pagamento confirmado. Seu treino está liberado.'
      : 'Seu registro de pagamento não foi aprovado. Fale com o personal.', '/aluno')
  }

  // Montar listas
  const pendentesValidacao = []
  const abertas = []
  const historico = []
  Object.entries(cobrancas).forEach(([aid, cs]) => {
    if (!meusIds.has(aid)) return
    Object.entries(cs || {}).forEach(([cid, c]) => {
      const item = { aid, cid, ...c, aluno: alunos[aid]?.nome || 'Aluno' }
      if (c.status === 'em_analise') pendentesValidacao.push(item)
      else if (c.status === 'pago') historico.push(item)
      else abertas.push(item)
    })
  })
  historico.sort((a, b) => (b.validadaEm || 0) - (a.validadaEm || 0))
  abertas.sort((a, b) => a.vencimento.localeCompare(b.vencimento))

  return (
    <>
      <div className="card">
        <h2>Lançar cobrança (a receber)</h2>
        <form onSubmit={lancar}>
          <label>Aluno</label>
          <select value={alunoSel} onChange={e => setAlunoSel(e.target.value)} required>
            <option value="">Selecione o aluno</option>
            {listaAlunos.map(([uid, a]) => <option key={uid} value={uid}>{a.nome}</option>)}
          </select>
          <div className="linha-3">
            <div>
              <label>Valor (R$)</label>
              <input type="number" step="0.01" min="1" value={valor} onChange={e => setValor(e.target.value)} required />
            </div>
            <div>
              <label>Vencimento</label>
              <input type="date" value={vencimento} onChange={e => setVencimento(e.target.value)} required />
            </div>
            <div>
              <label>Frequência</label>
              <select value={tipo} onChange={e => setTipo(e.target.value)}>
                <option value="diario">Diário</option>
                <option value="semanal">Semanal</option>
                <option value="quinzenal">Quinzenal</option>
                <option value="mensal">Mensal</option>
                <option value="avulso">Avulso</option>
              </select>
            </div>
          </div>
          {msg && <div className="ok">{msg}</div>}
          <button className="btn">Lançar cobrança</button>
        </form>
      </div>

      {pendentesValidacao.length > 0 && (
        <div className="card destaque-card">
          <h2>Pagamentos aguardando validação</h2>
          <p className="muted">Confira no seu extrato se o valor caiu antes de aprovar.</p>
          {pendentesValidacao.map(c => (
            <div key={c.cid} className="cobranca-item">
              <div>
                <strong>{c.aluno}</strong> · {fmtMoeda(c.valor)} · venc. {c.vencimento.split('-').reverse().join('/')}
                {c.pagamento && (
                  <div className="muted">
                    Registrado em {fmtData(c.pagamento.data)}{c.pagamento.obs ? ' · "' + c.pagamento.obs + '"' : ''}
                  </div>
                )}
              </div>
              <div className="aluno-acoes">
                <button className="btn btn-sm" onClick={() => validar(c.aid, c.cid, true)}>Aprovar</button>
                <button className="btn btn-sec btn-sm" onClick={() => validar(c.aid, c.cid, false)}>Rejeitar</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="card">
        <h2>Cobranças em aberto</h2>
        {abertas.length === 0 && <p className="muted">Nenhuma cobrança em aberto.</p>}
        {abertas.map(c => (
          <div key={c.cid} className="cobranca-item">
            <div>
              <strong>{c.aluno}</strong> · {fmtMoeda(c.valor)} · {c.tipo}
              <div className={'muted ' + (vencida(c) ? 'texto-vencido' : '')}>
                Vence em {c.vencimento.split('-').reverse().join('/')} {vencida(c) ? '· VENCIDA (treino bloqueado)' : ''}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="card">
        <h2>Histórico de recebimentos</h2>
        {historico.length === 0 && <p className="muted">Nenhum pagamento validado ainda.</p>}
        {historico.map(c => (
          <div key={c.cid} className="cobranca-item">
            <div>
              <strong>{c.aluno}</strong> · {fmtMoeda(c.valor)} · {c.tipo}
              <div className="muted">Recebido/validado em {c.validadaEm ? fmtData(c.validadaEm) : '-'}</div>
            </div>
            <span className="selo-pago">Pago</span>
          </div>
        ))}
      </div>
    </>
  )
}
