import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AdminShell, { useDadosAdmin } from './AdminShell.jsx'
import { PERIODOS, visaoGeral, alertas, historicoAdmin, descreverLog } from '../../lib/admin'
import { PLANOS } from '../../lib/planos'
import { fmtMoeda, fmtData, fmtHora } from '../../lib/util'

/*
  O painel.

  Duas regras guiaram o desenho:

  1. Número que não leva a lugar nenhum é decoração. Cada métrica e cada alerta
     abre a lista já filtrada — a pergunta seguinte a "3 bloqueados" é sempre
     "quem são eles?", e responder isso não deveria custar uma nova busca.

  2. O que não existe no banco não aparece inventado. Não há registro de
     pagamento da plataforma em lugar nenhum — o que dá para calcular é a
     projeção (Pro ativos × preço), e ela é rotulada como projeção. "Receita
     recebida" e "inadimplência" viriam de dados que não existem.
*/
export default function AdminHome() {
  const { personais, alunos, logs, temPresenca, carregando, erro } = useDadosAdmin()
  const [periodo, setPeriodo] = useState('30')
  const navigate = useNavigate()

  const dias = PERIODOS.find(p => p.id === periodo)?.dias ?? 30
  const v = useMemo(() => visaoGeral({ personais, alunos, dias }), [personais, alunos, dias])
  const avisos = useMemo(() => alertas({ personais, alunos }), [personais, alunos])
  const historico = useMemo(() => historicoAdmin(logs), [logs])
  const nomes = useMemo(
    () => Object.fromEntries(personais.map(p => [p.uid, p.nome])),
    [personais]
  )

  const Num = ({ n, rot, rota, tom }) => (
    <button
      className={'adm-num' + (tom ? ' ' + tom : '') + (rota ? '' : ' morto')}
      onClick={() => rota && navigate(rota)}
      disabled={!rota}
    >
      <strong>{n}</strong>
      <span>{rot}</span>
    </button>
  )

  return (
    <AdminShell
      titulo="Visão geral"
      subtitulo="O que está acontecendo na plataforma."
      acao={
        <div className="adm-periodo">
          {PERIODOS.map(p => (
            <button
              key={p.id}
              className={periodo === p.id ? 'ativo' : ''}
              onClick={() => setPeriodo(p.id)}
            >
              {p.rotulo}
            </button>
          ))}
        </div>
      }
    >
      {erro && <div className="erro">{erro}</div>}
      {carregando && <p className="muted">Carregando...</p>}

      {!carregando && !erro && (
        <div className="adm-grade">
          <div className="adm-col">
            {/* ---------- receita ---------- */}
            <section className="adm-bloco destaque">
              <h2>Receita recorrente projetada</h2>
              <div className="adm-mrr">
                <strong>{fmtMoeda(v.receita.mrrProjetado)}<small>/mês</small></strong>
                <span>
                  {v.assinaturas.proAtivos} Pro ativo{v.assinaturas.proAtivos === 1 ? '' : 's'} × {fmtMoeda(PLANOS.pro.preco)}
                </span>
              </div>
              <div className="adm-mrr-linha">
                <div>
                  <span>Em risco</span>
                  <strong className={v.receita.emRisco > 0 ? 'ruim' : ''}>{fmtMoeda(v.receita.emRisco)}</strong>
                  <small>Pro em atraso, cancelado ou bloqueado</small>
                </div>
                <div>
                  <span>Conversão para Pro</span>
                  <strong>{v.receita.conversao}%</strong>
                  <small>{v.assinaturas.pro} de {v.personais.total} no plano Pro, ativos ou não</small>
                </div>
              </div>
              <p className="adm-nota">
                É projeção, não caixa. O app não guarda registro de pagamento da
                plataforma — só o estado atual de cada assinatura.
              </p>
            </section>

            {/* ---------- requer atenção ---------- */}
            {avisos.length > 0 && (
              <section className="adm-bloco">
                <h2>Requer atenção</h2>
                <ul className="adm-alertas">
                  {avisos.map(a => (
                    <li key={a.id} className={a.urgente ? 'urgente' : ''}>
                      <button onClick={() => navigate(a.rota)}>
                        <span className="adm-alerta-n">{a.n}</span>
                        <span className="adm-alerta-txt">
                          <strong>{a.titulo}</strong>
                          <span>{a.detalhe}</span>
                        </span>
                        <span className="adm-alerta-ir">Ver →</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {avisos.length === 0 && (
              <p className="adm-tudo-certo">Nada pedindo atenção agora.</p>
            )}

            {/* ---------- números ---------- */}
            <section className="adm-bloco">
              <h2>Personais</h2>
              <div className="adm-nums">
                <Num n={v.personais.total} rot="no total" rota="/admin/personals" />
                <Num n={v.personais.ativos} rot="ativos" rota="/admin/personals?status=active" />
                <Num n={v.personais.emAtraso} rot="marcados em atraso" rota="/admin/personals?status=past_due" tom={v.personais.emAtraso ? 'aviso' : ''} />
                <Num n={v.personais.bloqueados} rot="bloqueados" rota="/admin/personals?status=blocked" tom={v.personais.bloqueados ? 'ruim' : ''} />
                <Num n={v.personais.novos} rot={`novos em ${dias ? dias + 'd' : 'todo o período'}`} rota="/admin/personals?ordem=recentes" />
              </div>
              {v.personais.semDataCadastro > 0 && (
                <p className="adm-nota">
                  {v.personais.semDataCadastro} conta{v.personais.semDataCadastro === 1 ? '' : 's'} sem data de
                  cadastro — criadas antes de Set/2026, quando o campo passou a ser gravado.
                  Elas não entram em "novos".
                </p>
              )}
            </section>

            <section className="adm-bloco">
              <h2>Alunos</h2>
              <div className="adm-nums">
                <Num n={v.alunos.total} rot="no total" rota="/admin/alunos" />
                <Num n={v.alunos.ativos7d} rot="abriram o app em 7d" rota="/admin/alunos?filtro=ativos" />
                <Num n={v.alunos.nuncaEntraram} rot="nunca entraram" rota="/admin/alunos?filtro=nunca" tom={v.alunos.nuncaEntraram ? 'aviso' : ''} />
                <Num n={v.alunos.semPersonal} rot="sem personal" rota="/admin/alunos?filtro=sem_personal" tom={v.alunos.semPersonal ? 'ruim' : ''} />
                <Num n={v.alunos.novos} rot={`novos em ${dias ? dias + 'd' : 'todo o período'}`} rota="/admin/alunos?ordem=recentes" />
              </div>
              <p className="adm-nota">
                {temPresenca
                  ? '"Abriu o app" vem da presença, não de treino registrado: as execuções pertencem ao par personal↔aluno e o admin não as lê.'
                  : 'Sem leitura do nó de presença, "abriram o app" e "nunca entraram" ficam em zero — não são zero de verdade. Publique as regras do repositório no console do Firebase.'}
              </p>
            </section>
          </div>

          {/* ---------- coluna lateral ---------- */}
          <aside className="adm-col">
            <section className="adm-bloco">
              <h2>Assinaturas</h2>
              <div className="adm-barras">
                {[
                  { rot: 'Free', n: v.assinaturas.free, rota: '/admin/personals?plano=free' },
                  { rot: 'Pro', n: v.assinaturas.pro, rota: '/admin/personals?plano=pro' }
                ].map(b => (
                  <button key={b.rot} className="adm-barra" onClick={() => navigate(b.rota)}>
                    <span>{b.rot}</span>
                    <span className="adm-barra-trilho">
                      <span
                        className="adm-barra-fill"
                        style={{ width: (v.personais.total ? (b.n / v.personais.total) * 100 : 0) + '%' }}
                      />
                    </span>
                    <strong>{b.n}</strong>
                  </button>
                ))}
              </div>
              <div className="adm-nums compacto">
                <Num n={v.assinaturas.vencendo7d} rot="vencem em 7d" rota="/admin/personals?venc=next_7d" tom={v.assinaturas.vencendo7d ? 'aviso' : ''} />
                <Num n={v.assinaturas.vencidas} rot="já vencidas" rota="/admin/personals?venc=expired" tom={v.assinaturas.vencidas ? 'ruim' : ''} />
              </div>
            </section>

            <section className="adm-bloco">
              <h2>Ações administrativas</h2>
              {historico.length === 0 ? (
                <p className="muted">Nenhuma ação registrada ainda.</p>
              ) : (
                <ul className="adm-logs">
                  {historico.map(l => (
                    <li key={l.id}>
                      <strong>{descreverLog(l, nomes)}</strong>
                      <span>
                        {fmtData(l.at)} às {fmtHora(l.at)}
                        {l.note ? ` · “${l.note}”` : ''}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              <p className="adm-nota">
                Toda alteração de plano, limite ou status fica registrada em <code>adminLogs</code>.
              </p>
            </section>
          </aside>
        </div>
      )}
    </AdminShell>
  )
}
