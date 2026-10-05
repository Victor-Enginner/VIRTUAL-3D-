import * as React from "react"
import { FlightStatusCardAdaptive } from "@/components/ui/flight-status-card"

// Seus envios do dia no formato do cartão de voo: ENV (enviados) → LIM (limite diário).
// Só mostra o que o servidor já sabe (/api/estado → envio). Em "só escuta" o número é o que você marcou como enviado à mão.
type Envio = { enviados_hoje: number; limite: number; pode: boolean; motivo?: string; so_escuta?: boolean; proximo?: string | null; na_fila?: number }

const hora = (iso?: string | null) => {
  if (!iso) return null
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? null : d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
}

export function CartaoEnvios() {
  const [envio, setEnvio] = React.useState<Envio | null>(null)

  React.useEffect(() => {
    let vivo = true
    const ler = () =>
      fetch("/api/estado")
        .then((r) => r.json())
        .then((e) => vivo && setEnvio(e.envio))
        .catch(() => {})
    ler()
    const t = setInterval(ler, 15000)
    return () => {
      vivo = false
      clearInterval(t)
    }
  }, [])

  if (!envio) return null
  const { enviados_hoje: feitos, limite } = envio
  const progresso = limite > 0 ? Math.min(100, Math.round((feitos / limite) * 100)) : 0
  const prox = hora(envio.proximo)
  return (
    <FlightStatusCardAdaptive
      departureCode="ENV"
      arrivalCode="LIM"
      departureCity={`${feitos} enviados`}
      arrivalCity={`limite ${limite}`}
      departureTime="HOJE"
      arrivalTime={envio.so_escuta ? "SÓ ESCUTA" : "AUTOMÁTICO"}
      eta={prox ? `PRÓXIMO ${prox}` : envio.pode ? "PODE ENVIAR" : "AGUARDANDO"}
      timezone={envio.so_escuta ? "você envia à mão" : (envio.motivo ?? "")}
      nextEvent="NA FILA"
      nextEventTime={`${envio.na_fila ?? 0}`}
      progress={progresso}
      remainingTime={`${Math.max(0, limite - feitos)} restantes`}
    />
  )
}
