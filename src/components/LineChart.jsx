export default function LineChart({ pontos, unidade = 'kg', altura = 180 }) {
  // pontos: [{label, valor}]
  if (!pontos || pontos.length === 0) {
    return <p className="muted">Sem dados suficientes para o gráfico.</p>
  }
  const largura = 560
  const padE = 44, padD = 12, padT = 16, padB = 28
  const valores = pontos.map(p => Number(p.valor) || 0)
  const min = Math.min(...valores)
  const max = Math.max(...valores)
  const faixa = max - min || 1
  const passoX = pontos.length > 1 ? (largura - padE - padD) / (pontos.length - 1) : 0
  const x = i => padE + i * passoX
  const y = v => padT + (altura - padT - padB) * (1 - (v - min) / faixa)
  const linha = valores.map((v, i) => (i === 0 ? 'M' : 'L') + x(i) + ',' + y(v)).join(' ')

  return (
    <svg viewBox={'0 0 ' + largura + ' ' + altura} style={{ width: '100%', height: 'auto' }}>
      <line x1={padE} y1={y(min)} x2={largura - padD} y2={y(min)} stroke="#e2e1e4" />
      <line x1={padE} y1={y(max)} x2={largura - padD} y2={y(max)} stroke="#e2e1e4" />
      <text x={padE - 6} y={y(max) + 4} textAnchor="end" fontSize="11" fill="#8a8990">{max}{unidade}</text>
      <text x={padE - 6} y={y(min) + 4} textAnchor="end" fontSize="11" fill="#8a8990">{min}{unidade}</text>
      <path d={linha} fill="none" stroke="#610A13" strokeWidth="2.5" strokeLinecap="round" />
      {valores.map((v, i) => (
        <g key={i}>
          <circle cx={x(i)} cy={y(v)} r="4" fill="#610A13" />
          <text x={x(i)} y={altura - 8} textAnchor="middle" fontSize="10" fill="#8a8990">
            {pontos[i].label}
          </text>
        </g>
      ))}
    </svg>
  )
}
