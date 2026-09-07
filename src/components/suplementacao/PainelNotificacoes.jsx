import { useEffect, useState } from 'react'
import { ref, onValue, update } from 'firebase/database'
import { db } from '../../firebase'
import {
  temSuporte, motivoIndisponivel, ativar, desativar, estaAtivo,
  ehIOS, instaladoNaTela
} from '../../lib/push'
import { diaISO } from '../../lib/suplementos'

/*
  Controle geral dos lembretes, para o aluno desligar tudo sem abrir suplemento
  por suplemento — é o que a pessoa procura quando está incomodada, e ela não
  vai editar sete cadastros para conseguir sossego.

  Dois níveis, de propósito:
    - `users/{uid}/notificacoes.suplementos` é a preferência da CONTA; vale em
      qualquer aparelho e é o que o agendador consulta antes de enviar
    - a inscrição de push é do APARELHO; desligar no celular velho não desliga
      no novo
*/
export default function PainelNotificacoes({ uid }) {
  const [prefs, setPrefs] = useState({})
  const [pushAtivo, setPushAtivo] = useState(null)
  const [ocupado, setOcupado] = useState(false)
  const [erro, setErro] = useState('')

  useEffect(() => {
    if (!uid) return
    return onValue(ref(db, 'users/' + uid + '/notificacoes'), s => setPrefs(s.val() || {}))
  }, [uid])

  useEffect(() => {
    if (!uid) return
    let vivo = true
    estaAtivo(uid).then(v => vivo && setPushAtivo(v))
    return () => { vivo = false }
  }, [uid])

  const impedimento = motivoIndisponivel()
  const receber = prefs.suplementos !== false
  const silenciadoAte = prefs.silenciarAte && diaISO() <= prefs.silenciarAte ? prefs.silenciarAte : null

  const gravar = campos => update(ref(db, 'users/' + uid + '/notificacoes'), campos)

  async function alternarAparelho() {
    setOcupado(true); setErro('')
    if (pushAtivo) {
      await desativar(uid)
      setPushAtivo(false)
    } else {
      const r = await ativar(uid)
      setPushAtivo(r.ok)
      if (!r.ok) setErro(r.erro)
    }
    setOcupado(false)
  }

  function silenciarHoje() {
    gravar({ silenciarAte: silenciadoAte ? null : diaISO() })
  }

  if (!temSuporte() && !ehIOS()) return null

  return (
    <section className="card pn">
      <div className="card-titulo"><h2>Lembretes no celular</h2></div>

      {impedimento ? (
        <div className="lem-permissao aviso">
          <strong>
            {ehIOS() && !instaladoNaTela()
              ? 'Adicione o CoachApp à tela de início'
              : 'Não disponível neste aparelho'}
          </strong>
          <span>{impedimento}</span>
        </div>
      ) : (
        <>
          <div className="pn-linha">
            <div>
              <strong>Notificações neste aparelho</strong>
              <span className="mini">
                {pushAtivo === null ? 'Verificando...'
                  : pushAtivo ? 'Ativas. Você recebe os lembretes aqui.'
                  : 'Desligadas. Nenhum lembrete chega neste celular.'}
              </span>
            </div>
            <button
              className={'btn btn-sm' + (pushAtivo ? ' btn-sec' : '')}
              onClick={alternarAparelho} disabled={ocupado || pushAtivo === null}
            >
              {ocupado ? '...' : pushAtivo ? 'Desligar' : 'Ativar'}
            </button>
          </div>

          {erro && <div className="erro">{erro}</div>}

          <div className="pn-linha">
            <div>
              <strong>Receber lembretes de suplementação</strong>
              <span className="mini">
                Desligado aqui, para em todos os seus aparelhos — os horários ficam salvos.
              </span>
            </div>
            <label className="pn-switch">
              <input
                type="checkbox" checked={receber}
                onChange={e => gravar({ suplementos: e.target.checked })}
              />
              <span />
            </label>
          </div>

          <div className="pn-linha">
            <div>
              <strong>Silenciar por hoje</strong>
              <span className="mini">
                {silenciadoAte
                  ? 'Nenhum lembrete até amanhã.'
                  : 'Pausa só o dia de hoje, sem mexer na sua rotina.'}
              </span>
            </div>
            <button className="btn btn-sec btn-sm" onClick={silenciarHoje}>
              {silenciadoAte ? 'Voltar a receber' : 'Silenciar'}
            </button>
          </div>
        </>
      )}
    </section>
  )
}
