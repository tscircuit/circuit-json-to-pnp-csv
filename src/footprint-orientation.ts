import {
  cju,
  getPcbElementBounds,
  transformPCBElements,
} from "@tscircuit/circuit-json-util"
import type {
  AnyCircuitElement,
  PcbComponent,
  PcbPlatedHole,
  PcbSmtPad,
  Point,
} from "circuit-json"
import {
  applyToPoint,
  compose,
  rotateDEG,
  translate,
} from "transformation-matrix"

type Pad = PcbSmtPad | PcbPlatedHole

const numericHint = (hint: string) => /^\d+$/.test(hint)
const normalizeHint = (hint: string) =>
  hint
    .trim()
    .toLowerCase()
    .replace(/^pin(?=\d+$)/, "")
const getCenter = (pad: Pad): Point | null => {
  if (pad.type !== "pcb_smtpad" || pad.shape !== "polygon") {
    return { x: pad.x, y: pad.y }
  }
  const bounds = getPcbElementBounds(pad)
  return bounds
    ? { x: (bounds.minX + bounds.maxX) / 2, y: (bounds.minY + bounds.maxY) / 2 }
    : null
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
  const boardToLocal = compose(
    rotateDEG(-component.rotation),
    translate(-component.center.x, -component.center.y),
  )
  // The shared transformer mutates its input. The pads here are export copies.
  return transformPCBElements(
    structuredClone(getPads(json, component.pcb_component_id)),
    boardToLocal,
  ) as Pad[]
}

// Source-port aliases survive imports that renumber electrical pads (e.g. USB-C
// A1B12/GND1). Only unique aliases can establish a pad correspondence.
const getLabeledPads = (
  json: AnyCircuitElement[],
  component: PcbComponent | undefined,
  pads: Pad[],
) => {
  const db = cju([...json])
  const ports = component
    ? db.source_port.list({
        source_component_id: component.source_component_id,
      })
    : []
  return pads.map((pad) => {
    const hints = (pad.port_hints ?? []).map(normalizeHint)
    const sourceId = pad.pcb_port_id
      ? db.pcb_port.get(pad.pcb_port_id)?.source_port_id
      : undefined
    const candidates = ports.filter((port) =>
      [port.name, String(port.pin_number), ...(port.port_hints ?? [])].some(
        (hint) => hints.includes(normalizeHint(hint)),
      ),
    )
    const port = sourceId
      ? db.source_port.get(sourceId)
      : candidates.length === 1
        ? candidates[0]
        : undefined
    return {
      center: getCenter(pad),
      hints: new Set([
        ...hints,
        ...(port && port.source_component_id === component?.source_component_id
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
    const matches: { local: Point; supplier: Point }[] = []
    for (const [i, j] of pairs) {
      const localCenter = local[i]!.center
      const supplierCenter = supplier[j]!.center
      if (!localCenter || !supplierCenter) return null
      matches.push({ local: localCenter, supplier: supplierCenter })
    }
    const centroid = (side: "local" | "supplier"): Point => ({
      x: matches.reduce((sum, m) => sum + m[side].x, 0) / matches.length,
      y: matches.reduce((sum, m) => sum + m[side].y, 0) / matches.length,
    })
    const localCenter = centroid("local")
    const supplierCenter = centroid("supplier")
    // Allow ten micrometres of coordinate rounding in imported CAD.
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
      const supplierToLocal = compose(
        translate(localCenter.x, localCenter.y),
        rotateDEG(degrees),
        translate(-supplierCenter.x, -supplierCenter.y),
      )
      return matches.every(({ local, supplier }) => {
        const rotated = applyToPoint(supplierToLocal, supplier)
        return Math.hypot(rotated.x - local.x, rotated.y - local.y) <= tolerance
      })
    })
    // Once there are two matching semantic anchors, do not fall back to
    // numeric indices if their positions disagree.
    return candidates.length === 1 ? candidates[0]! : null
  }
  return null
}
