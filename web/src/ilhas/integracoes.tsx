import * as React from "react"
import { motion } from "framer-motion"

// "Integrações" do Configurador: o Prospector no centro e as peças que ele realmente usa ligadas por linhas.
// Baseado no card integration-card (21st.dev), sem laço infinito: parado fica estático; ao passar o mouse
// um pulso de luz percorre cada linha UMA vez. Só mostra o que existe no sistema (nada de logo de produto que não usamos).
const I = (d: React.ReactNode) => (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d}</svg>
)
const ICONES = {
  maps: I(<><path d="M12 21s7-6.2 7-11.5A7 7 0 005 9.5C5 14.8 12 21 12 21z" /><circle cx="12" cy="9.5" r="2.4" /></>),
  whatsapp: I(<><path d="M4 20l1.3-4.2A8 8 0 1112 20a8 8 0 01-3.8-1z" /><path d="M9 9.5c0 3 2.5 5.5 5.5 5.5l1-1.5-2-1-1 .8a3.5 3.5 0 01-1.6-1.6l.8-1-1-2z" /></>),
  modelo: I(<><path d="M12 3a4 4 0 00-4 4 3.5 3.5 0 00-2 6 3.5 3.5 0 003 5.5A3 3 0 0012 21V3z" /><path d="M12 3a4 4 0 014 4 3.5 3.5 0 012 6 3.5 3.5 0 01-3 5.5A3 3 0 0112 21" /></>),
  banco: I(<><ellipse cx="12" cy="6" rx="7" ry="3" /><path d="M5 6v6c0 1.7 3.1 3 7 3s7-1.3 7-3V6M5 12v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6" /></>),
  mapa: I(<><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18" /></>),
  site: I(<><rect x="3" y="4" width="18" height="14" rx="2" /><path d="M3 9h18M8 21h8" /></>),
}
type Item = { id: keyof typeof ICONES; nome: string; nota: string; x: number; y: number; d: string }
// centro em (282, 205) numa caixa 564×410
const ITENS: Item[] = [
  { id: "maps", nome: "Google Maps", nota: "Atlas acha as empresas", x: 110, y: 90, d: "M 270 205 V 105 Q 270 90 255 90 H 110" },
  { id: "site", nome: "Auditoria de site", nota: "Atlas confere o site", x: 360, y: 70, d: "M 294 205 V 85 Q 294 70 309 70 H 360" },
  { id: "mapa", nome: "IBGE · OSM", nota: "cidades e países", x: 160, y: 205, d: "M 250 205 H 160" },
  { id: "whatsapp", nome: "WhatsApp", nota: "você envia à mão", x: 480, y: 205, d: "M 314 205 H 480" },
  { id: "banco", nome: "Banco local", nota: "SQLite no seu PC", x: 282, y: 360, d: "M 282 205 V 360" },
  { id: "modelo", nome: "Modelo local", nota: "Nova e Maia (Ollama)", x: 460, y: 340, d: "M 314 215 V 325 Q 314 340 329 340 H 460" },
]

const vidro: React.CSSProperties = {
  background: "linear-gradient(160deg, rgb(255 255 255 / .12), rgb(255 255 255 / .03) 40%, rgb(255 255 255 / .06)), rgb(14 17 25 / .55)",
  boxShadow: "inset 0 1px 0 rgb(255 255 255 / .22), inset 0 0 0 1px rgb(255 255 255 / .06), 0 14px 34px rgb(0 0 0 / .4)",
  WebkitBackdropFilter: "blur(20px) saturate(180%)", backdropFilter: "blur(20px) saturate(180%)",
}

export function Integracoes() {
  const [passada, setPassada] = React.useState(0) // cada entrada do mouse dispara um pulso de cada linha
  const [saude, setSaude] = React.useState<{ leads?: number } | null>(null)
  React.useEffect(() => { fetch("/api/saude").then((r) => r.json()).then(setSaude).catch(() => {}) }, [])

  return (
    <div style={{ ...vidro, borderRadius: 28, overflow: "hidden", maxWidth: 620, color: "#f5f5f7" }}>
      <div onMouseEnter={() => setPassada((n) => n + 1)} style={{ position: "relative", aspectRatio: "564 / 410", width: "100%" }}>
        <div aria-hidden style={{ position: "absolute", inset: 0, opacity: 0.18, backgroundImage: "radial-gradient(circle, #fff 1px, transparent 1px)", backgroundSize: "30px 30px" }} />
        <svg viewBox="0 0 564 410" fill="none" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }} aria-hidden>
          <defs>
            <linearGradient id="int-g" x1="0" x2="1"><stop offset="0" stopColor="#b7ff00" stopOpacity="0" /><stop offset=".5" stopColor="#b7ff00" /><stop offset="1" stopColor="#00edff" stopOpacity="0" /></linearGradient>
          </defs>
          {ITENS.map((it) => (
            <g key={it.id}>
              <path d={it.d} stroke="rgb(255 255 255 / .16)" strokeWidth="1" />
              {passada > 0 && (
                <motion.path key={passada} d={it.d} stroke="url(#int-g)" strokeWidth="2" strokeDasharray="40 600"
                  initial={{ strokeDashoffset: 40 }} animate={{ strokeDashoffset: -640 }} transition={{ duration: 1.6, ease: "easeInOut" }} />
              )}
            </g>
          ))}
        </svg>

        <div style={{ ...vidro, position: "absolute", left: "50%", top: "50%", transform: "translate(-50%, -50%)", width: 74, height: 74, borderRadius: 22, display: "grid", placeItems: "center", background: "#b7ff00", color: "#111900", font: "800 34px system-ui", boxShadow: "0 10px 30px #b7ff0050" }}>P.</div>

        {ITENS.map((it) => (
          <div key={it.id} title={`${it.nome} — ${it.nota}`} style={{ ...vidro, position: "absolute", left: `${(it.x / 564) * 100}%`, top: `${(it.y / 410) * 100}%`, transform: "translate(-50%, -50%)", width: 54, height: 54, borderRadius: 18, display: "grid", placeItems: "center" }}>
            {ICONES[it.id]}
          </div>
        ))}
      </div>
      <div style={{ padding: "22px 26px 26px", display: "grid", gap: 8 }}>
        <h3 style={{ margin: 0, fontSize: 22, fontWeight: 650, letterSpacing: "-.02em" }}>O que está ligado ao Prospector</h3>
        <p style={{ margin: 0, fontSize: 15, lineHeight: 1.5, color: "rgb(245 245 247 / .65)" }}>
          Tudo roda no seu PC: o Atlas acha empresas no Maps e confere os sites, a Nova decide, a Maia escreve e você envia pelo WhatsApp.
          {saude?.leads != null ? ` Hoje são ${saude.leads} leads no banco local.` : ""}
        </p>
        <ul style={{ margin: "8px 0 0", padding: 0, listStyle: "none", display: "flex", flexWrap: "wrap", gap: 8 }}>
          {ITENS.map((it) => (
            <li key={it.id} style={{ fontSize: 12.5, padding: "5px 11px", borderRadius: 999, background: "rgb(255 255 255 / .09)", boxShadow: "inset 0 1px 0 rgb(255 255 255 / .16)" }}>{it.nome}</li>
          ))}
        </ul>
      </div>
    </div>
  )
}
