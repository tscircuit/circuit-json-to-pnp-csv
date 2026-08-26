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
  /**
   * How to handle missing or incompatible supplier orientation metadata.
   * Defaults to "warn": report the unchecked fallback and use the PCB rotation.
   * Use "error" to prevent exporting any unchecked supplier rotations.
   */
  unverified_rotation?: "warn" | "error"
  /** Receives warnings instead of console.warn, e.g. for display in an export UI. */
  onWarning?: (message: string) => void
}

const fixedDecimals = 3

const normalizeRotation = (rotation: number): number =>
  ((rotation % 360) + 360) % 360

const getPickAndPlaceRotation = (
  pcbComponent: PcbComponent,
  designator: string,
  opts: PickAndPlaceConversionOptions,
): number => {
  const { supplier } = opts
  if (!supplier) return pcbComponent.rotation

  const handleUnverifiedRotation = (reason: string): number => {
    const message =
      `Unverified pick-and-place rotation for ${designator} (${supplier}): ${reason}. ` +
      "Re-render with part orientation analysis enabled and a working supplier lookup; " +
      "if the package cannot be analyzed, verify its orientation manually before assembly."
    if (opts.unverified_rotation === "error") throw new Error(message)
    const warning = `${message} Falling back to raw PCB rotation ${pcbComponent.rotation} degrees, which may not match the supplier footprint.`
    if (opts.onWarning) opts.onWarning(warning)
    else console.warn(warning)
    return pcbComponent.rotation
  }

  if (!pcbComponent.pin1_location) {
    return handleUnverifiedRotation("missing pcb_component.pin1_location")
  }

  const supplierPin1Location =
    pcbComponent.supplier_pin1_location_map?.[supplier]
  if (!supplierPin1Location) {
    return handleUnverifiedRotation(
      `missing pcb_component.supplier_pin1_location_map.${supplier}`,
    )
  }

  const rotationAdjustment = getRotationBetweenPcbPin1Locations(
    supplierPin1Location,
    pcbComponent.pin1_location,
  )
  if (rotationAdjustment === null) {
    return handleUnverifiedRotation(
      `incompatible pin-1 frames (local: ${pcbComponent.pin1_location}, supplier: ${supplierPin1Location})`,
    )
  }

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
      if (source_component.ftype === "simple_test_point") continue

      rows.push({
        designator: source_component?.name ?? element.pcb_component_id,
        mid_x: element.center.x,
        mid_y: element.center.y * (opts.flip_y_axis ? -1 : 1),
        layer: element.layer,
        rotation: getPickAndPlaceRotation(
          element,
          source_component.name ?? element.pcb_component_id,
          opts,
        ),
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
