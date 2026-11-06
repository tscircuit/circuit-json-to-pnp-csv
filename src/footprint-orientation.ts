import type { AnyCircuitElement, PcbComponent } from "circuit-json"

type Point = { x: number; y: number }
type Pad = Extract<
  AnyCircuitElement,
  { type: "pcb_smtpad" | "pcb_plated_hole" }
>

const numericHint = (hint: string) => /^\d+$/.test(hint)
const normalizeHint = (hint: string) =>
  hint
    .trim()
    .toLowerCase()
    .replace(/^pin(?=\d+$)/, "")
const getCenter = (pad: Pad): Point => {
  if (pad.type === "pcb_smtpad" && pad.shape === "polygon") {
    const xs = pad.points.map((p) => p.x)
    const ys = pad.points.map((p) => p.y)
    return {
      x: (Math.min(...xs) + Math.max(...xs)) / 2,
      y: (Math.min(...ys) + Math.max(...ys)) / 2,
    }
  }
  return { x: pad.x, y: pad.y }
}

export const getPads = (json: AnyCircuitElement[], componentId?: string) =>
  json.filter(
    (e): e is Pad =>
      (e.type === "pcb_smtpad" || e.type === "pcb_plated_hole") &&
      (componentId === undefined || e.pcb_component_id === componentId),
  )

export const getLocalPads = (
  json: AnyCircuitElement[],
  component: PcbComponent,
): Pad[] => {
  const angle = (-component.rotation * Math.PI) / 180
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  const local = (p: Point): Point => {
    const x = p.x - component.center.x
    const y = p.y - component.center.y
    return { x: x * cos - y * sin, y: x * sin + y * cos }
  }
  return getPads(json, component.pcb_component_id).map(
    (pad): Pad =>
      pad.type === "pcb_smtpad" && pad.shape === "polygon"
        ? { ...pad, points: pad.points.map(local) }
        : { ...pad, ...local(getCenter(pad)) },
  )
}

// Source-port aliases survive imports that renumber electrical pads (e.g. USB-C
// A1B12/GND1). Only unique aliases can establish a pad correspondence.
const getLabeledPads = (
  json: AnyCircuitElement[],
  component: PcbComponent | undefined,
  pads: Pad[],
) => {
  const ports = json.filter(
    (e): e is Extract<AnyCircuitElement, { type: "source_port" }> =>
      e.type === "source_port" &&
      e.source_component_id === component?.source_component_id,
  )
  const pcbPorts = new Map(
    json.flatMap((e) =>
      e.type === "pcb_port" ? [[e.pcb_port_id, e] as const] : [],
    ),
  )
  return pads.map((pad) => {
    const hints = (pad.port_hints ?? []).map(normalizeHint)
    const sourceId = pad.pcb_port_id
      ? pcbPorts.get(pad.pcb_port_id)?.source_port_id
      : undefined
    const candidates = ports.filter((port) =>
      [port.name, String(port.pin_number), ...(port.port_hints ?? [])].some(
        (hint) => hints.includes(normalizeHint(hint)),
      ),
    )
    const port = sourceId
      ? ports.find((port) => port.source_port_id === sourceId)
      : candidates.length === 1
        ? candidates[0]
        : undefined
    return {
      center: getCenter(pad),
      hints: new Set([
        ...hints,
        ...(port
          ? [port.name, ...(port.port_hints ?? [])].map(normalizeHint)
          : []),
      ]),
    }
  })
}

export const getMatchedPadRotation = (
  localJson: AnyCircuitElement[],
  component: PcbComponent,
  localPads: Pad[],
  supplierJson: AnyCircuitElement[],
  supplierComponent: PcbComponent | undefined,
  supplierPads: Pad[],
): number | null => {
  const local = getLabeledPads(localJson, component, localPads)
  const supplier = getLabeledPads(supplierJson, supplierComponent, supplierPads)
  const unique = (pads: typeof local, semantic: boolean) => {
    const map = new Map<string, number[]>()
    pads.forEach((pad, index) =>
      pad.hints.forEach((hint) => {
        if (!hint || numericHint(hint) === semantic) return
        map.set(hint, [...(map.get(hint) ?? []), index])
      }),
    )
    return new Map(
      [...map]
        .filter(([, indices]) => indices.length === 1)
        .map(([hint, indices]) => [hint, indices[0]!]),
    )
  }
  for (const semantic of [true, false]) {
    const a = unique(local, semantic)
    const b = unique(supplier, semantic)
    const pairs = new Map<number, number>()
    const reverse = new Map<number, number>()
    for (const [hint, i] of a) {
      const j = b.get(hint)
      if (j === undefined) continue
      if (
        (pairs.has(i) && pairs.get(i) !== j) ||
        (reverse.has(j) && reverse.get(j) !== i)
      )
        return null
      pairs.set(i, j)
      reverse.set(j, i)
    }
    if (pairs.size < 2) continue
    const matches = [...pairs].map(([i, j]) => ({
      local: local[i]!.center,
      supplier: supplier[j]!.center,
    }))
    const centroid = (side: "local" | "supplier"): Point => ({
      x: matches.reduce((sum, m) => sum + m[side].x, 0) / matches.length,
      y: matches.reduce((sum, m) => sum + m[side].y, 0) / matches.length,
    })
    const localCenter = centroid("local")
    const supplierCenter = centroid("supplier")
    // Imported CAD rounds coordinates. Ten micrometres permits that rounding
    // while rejecting reflections, wrong pin maps and different pad pitches.
    const tolerance = 0.01
    if (
      !matches.some(
        (m) =>
          Math.hypot(m.local.x - localCenter.x, m.local.y - localCenter.y) >
          tolerance * 2,
      )
    )
      continue
    const candidates = [0, 90, 180, 270].filter((degrees) => {
      const radians = (degrees * Math.PI) / 180
      return matches.every((m) => {
        const x = m.supplier.x - supplierCenter.x
        const y = m.supplier.y - supplierCenter.y
        return (
          Math.hypot(
            x * Math.cos(radians) -
              y * Math.sin(radians) -
              (m.local.x - localCenter.x),
            x * Math.sin(radians) +
              y * Math.cos(radians) -
              (m.local.y - localCenter.y),
          ) <= tolerance
        )
      })
    })
    // Once there are two matching semantic anchors, do not fall back to
    // numeric indices if their positions disagree.
    return candidates.length === 1 ? candidates[0]! : null
  }
  return null
}
