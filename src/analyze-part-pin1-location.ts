import {
  type PcbPin1LocationElement,
  analyzePcbPin1Location,
} from "@tscircuit/circuit-json-util"
import type { PcbPin1Location } from "circuit-json"

/** Extend the shared analyzer's two-pin convention to a numbered single row. */
export const analyzePartPin1Location = (
  elements: readonly PcbPin1LocationElement[],
): PcbPin1Location | null => {
  const location = analyzePcbPin1Location(elements)
  if (location) return location

  const pads = elements.filter(
    (e) => e.type === "pcb_smtpad" || e.type === "pcb_plated_hole",
  )
  if (pads.length < 3) return null
  const numbered = pads
    .map((pad) => {
      const numbers = new Set(
        (pad.port_hints ?? []).flatMap((hint) => {
          const match = String(hint)
            .trim()
            .match(/^(?:pin)?(\d+)$/i)
          return match ? [Number(match[1])] : []
        }),
      )
      const points = pad.points ?? []
      const x =
        pad.x ??
        (Math.min(...points.map((p) => p.x)) +
          Math.max(...points.map((p) => p.x))) /
          2
      const y =
        pad.y ??
        (Math.min(...points.map((p) => p.y)) +
          Math.max(...points.map((p) => p.y))) /
          2
      return {
        pad,
        pin: numbers.size === 1 ? [...numbers][0]! : Number.NaN,
        x,
        y,
      }
    })
    .sort((a, b) => a.pin - b.pin)

  // Missing/duplicate pin numbers, coincident pads and nonmonotonic numbering
  // are not enough evidence to infer the orientation of a keyed connector.
  if (
    numbered.some(
      (p, i) =>
        p.pin !== i + 1 || !Number.isFinite(p.x) || !Number.isFinite(p.y),
    )
  )
    return null
  const first = numbered[0]!
  const last = numbered[numbered.length - 1]!
  const dx = last.x - first.x
  const dy = last.y - first.y
  const tolerance = Math.max(Math.abs(dx), Math.abs(dy), 1) * 1e-6
  const horizontal = Math.abs(dy) <= tolerance && Math.abs(dx) > tolerance
  const vertical = Math.abs(dx) <= tolerance && Math.abs(dy) > tolerance
  if (!horizontal && !vertical) return null
  for (let i = 1; i < numbered.length; i++) {
    const current = numbered[i]!
    const previous = numbered[i - 1]!
    if (horizontal) {
      if (
        Math.abs(current.y - first.y) > tolerance ||
        (current.x - previous.x) * Math.sign(dx) <= tolerance
      )
        return null
    } else if (
      Math.abs(current.x - first.x) > tolerance ||
      (current.y - previous.y) * Math.sign(dy) <= tolerance
    )
      return null
  }
  // A single row has no top/bottom distinction. Reuse the canonical pin-1 to
  // pin-2 direction already used for two-pad footprints on both sides of the
  // authored/supplier comparison; do not derive PnP angles from CAD models.
  return analyzePcbPin1Location([first.pad, numbered[1]!.pad])
}
