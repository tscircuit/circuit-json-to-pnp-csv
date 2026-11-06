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
type PadMatch = { local: Point; supplier: Point }

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
    const names =
      port && port.source_component_id === component?.source_component_id
        ? [port.name, ...(port.port_hints ?? [])].map(normalizeHint)
        : []
    return {
      type: pad.type,
      center: getCenter(pad),
      contactName: names.find((name) => name && !numericHint(name)),
      hints: new Set([...hints, ...names]),
    }
  })
}

type LabeledPad = ReturnType<typeof getLabeledPads>[number]

// Imported CAD rounds coordinates. Ten micrometres permits that rounding
// while rejecting reflections, wrong pin maps and different pad pitches.
const tolerance = 0.01
const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y)

const matchesPadCenters = (
  local: LabeledPad[],
  supplier: LabeledPad[],
  transform: (point: Point) => Point,
): boolean => {
  if (local.length !== supplier.length) return false
  const remaining = supplier.map((pad) => ({
    type: pad.type,
    center: pad.center && transform(pad.center),
  }))
  return local.every((pad) => {
    const center = pad.center
    if (!center) return false
    const index = remaining.findIndex(
      (other) =>
        other.type === pad.type &&
        other.center &&
        distance(other.center, center) <= tolerance,
    )
    if (index === -1) return false
    remaining.splice(index, 1)
    return true
  })
}

const findRotation = (
  matches: PadMatch[],
  local: LabeledPad[],
  supplier: LabeledPad[],
): number | null => {
  if (matches.length < 2) return null
  const centroid = (side: keyof PadMatch): Point => ({
    x: matches.reduce((sum, m) => sum + m[side].x, 0) / matches.length,
    y: matches.reduce((sum, m) => sum + m[side].y, 0) / matches.length,
  })
  const localCenter = centroid("local")
  const supplierCenter = centroid("supplier")
  if (
    !matches.some((match) => distance(match.local, localCenter) > tolerance * 2)
  )
    return null

  const candidates = [0, 90, 180, 270].filter((degrees) => {
    const supplierToLocal = compose(
      translate(localCenter.x, localCenter.y),
      rotateDEG(degrees),
      translate(-supplierCenter.x, -supplierCenter.y),
    )
    const transform = (point: Point) => applyToPoint(supplierToLocal, point)
    return (
      matches.every(
        (m) => distance(m.local, transform(m.supplier)) <= tolerance,
      ) && matchesPadCenters(local, supplier, transform)
    )
  })
  return candidates.length === 1 ? candidates[0]! : null
}

const getAliasRotation = (local: LabeledPad[], supplier: LabeledPad[]) => {
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
    if (semantic && pairs.size === 0) continue
    // Named SMT contacts establish electrical identity. For numbered-only
    // and through-hole-only footprints, require a label match for every pad.
    const hasSmtPads = local.some((pad) => pad.type === "pcb_smtpad")
    const requiresLabel = (pad: LabeledPad) =>
      !semantic || !hasSmtPads || pad.type === "pcb_smtpad"
    if (
      local.some((pad, index) => requiresLabel(pad) && !pairs.has(index)) ||
      supplier.some((pad, index) => requiresLabel(pad) && !reverse.has(index))
    )
      return null
    const matches: PadMatch[] = []
    for (const [i, j] of pairs) {
      if (local[i]!.type !== supplier[j]!.type) return null
      const localCenter = local[i]!.center
      const supplierCenter = supplier[j]!.center
      if (!localCenter || !supplierCenter) return null
      matches.push({ local: localCenter, supplier: supplierCenter })
    }
    return findRotation(matches, local, supplier)
  }
  return null
}

const getNamedSmtPads = (pads: LabeledPad[]) => {
  const named = new Map<string, Point>()
  for (const pad of pads) {
    if (pad.type !== "pcb_smtpad") continue
    if (!pad.center || !pad.contactName || named.has(pad.contactName))
      return null
    named.set(pad.contactName, pad.center)
  }
  return named
}

const getCompleteFootprintRotation = (
  local: LabeledPad[],
  supplier: LabeledPad[],
): number | null => {
  if (local.length !== supplier.length) return null
  const localContacts = getNamedSmtPads(local)
  const supplierContacts = getNamedSmtPads(supplier)
  if (
    !localContacts ||
    !supplierContacts ||
    localContacts.size < 2 ||
    localContacts.size !== supplierContacts.size
  )
    return null

  // Prefer the physical contact names over secondary aliases only when all
  // SMT contacts match and the same transform fits every pad, including slots.
  const matches: PadMatch[] = []
  for (const [name, localPoint] of localContacts) {
    const supplierPoint = supplierContacts.get(name)
    if (!supplierPoint) return null
    matches.push({ local: localPoint, supplier: supplierPoint })
  }

  return findRotation(matches, local, supplier)
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
  return (
    getAliasRotation(local, supplier) ??
    getCompleteFootprintRotation(local, supplier)
  )
}
