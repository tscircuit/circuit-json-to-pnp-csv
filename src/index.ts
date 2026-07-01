import { type AnyCircuitElement, type LayerRef } from "circuit-json"
import Papa from "papaparse"
import { su } from "@tscircuit/soup-util"

interface PickAndPlaceRow {
  designator: string
  mid_x: number
  mid_y: number
  layer: LayerRef
  rotation: number
}

const fixedDecimals = 3

const NON_PLACEABLE_FTYPES = new Set([
  "simple_net",
  "simple_ground",
  "simple_power",
])

function isPlaceableComponent(
  source: { name?: string; ftype?: string; footprint?: string },
  pcbComponentId: string,
): boolean {
  if (NON_PLACEABLE_FTYPES.has(source.ftype ?? "")) return false

  const name = source.name ?? pcbComponentId
  if (/^pcb_component_\d+$/.test(name)) return false

  const hasMeaningfulName =
    !!source.name && !source.name.startsWith("pcb_component_")
  const hasFtype = !!source.ftype
  const hasFootprint = !!source.footprint

  if (!hasMeaningfulName && !hasFtype && !hasFootprint) return false

  return true
}

export const convertCircuitJsonToPickAndPlaceRows = (
  circuitJson: AnyCircuitElement[],
  opts: { flip_y_axis?: boolean } = {},
): PickAndPlaceRow[] => {
  opts.flip_y_axis ??= false

  const rows: PickAndPlaceRow[] = []
  for (const element of circuitJson) {
    if (element.type === "pcb_component") {
      const source_component = su(circuitJson).source_component.get(
        element.source_component_id,
      )
      if (!source_component) continue
      if (
        !isPlaceableComponent(source_component as any, element.pcb_component_id)
      )
        continue

      rows.push({
        designator: source_component?.name ?? element.pcb_component_id,
        mid_x: element.center.x,
        mid_y: element.center.y * (opts.flip_y_axis ? -1 : 1),
        layer: element.layer,
        rotation: element.rotation,
      })
    }
  }
  return rows
}

export const convertCircuitJsonToPickAndPlaceCsv = (
  circuitJson: AnyCircuitElement[],
): string =>
  Papa.unparse(
    convertCircuitJsonToPickAndPlaceRows(circuitJson).map((row) => ({
      Designator: row.designator,
      "Mid X": row.mid_x.toFixed(fixedDecimals),
      "Mid Y": row.mid_y.toFixed(fixedDecimals),
      Layer: row.layer,
      Rotation: row.rotation,
    })),
  )
