import { cju } from "@tscircuit/circuit-json-util"
import {
  type AnyCircuitElement,
  type LayerRef,
  type PcbComponent,
  type SupplierName,
} from "circuit-json"
import Papa from "papaparse"
import { isBareMountingHole } from "./is-bare-mounting-hole"
import {
  createSupplierRotationResolver,
  getStoredRotationAdjustment,
  type Placement,
  type SupplierPickAndPlaceOptions,
} from "./resolve-supplier-rotation"

export interface PickAndPlaceRow {
  designator: string
  mid_x: number
  mid_y: number
  layer: LayerRef
  rotation: number
}

export interface PickAndPlaceRotationWarning {
  designator: string
  pcb_component_id: string
  supplier: SupplierName
  reason:
    | "missing_pin1_location"
    | "missing_supplier_pin1_location"
    | "incompatible_pin1_locations"
  message: string
}

export interface PickAndPlaceConversionOptions {
  flip_y_axis?: boolean
  /**
   * Adjust component rotations from the authored footprint's pin-1 frame to
   * the selected supplier footprint's pin-1 frame when both are available.
   */
  supplier?: SupplierName
  /**
   * Reject unresolved supplier rotations. Defaults to true for supplier exports.
   * Set false explicitly to retain warning-only fallback for unverified drafts.
   */
  requireSupplierRotation?: boolean
  /** Called for each unresolved rotation. Defaults to console.warn. */
  onRotationWarning?: (warning: PickAndPlaceRotationWarning) => void
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

  const unresolved = (
    reason: PickAndPlaceRotationWarning["reason"],
  ): number => {
    const message = `${designator}: cannot verify ${supplier} pick-and-place rotation (${reason}); PCB rotation ${pcbComponent.rotation} is unverified.`
    if (opts.requireSupplierRotation !== false) throw new Error(message)
    const warning = {
      designator,
      pcb_component_id: pcbComponent.pcb_component_id,
      supplier,
      reason,
      message,
    }
    if (opts.onRotationWarning) opts.onRotationWarning(warning)
    else console.warn(message)
    return pcbComponent.rotation
  }

  if (!pcbComponent.pin1_location) return unresolved("missing_pin1_location")
  const supplierPin1Location =
    pcbComponent.supplier_pin1_location_map?.[supplier]
  if (!supplierPin1Location) return unresolved("missing_supplier_pin1_location")

  const rotationAdjustment = getStoredRotationAdjustment(pcbComponent, supplier)
  if (rotationAdjustment === null)
    return unresolved("incompatible_pin1_locations")

  return normalizeRotation(pcbComponent.rotation + rotationAdjustment)
}

function* getPlacements(
  circuitJson: AnyCircuitElement[],
): Generator<Placement> {
  const { source_component } = cju([...circuitJson])
  for (const component of circuitJson) {
    if (component.type !== "pcb_component" || component.do_not_place) continue
    const source = source_component.get(component.source_component_id)
    if (!source || source.ftype === "simple_test_point") continue
    if (isBareMountingHole(circuitJson, source, component)) continue
    yield {
      component,
      source,
      designator: source.name ?? component.pcb_component_id,
    }
  }
}

const toRow = (
  { component, designator }: Placement,
  rotation: number,
  flipYAxis?: boolean,
): PickAndPlaceRow => {
  const position = component.footprint_origin ?? component.center
  return {
    designator,
    mid_x: position.x,
    mid_y: position.y * (flipYAxis ? -1 : 1),
    layer: component.layer,
    rotation,
  }
}

export const convertCircuitJsonToPickAndPlaceRows = (
  circuitJson: AnyCircuitElement[],
  opts: PickAndPlaceConversionOptions = {},
): PickAndPlaceRow[] => {
  if (opts.requireSupplierRotation && !opts.supplier) {
    throw new Error("requireSupplierRotation requires a supplier")
  }

  return Array.from(getPlacements(circuitJson), (placement) =>
    toRow(
      placement,
      getPickAndPlaceRotation(placement.component, placement.designator, opts),
      opts.flip_y_axis,
    ),
  )
}

const rowsToCsv = (rows: PickAndPlaceRow[]): string =>
  Papa.unparse(
    rows.map((row) => ({
      Designator: row.designator,
      "Mid X": row.mid_x.toFixed(fixedDecimals),
      "Mid Y": row.mid_y.toFixed(fixedDecimals),
      Layer: row.layer,
      Rotation: row.rotation,
    })),
  )

export const convertCircuitJsonToPickAndPlaceCsv = (
  circuitJson: AnyCircuitElement[],
  opts: PickAndPlaceConversionOptions = {},
): string => rowsToCsv(convertCircuitJsonToPickAndPlaceRows(circuitJson, opts))

/** Resolve missing supplier rotations and export all fitted components. */
export const convertCircuitJsonToSupplierPickAndPlaceCsv = async (
  circuitJson: AnyCircuitElement[],
  opts: SupplierPickAndPlaceOptions,
): Promise<string> => {
  if (!opts.supplier)
    throw new Error("Supplier placement export requires a supplier")
  const placements = Array.from(getPlacements(circuitJson))
  const resolveRotation = createSupplierRotationResolver(circuitJson, opts)
  const rows: PickAndPlaceRow[] = new Array(placements.length)
  const errors: string[] = new Array(placements.length)
  let next = 0

  const worker = async () => {
    while (next < placements.length) {
      const index = next++
      const placement = placements[index]!
      try {
        const adjustment = await resolveRotation(placement)
        rows[index] = toRow(
          placement,
          normalizeRotation(placement.component.rotation + adjustment),
          opts.flip_y_axis,
        )
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        errors[index] = `${placement.designator}: ${message}`
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(4, placements.length) }, worker),
  )
  const failures = errors.filter(Boolean)
  if (failures.length) {
    throw new Error(
      `Unverified supplier pick-and-place rotations:\n${failures.join("\n")}`,
    )
  }
  return rowsToCsv(rows)
}

export type { SupplierPickAndPlaceOptions }

export {
  populatePartOrientationMetadata,
  type PartOrientationOptions,
} from "./populate-part-orientation-metadata"
