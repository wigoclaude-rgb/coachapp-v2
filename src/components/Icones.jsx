/* Biblioteca de ícones SVG (stroke 1.6, cantos suaves). Herdam a cor via currentColor. */
const base = {
  width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none',
  stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round'
}

/* --- Navegação --- */
export const IcInicio = () => (
  <svg {...base}><path d="M3 9.5 12 3l9 6.5V20a1.5 1.5 0 0 1-1.5 1.5H4.5A1.5 1.5 0 0 1 3 20z" /><path d="M9.5 21.5v-7h5v7" /></svg>
)
export const IcAlunos = () => (
  <svg {...base}><path d="M16 20v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 18.5V20" /><circle cx="10" cy="7.5" r="3.5" /><path d="M20 20v-1.5a3.5 3.5 0 0 0-2.6-3.4" /><path d="M15 4.2a3.5 3.5 0 0 1 0 6.6" /></svg>
)
export const IcFinanceiro = () => (
  <svg {...base}><rect x="2.5" y="5" width="19" height="14" rx="2.5" /><path d="M2.5 9.5h19" /><path d="M6.5 14.5h3" /></svg>
)
export const IcChat = () => (
  <svg {...base}><path d="M21 12.5a7.5 7.5 0 0 1-7.5 7.5H8l-4 3v-4.6A7.5 7.5 0 0 1 3 12.5 7.5 7.5 0 0 1 10.5 5h3A7.5 7.5 0 0 1 21 12.5z" /></svg>
)
export const IcTemplates = () => (
  <svg {...base}><rect x="3" y="3" width="7.5" height="7.5" rx="2" /><rect x="13.5" y="3" width="7.5" height="7.5" rx="2" /><rect x="3" y="13.5" width="7.5" height="7.5" rx="2" /><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="2" /></svg>
)
export const IcConfig = () => (
  <svg {...base}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>
)
export const IcTreino = () => (
  <svg {...base}><path d="M6.5 8v8M3.5 10v4M17.5 8v8M20.5 10v4M6.5 12h11" /></svg>
)
export const IcEvolucao = () => (
  <svg {...base}><path d="M3 17.5 9 11l4 3.5 7.5-8" /><path d="M15.5 6.5H21v5.5" /></svg>
)
export const IcPagamentos = () => (
  <svg {...base}><rect x="2.5" y="5" width="19" height="14" rx="2.5" /><path d="M2.5 9.5h19" /><path d="M6.5 14.5h3" /></svg>
)

/* --- Ações --- */
export const IcRaio = () => (
  <svg {...base}><path d="M13 2.5 4.5 13.5H11l-1 8 8.5-11H12z" /></svg>
)
export const IcMais = () => (
  <svg {...base}><path d="M12 5v14M5 12h14" /></svg>
)
export const IcCheck = () => (
  <svg {...base}><path d="M20 6.5 9.5 17 4 11.5" /></svg>
)
export const IcRelogio = () => (
  <svg {...base}><circle cx="12" cy="12" r="9" /><path d="M12 7v5.2l3.2 1.9" /></svg>
)
export const IcBusca = () => (
  <svg {...base}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
)
export const IcFiltro = () => (
  <svg {...base}><path d="M3 5.5h18M6.5 12h11M10 18.5h4" /></svg>
)
export const IcCopiar = () => (
  <svg {...base}><rect x="9" y="9" width="12" height="12" rx="2.5" /><path d="M5.5 15H4.5A1.5 1.5 0 0 1 3 13.5v-9A1.5 1.5 0 0 1 4.5 3h9A1.5 1.5 0 0 1 15 4.5v1" /></svg>
)
export const IcEditar = () => (
  <svg {...base}><path d="M4 20h4L19.5 8.5a2.1 2.1 0 0 0-3-3L5 17v3z" /><path d="M15.5 5.5 18.5 8.5" /></svg>
)
export const IcLixeira = () => (
  <svg {...base}><path d="M4 6.5h16" /><path d="M9 6.5V4.5A1.5 1.5 0 0 1 10.5 3h3A1.5 1.5 0 0 1 15 4.5v2" /><path d="M6.5 6.5 7.5 20a1.5 1.5 0 0 0 1.5 1.4h6a1.5 1.5 0 0 0 1.5-1.4l1-13.5" /><path d="M10.5 11v6M13.5 11v6" /></svg>
)
export const IcDuplicar = () => (
  <svg {...base}><rect x="8.5" y="8.5" width="12.5" height="12.5" rx="2.5" /><path d="M15.5 5.5v-1A1.5 1.5 0 0 0 14 3H4.5A1.5 1.5 0 0 0 3 4.5V14a1.5 1.5 0 0 0 1.5 1.5h1" /></svg>
)
export const IcPlay = () => (
  <svg {...base}><path d="M7 4.5v15l12.5-7.5z" /></svg>
)
export const IcSeta = () => (
  <svg {...base}><path d="M5 12h14M13 6l6 6-6 6" /></svg>
)
export const IcVoltar = () => (
  <svg {...base}><path d="M19 12H5M11 18l-6-6 6-6" /></svg>
)
export const IcFogo = () => (
  <svg {...base}><path d="M12 3s5 4.2 5 9a5 5 0 0 1-10 0c0-1.6.6-3 1.4-4.2 0 1.6.9 2.7 2 2.7 1.5 0 2.1-1.6 1.6-7.5z" /><path d="M12 21a5 5 0 0 0 5-5" opacity="0" /></svg>
)
export const IcCalendario = () => (
  <svg {...base}><rect x="3" y="5" width="18" height="16" rx="2.5" /><path d="M3 10h18M8 3v4M16 3v4" /></svg>
)
export const IcHalter = () => (
  <svg {...base}><path d="M6.5 8v8M3.5 10v4M17.5 8v8M20.5 10v4M6.5 12h11" /></svg>
)
export const IcSino = () => (
  <svg {...base}><path d="M18 8.5a6 6 0 1 0-12 0c0 6-2.5 7.5-2.5 7.5h17S18 14.5 18 8.5z" /><path d="M13.7 20a2 2 0 0 1-3.4 0" /></svg>
)
export const IcMenu = () => (
  <svg {...base}><path d="M3.5 6.5h17M3.5 12h17M3.5 17.5h17" /></svg>
)
export const IcFechar = () => (
  <svg {...base}><path d="M6 6l12 12M18 6L6 18" /></svg>
)
export const IcAlerta = () => (
  <svg {...base}><circle cx="12" cy="12" r="9" /><path d="M12 7.5v5M12 16.2v.1" /></svg>
)
export const IcSair = () => (
  <svg {...base}><path d="M15 17l5-5-5-5" /><path d="M20 12H9" /><path d="M11 3H5.5A1.5 1.5 0 0 0 4 4.5v15A1.5 1.5 0 0 0 5.5 21H11" /></svg>
)
export const IcVideo = () => (
  <svg {...base}><rect x="2.5" y="5" width="19" height="14" rx="3" /><path d="M10 9.5v5l4.5-2.5z" /></svg>
)
export const IcTrofeu = () => (
  <svg {...base}><path d="M7 4h10v5a5 5 0 0 1-10 0z" /><path d="M7 5.5H4.5V7a3 3 0 0 0 3 3M17 5.5h2.5V7a3 3 0 0 1-3 3" /><path d="M12 14v3.5M8.5 21h7l-.5-3.5h-6z" /></svg>
)
export const IcEnviar = () => (
  <svg {...base}><path d="M21.5 2.5 11 13" /><path d="M21.5 2.5 15 21.5l-4-8.5-8.5-4z" /></svg>
)
