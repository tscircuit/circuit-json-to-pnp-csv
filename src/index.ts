import {
  pcb_component,
  type AnyCircuitElement,
  type LayerRef,
} from "circuit-json"
import Papa from "papaparse"
import { su } from "@tscircuit/soup-util"

interface PickAndPlaceRow {
  designator: string
  mid_x: number
  mid_y: number
  layer: LayerRef
  rotation: number
}

const fixedDecimals = 7

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
      rows.push({
        designator: source_component?.name ?? element.pcb_component_id,
        mid_x: element.center.x.toFixed(fixedDecimals),
        mid_y: (element.center.y * (opts.flip_y_axis ? -1 : 1)).toFixed(fixedDecimals),
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
      "Mid X": row.mid_x,
      "Mid Y": row.mid_y,
      Layer: row.layer,
      Rotation: row.rotation,
    })),
  )
