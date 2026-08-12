import { su } from "@tscircuit/soup-util"
import {
  type AnyCircuitElement,
  type LayerRef,
  type PcbComponent,
  type SupplierName,
  getRotationBetweenPcbPin1Locations,
} from "circuit-json"
import Papa from "papaparse"

export interface PickAndPlaceRow {
  designator: string
  mid_x: number
  mid_y: number
  layer: LayerRef
  rotation: number
}

export interface PickAndPlaceConversionOptions {
  flip_y_axis?: boolean
  /**
   * Adjust component rotations from the authored footprint's pin-1 frame to
   * the selected supplier footprint's pin-1 frame when both are available.
   */
  supplier?: SupplierName
}

const fixedDecimals = 3

const normalizeRotation = (rotation: number): number =>
  ((rotation % 360) + 360) % 360

const getPickAndPlaceRotation = (
  pcbComponent: PcbComponent,
  supplier?: SupplierName,
): number => {
  if (!supplier || !pcbComponent.pin1_location) return pcbComponent.rotation

  const supplierPin1Location =
    pcbComponent.supplier_pin1_location_map?.[supplier]
  if (!supplierPin1Location) return pcbComponent.rotation

  const rotationAdjustment = getRotationBetweenPcbPin1Locations(
    supplierPin1Location,
    pcbComponent.pin1_location,
  )
  if (rotationAdjustment === null) return pcbComponent.rotation

  return normalizeRotation(pcbComponent.rotation + rotationAdjustment)
}

export const convertCircuitJsonToPickAndPlaceRows = (
  circuitJson: AnyCircuitElement[],
  opts: PickAndPlaceConversionOptions = {},
): PickAndPlaceRow[] => {
  const rows: PickAndPlaceRow[] = []
  for (const element of circuitJson) {
    if (element.type === "pcb_component") {
      if (element.do_not_place) continue

      const source_component = su(circuitJson).source_component.get(
        element.source_component_id,
      )
      if (!source_component) continue

      rows.push({
        designator: source_component?.name ?? element.pcb_component_id,
        mid_x: element.center.x,
        mid_y: element.center.y * (opts.flip_y_axis ? -1 : 1),
        layer: element.layer,
        rotation: getPickAndPlaceRotation(element, opts.supplier),
      })
    }
  }
  return rows
}

export const convertCircuitJsonToPickAndPlaceCsv = (
  circuitJson: AnyCircuitElement[],
  opts: PickAndPlaceConversionOptions = {},
): string =>
  Papa.unparse(
    convertCircuitJsonToPickAndPlaceRows(circuitJson, opts).map((row) => ({
      Designator: row.designator,
      "Mid X": row.mid_x.toFixed(fixedDecimals),
      "Mid Y": row.mid_y.toFixed(fixedDecimals),
      Layer: row.layer,
      Rotation: row.rotation,
    })),
  )
