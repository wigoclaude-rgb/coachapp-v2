import { useState } from 'react'
import { ref, push, update, remove } from 'firebase/database'
import { db } from '../../firebase'
import { fmtData, fmtMoeda, vencida, hojeISO } from '../../lib/util'
import { notificar } from '../../lib/notify'
import { selo, legenda, titulo as tituloCobranca, dataBR, EM_ANALISE, PAGO } from '../../lib/cobrancas'

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
  const [recusando, setRecusando] = useState(null)   // id da cobrança sendo recusada
  const [motivo, setMotivo] = useState('')
  const [ocupado, setOcupado] = useState(null)       // id em processamento
  const [erro, setErro] = useState('')

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

  /*
    Confirma ou recusa o pagamento que o aluno informou.

    Recusar leva para `recusado`, e não de volta para `pendente`: o aluno precisa
    saber que o registro dele foi visto e negado, e por quê. Devolver para
    `pendente` deixava a tela dele idêntica à de quem nunca informou nada.

    Guardamos quem confirmou e quando — é dinheiro, e daqui a seis meses alguém
    vai querer saber quem deu baixa.
  */
  async function validar(cob, aprovar, motivoRecusa = '') {
    if (ocupado) return
    setOcupado(cob.cid)
    setErro('')
    try {
      await update(ref(db, 'cobrancas/' + cob.aid + '/' + cob.cid), {
        status: aprovar ? 'pago' : 'recusado',
        validadaEm: Date.now(),
        validadaPor: user.uid,
        ...(aprovar ? { motivoRecusa: null } : { motivoRecusa: motivoRecusa.trim() })
      })
      await notificar(cob.aid, aprovar
        ? 'Pagamento de ' + fmtMoeda(cob.valor) + ' confirmado. Seu treino está liberado.'
        : 'Seu personal não confirmou o pagamento de ' + fmtMoeda(cob.valor)
          + (motivoRecusa.trim() ? ': ' + motivoRecusa.trim() : '.') + ' Você pode informar novamente.',
        '/aluno')
      setRecusando(null)
      setMotivo('')
    } catch (err) {
      console.error('Falha ao validar pagamento:', err)
      setErro('Não foi possível salvar. Verifique sua conexão e tente novamente.')
    } finally {
      setOcupado(null)
    }
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
      if (c.status === EM_ANALISE) pendentesValidacao.push(item)
      else if (c.status === PAGO) historico.push(item)
      else abertas.push(item)   // pendente e recusado: as duas ainda são devidas
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
          <h2>Pagamentos informados pelos alunos</h2>
          <p className="muted">
            O aluno avisou que fez o PIX. Confira no seu extrato se o valor caiu antes de confirmar.
          </p>
          {erro && <div className="pag-erro" role="alert"><span>{erro}</span></div>}
          {pendentesValidacao.map(c => (
            <div key={c.cid} className="pag-validar">
              <div className="pag-validar-topo">
                <div>
                  <strong>{c.aluno}</strong>
                  <div className="pag-validar-sub">
                    {tituloCobranca(c)} · vence em {dataBR(c.vencimento)}
                  </div>
                </div>
                <span className="pag-validar-valor">{fmtMoeda(c.valor)}</span>
              </div>

              <div className="pag-validar-info">
                {c.pagamento?.data && <span>Informado em {fmtData(c.pagamento.data)}</span>}
                {c.pagamento?.obs && <span className="pag-validar-obs">“{c.pagamento.obs}”</span>}
                {c.pagamento?.comprovante && (
                  <a href={c.pagamento.comprovante} target="_blank" rel="noreferrer">Ver comprovante</a>
                )}
              </div>

              {recusando === c.cid ? (
                <div className="pag-recusa">
                  <label htmlFor={'motivo-' + c.cid}>
                    Motivo da recusa <span className="pag-opcional">(o aluno vê este texto)</span>
                  </label>
                  <input
                    id={'motivo-' + c.cid} value={motivo} maxLength={300}
                    onChange={e => setMotivo(e.target.value)}
                    placeholder="Ex: não encontrei esse valor no extrato"
                    disabled={ocupado === c.cid}
                  />
                  <div className="aluno-acoes">
                    <button
                      className="btn btn-sm" disabled={ocupado === c.cid}
                      onClick={() => validar(c, false, motivo)}
                    >
                      {ocupado === c.cid ? 'Salvando...' : 'Confirmar recusa'}
                    </button>
                    <button
                      className="btn btn-sec btn-sm" disabled={ocupado === c.cid}
                      onClick={() => { setRecusando(null); setMotivo('') }}
                    >
                      Voltar
                    </button>
                  </div>
                </div>
              ) : (
                <div className="aluno-acoes">
                  <button
                    className="btn btn-sm" disabled={ocupado === c.cid}
                    onClick={() => validar(c, true)}
                  >
                    {ocupado === c.cid ? 'Salvando...' : 'Confirmar pagamento'}
                  </button>
                  <button
                    className="btn btn-sec btn-sm" disabled={ocupado === c.cid}
                    onClick={() => { setRecusando(c.cid); setMotivo(''); setErro('') }}
                  >
                    Recusar
                  </button>
                  <button
                    className="btn btn-perigo-sutil btn-sm" disabled={ocupado === c.cid}
                    onClick={() => deletar(c.aid, c.cid)}
                  >
                    Deletar
                  </button>
                </div>
              )}
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
                Vence em {dataBR(c.vencimento)} {vencida(c) ? '· VENCIDA (treino bloqueado)' : ''}
              </div>
              {c.status === 'recusado' && (
                <div className="muted">
                  Você recusou o pagamento informado{c.motivoRecusa ? ': “' + c.motivoRecusa + '”' : ''}
                </div>
              )}
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
