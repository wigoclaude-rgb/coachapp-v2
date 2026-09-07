import { useEffect, useState } from 'react'
import { ANTECEDENCIAS, normalizarLembrete, ATRASO_COBRANCA } from '../../lib/lembretes'
import { motivoIndisponivel, ativar, estaAtivo, ehIOS, instaladoNaTela } from '../../lib/push'

/*
  Lembrete de um suplemento.

  A permissão de notificação é pedida AQUI, no instante em que a pessoa liga o
  lembrete — e não ao abrir o app. Quem é abordado por um pedido de permissão
  sem contexto quase sempre nega, e negar é praticamente definitivo: depois só
  se reverte nas configurações do navegador.

  Um horário por dose: `vezesAoDia` = 3 gera três campos. Um horário só não
  lembra três doses, e era o que o modelo antigo permitia.
*/
export default function CampoLembrete({ form, onMudar, uid, podeAtivar }) {
  const lembrete = normalizarLembrete(form)

  const [pushAtivo, setPushAtivo] = useState(null)   // null = ainda verificando
  const [ativando, setAtivando] = useState(false)
  const [erroPush, setErroPush] = useState('')

  const impedimento = motivoIndisponivel()

  useEffect(() => {
    if (!uid || !podeAtivar) return
    let vivo = true
    estaAtivo(uid).then(v => vivo && setPushAtivo(v))
    return () => { vivo = false }
  }, [uid, podeAtivar])

  const mudarLembrete = campos =>
    onMudar({ ...form, lembrete: { ...lembrete, ...campos } })


  async function ligarNotificacoes() {
    setAtivando(true)
    setErroPush('')
    const r = await ativar(uid)
    setPushAtivo(r.ok)
    if (!r.ok) setErroPush(r.erro)
    setAtivando(false)
  }

  const semHorario = lembrete.ativo && lembrete.horarios.length === 0

  return (
    <fieldset className="lem">
      <legend>Lembrete no celular</legend>

      <label className="lem-check">
        <input
          type="checkbox"
          checked={form.lembrete?.ativo === true}
          onChange={e => mudarLembrete({ ativo: e.target.checked })}
        />
        <span>Quero ser lembrado na hora da dose</span>
      </label>

      {form.lembrete?.ativo && (
        <>
          {semHorario && (
            <p className="lem-aviso">
              Preencha o horário da dose acima — sem ele não há quando avisar.
            </p>
          )}

          <div className="fc-campo">
            <label htmlFor="lem-ant">Avisar</label>
            <select
              id="lem-ant" value={lembrete.antecedencia}
              onChange={e => mudarLembrete({ antecedencia: Number(e.target.value) })}
            >
              {ANTECEDENCIAS.map(a => <option key={a.id} value={a.id}>{a.rotulo}</option>)}
            </select>
          </div>

          <label className="lem-check">
            <input
              type="checkbox"
              checked={lembrete.cobrar}
              onChange={e => mudarLembrete({ cobrar: e.target.checked })}
            />
            <span>
              Perguntar de novo depois de {ATRASO_COBRANCA} minutos, se eu não registrar
            </span>
          </label>
          <p className="mini">
            Só isso. Sem resposta, a dose fica como <strong>não registrada</strong> —
            o app nunca marca que você não tomou.
          </p>

          {/* Permissão: só o aluno, e só quando ele já ligou o lembrete. */}
          {podeAtivar && (
            impedimento ? (
              <div className="lem-permissao aviso">
                <strong>
                  {ehIOS() && !instaladoNaTela()
                    ? 'Falta adicionar o CoachApp à tela de início'
                    : 'Não dá para ativar neste aparelho'}
                </strong>
                <span>{impedimento}</span>
              </div>
            ) : pushAtivo === false ? (
              <div className="lem-permissao">
                <strong>Ative as notificações para receber os lembretes</strong>
                <span>Sem isso o horário fica salvo, mas o celular não toca.</span>
                {erroPush && <span className="lem-erro">{erroPush}</span>}
                <button
                  type="button" className="btn btn-sm" disabled={ativando}
                  onClick={ligarNotificacoes}
                >
                  {ativando ? 'Ativando...' : 'Ativar notificações'}
                </button>
              </div>
            ) : pushAtivo === true ? (
              <p className="lem-ok">Notificações ativas neste aparelho.</p>
            ) : null
          )}
        </>
      )}
    </fieldset>
  )
}
