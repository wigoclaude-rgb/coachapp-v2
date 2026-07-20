import { useState } from 'react'

const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']
const DIAS = ['D','S','T','Q','Q','S','S']

export default function Heatmap({ diasTreinados }) {
  // diasTreinados: Set de strings 'YYYY-MM-DD'
  const hoje = new Date()
  const [ano, setAno] = useState(hoje.getFullYear())
  const [mes, setMes] = useState(hoje.getMonth())

  const primeiroDia = new Date(ano, mes, 1).getDay()
  const totalDias = new Date(ano, mes + 1, 0).getDate()
  const celulas = []
  for (let i = 0; i < primeiroDia; i++) celulas.push(null)
  for (let d = 1; d <= totalDias; d++) celulas.push(d)

  function chave(d) {
    return ano + '-' + String(mes + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0')
  }

  function anterior() {
    if (mes === 0) { setMes(11); setAno(ano - 1) } else setMes(mes - 1)
  }
  function proximo() {
    if (mes === 11) { setMes(0); setAno(ano + 1) } else setMes(mes + 1)
  }

  const treinadosNoMes = celulas.filter(d => d && diasTreinados.has(chave(d))).length

  return (
    <div>
      <div className="heat-nav">
        <button className="btn btn-sec btn-sm" onClick={anterior}>Anterior</button>
        <strong>{MESES[mes]} {ano}</strong>
        <button className="btn btn-sec btn-sm" onClick={proximo}>Próximo</button>
      </div>
      <div className="heat-grid">
        {DIAS.map((d, i) => <div key={'h' + i} className="heat-dia-label">{d}</div>)}
        {celulas.map((d, i) => (
          <div key={i} className={'heat-celula ' + (d ? (diasTreinados.has(chave(d)) ? 'treinou' : 'vazio') : 'oculto')}>
            {d || ''}
          </div>
        ))}
      </div>
      <p className="muted" style={{ marginTop: 8 }}>{treinadosNoMes} dia(s) de treino neste mês.</p>
    </div>
  )
}
