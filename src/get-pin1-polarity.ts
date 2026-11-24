import type { AnyCircuitElement, SourcePort } from "circuit-json"

const anodeHints = new Set(["a", "anode", "pos", "positive", "+"])
const cathodeHints = new Set(["c", "k", "cathode", "neg", "negative", "-"])

export const getPin1Polarity = (
  circuitJson: AnyCircuitElement[],
  sourceComponentId?: string,
): "anode" | "cathode" | null => {
  const ports = circuitJson.filter(
    (element): element is SourcePort =>
      element.type === "source_port" &&
      (!sourceComponentId || element.source_component_id === sourceComponentId),
  )
  const port =
    ports.find((port) => port.pin_number === 1) ??
    ports.find((port) =>
      [port.name, ...(port.port_hints ?? [])].some(
        (hint) => hint.toLowerCase() === "pin1",
      ),
    )
  if (!port) return null
  const hints = [port.name, ...(port.port_hints ?? [])].map((hint) =>
    hint.toLowerCase(),
  )
  const hasAnode = hints.some((hint) => anodeHints.has(hint))
  const hasCathode = hints.some((hint) => cathodeHints.has(hint))
  if (hasAnode === hasCathode) return null
  if (hasAnode) return "anode"
  return "cathode"
}
