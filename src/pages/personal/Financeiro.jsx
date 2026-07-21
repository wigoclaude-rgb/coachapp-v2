import { useState } from 'react'
import { ref, push, update, remove } from 'firebase/database'
import { db } from '../../firebase'
import { fmtData, fmtMoeda, vencida, hojeISO } from '../../lib/util'
import { notificar } from '../../lib/notify'

// [NOVO] calcula a data de vencimento da i-ésima cobrança conforme a frequência
function proximaData(dataISO, freq, i) {
  if (i === 0) return dataISO
  const partes = dataISO.split('-')
  const y = Number(partes[0])
  const m = Number(partes[1])
  const d = Number(partes[2])
  if (freq === 'mensal') {
    const total = (m - 1) + i
    const yy = y + Math.floor(total / 12)
    const mm = ((total % 12) + 12) % 12
    const ultimoDia = new Date(yy, mm + 1, 0).getDate()
    const dd = Math.min(d, ultimoDia)
    return yy + '-' + String(mm + 1).padStart(2, '0') + '-' + String(dd).padStart(2, '0')
  }
  const base = new Date(y, m - 1, d)
  if (freq === 'diario') base.setDate(base.getDate() + i)
  else if (freq === 'semanal') base.setDate(base.getDate() + 7 * i)
  else if (freq === 'quinzenal') base.setDate(base.getDate() + 15 * i)
  return base.getFullYear() + '-' + String(base.getMonth() + 1).padStart(2, '0') + '-' + String(base.getDate()).padStart(2, '0')
}

// [NOVO] rótulo do intervalo para o texto de ajuda
function rotuloFreq(freq) {
  if (freq === 'diario') return 'dia'
  if (freq === 'semanal') return 'semana'
  if (freq === 'quinzenal') return 'quinzena'
  if (freq === 'mensal') return 'mês'
  return 'período'
}

export default function Financeiro({ user, alunos, cobrancas }) {
  const [alunoSel, setAlunoSel] = useState('')
  const [valor, setValor] = useState('')
  const [vencimento, setVencimento] = useState('')
  const [tipo, setTipo] = useState('mensal')
  const [repetir, setRepetir] = useState('1') // [NOVO]
  const [msg, setMsg] = useState('')

  const listaAlunos = Object.entries(alunos)
  const meusIds = new Set(Object.keys(alunos))

  async function lancar(e) {
    e.preventDefault()
    setMsg('')
    if (!alunoSel) return
    // [NOVO] repete a cobrança conforme a frequência (avulso nunca repete)
    const vezes = tipo === 'avulso' ? 1 : Math.max(1, Number(repetir))
    for (let i = 0; i < vezes; i++) {
      await push(ref(db, 'cobrancas/' + alunoSel), {
        valor: Number(valor), vencimento: proximaData(vencimento, tipo, i), tipo,
        status: 'pendente', criadaEm: Date.now(), personalId: user.uid
      })
    }
    const nome = alunos[alunoSel]?.nome || 'aluno'
    if (vezes > 1) {
      notificar(alunoSel, vezes + ' cobranças de ' + fmtMoeda(valor) + ' foram lançadas a partir de ' + vencimento.split('-').reverse().join('/'), '/aluno')
      setMsg(vezes + ' cobranças lançadas para ' + nome + '.')
    } else {
      notificar(alunoSel, 'Nova cobrança de ' + fmtMoeda(valor) + ' com vencimento em ' + vencimento.split('-').reverse().join('/'), '/aluno')
      setMsg('Cobrança lançada para ' + nome + '.')
    }
    setValor(''); setVencimento(''); setRepetir('1')
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

  // [NOVO] deleta uma cobrança
  async function deletar(alunoId, cobId) {
    if (!confirm('Deletar esta cobrança? Esta ação não pode ser desfeita.')) return
    await remove(ref(db, 'cobrancas/' + alunoId + '/' + cobId))
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
          {/* [NOVO] campo repetir cobrança */}
          <label>Repetir cobrança</label>
          <select value={repetir} onChange={e => setRepetir(e.target.value)} disabled={tipo === 'avulso'}>
            <option value="1">Não repetir (apenas 1)</option>
            <option value="2">2 vezes</option>
            <option value="3">3 vezes</option>
            <option value="6">6 vezes</option>
            <option value="12">12 vezes</option>
          </select>
          {tipo !== 'avulso' && Number(repetir) > 1 && (
            <p className="muted">Serão criadas {repetir} cobranças, uma a cada {rotuloFreq(tipo)}, a partir do vencimento escolhido.</p>
          )}
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
                {/* [NOVO] */}
                <button className="btn btn-sec btn-sm" onClick={() => deletar(c.aid, c.cid)}>Deletar</button>
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
            {/* [NOVO] */}
            <div className="aluno-acoes">
              <button className="btn btn-sec btn-sm" onClick={() => deletar(c.aid, c.cid)}>Deletar</button>
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
            {/* [NOVO] envolvi o selo num container para caber o botão deletar */}
            <div className="aluno-acoes">
              <span className="selo-pago">Pago</span>
              <button className="btn btn-sec btn-sm" onClick={() => deletar(c.aid, c.cid)}>Deletar</button>
            </div>
          </div>
        ))}
      </div>
    </>
  )
}
