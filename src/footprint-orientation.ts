import type { AnyCircuitElement, PcbComponent } from "circuit-json"

type Point = { x: number; y: number }
type Pad = Extract<
  AnyCircuitElement,
  { type: "pcb_smtpad" | "pcb_plated_hole" }
>
type PadMatch = { local: Point; supplier: Point }

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
    const names = port
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

const findRotation = (
  matches: PadMatch[],
  verifyFootprint?: (transform: (point: Point) => Point) => boolean,
): number | null | undefined => {
  const centroid = (side: keyof PadMatch): Point => ({
    x: matches.reduce((sum, m) => sum + m[side].x, 0) / matches.length,
    y: matches.reduce((sum, m) => sum + m[side].y, 0) / matches.length,
  })
  const localCenter = centroid("local")
  const supplierCenter = centroid("supplier")
  if (
    !matches.some((match) => distance(match.local, localCenter) > tolerance * 2)
  )
    return undefined

  const candidates = [0, 90, 180, 270].filter((degrees) => {
    const radians = (degrees * Math.PI) / 180
    const cos = Math.cos(radians)
    const sin = Math.sin(radians)
    const transform = (point: Point): Point => {
      const x = point.x - supplierCenter.x
      const y = point.y - supplierCenter.y
      return {
        x: x * cos - y * sin + localCenter.x,
        y: x * sin + y * cos + localCenter.y,
      }
    }
    return (
      matches.every(
        (m) => distance(m.local, transform(m.supplier)) <= tolerance,
      ) &&
      (verifyFootprint?.(transform) ?? true)
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
    if (pairs.size < 2) continue
    const matches = [...pairs].map(([i, j]) => ({
      local: local[i]!.center,
      supplier: supplier[j]!.center,
    }))
    const rotation = findRotation(matches)
    // Once there are two matching semantic anchors, do not fall back to
    // numeric indices if their positions disagree.
    if (rotation !== undefined) return rotation
  }
  return null
}

const getNamedSmtPads = (pads: LabeledPad[]) => {
  const named = new Map<string, Point>()
  for (const pad of pads) {
    if (pad.type !== "pcb_smtpad") continue
    if (!pad.contactName || named.has(pad.contactName)) return null
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

  return (
    findRotation(matches, (transform) => {
      const remaining = supplier.map((pad) => ({
        type: pad.type,
        center: transform(pad.center),
      }))
      return local.every((pad) => {
        const index = remaining.findIndex(
          (other) =>
            other.type === pad.type &&
            distance(other.center, pad.center) <= tolerance,
        )
        if (index === -1) return false
        remaining.splice(index, 1)
        return true
      })
    }) ?? null
  )
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
