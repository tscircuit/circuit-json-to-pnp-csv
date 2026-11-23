import { analyzePcbPin1Location } from "@tscircuit/circuit-json-util"
import {
  applyToPoint,
  compose,
  flipY,
  identity,
  inverse,
  rotate,
  translate,
} from "transformation-matrix"
import {
  type AnyCircuitElement,
  type PcbComponent,
  type PcbPin1Location,
  type SupplierName,
  getRotationBetweenPcbPin1Locations,
  pcb_pin1_location,
} from "circuit-json"
import {
  getSupplierAssemblyRotationOffset,
  type PcbComponentWithAssemblyRotation,
} from "./supplier-assembly-rotation"

/** Minimal parts-engine contract; compatible with a tscircuit platform config. */
export interface PartOrientationOptions {
  /** Restrict preparation to one supplier; otherwise process each supplier on the source component. */
  supplier?: SupplierName
  partsEngine?: {
    fetchPartCircuitJson?: (params: {
      supplierPartNumber?: string
      manufacturerPartNumber?: string
      platformFetch?: typeof fetch
    }) =>
      | AnyCircuitElement[]
      | undefined
      | Promise<AnyCircuitElement[] | undefined>
  }
  partsEngineDisabled?: boolean
  platformFetch?: typeof fetch
}

type SupplierOrientation = {
  cadPin1Location: PcbPin1Location | null
  assemblyOffset?: number
}

const fetchSupplierOrientation = async (
  { supplier, partNumber }: { supplier: SupplierName; partNumber: string },
  { partsEngine, platformFetch }: PartOrientationOptions,
): Promise<SupplierOrientation | undefined> => {
  const footprint = await partsEngine?.fetchPartCircuitJson?.({
    supplierPartNumber: partNumber,
    platformFetch,
  })
  if (!footprint?.length) return undefined
  return {
    cadPin1Location: analyzePcbPin1Location(footprint),
    assemblyOffset: getSupplierAssemblyRotationOffset(footprint, supplier),
  }
}

/** Recover the unrotated, top-facing footprint frame from board points (mm, +X right, +Y top). */
const getLocalPin1Location = (
  circuitJson: AnyCircuitElement[],
  component: PcbComponent,
): PcbPin1Location | null => {
  // Paired with Core's PrimitiveComponent._computePcbGlobalTransformBeforeLayout:
  // compose(parentTransform, flipY(), padTransform). Invert the placed side,
  // including native-bottom sources, rather than guessing an insertion flip.
  const boardToFootprint = inverse(
    compose(
      translate(component.center.x, component.center.y),
      rotate((component.rotation * Math.PI) / 180),
      component.layer === "bottom" ? flipY() : identity(),
    ),
  )
  const toLocal = (point: { x: number; y: number }) =>
    applyToPoint(boardToFootprint, point)
  const pads = circuitJson.flatMap<AnyCircuitElement>((element) => {
    if (
      (element.type !== "pcb_smtpad" && element.type !== "pcb_plated_hole") ||
      element.pcb_component_id !== component.pcb_component_id
    )
      return []
    if (element.type === "pcb_smtpad" && element.shape === "polygon") {
      return [{ ...element, points: element.points.map(toLocal) }]
    }
    return [{ ...element, ...toLocal(element) }]
  })
  return analyzePcbPin1Location(pads)
}

/**
 * Populate orientation metadata using the same parts-engine contract as core.
 * This also runs on prebuilt JSON, where the core render phases never execute.
 */
export const populatePartOrientationMetadata = async (
  circuitJson: AnyCircuitElement[],
  platform: PartOrientationOptions = {},
): Promise<AnyCircuitElement[]> => {
  const prepared = structuredClone(circuitJson)
  const sources = new Map(
    prepared.flatMap((element) =>
      element.type === "source_component"
        ? [[element.source_component_id, element] as const]
        : [],
    ),
  )
  const supplierOrientations = new Map<
    string,
    Promise<SupplierOrientation | undefined>
  >()
  const errors: string[] = []
  for (const element of prepared) {
    if (element.type !== "pcb_component" || element.do_not_place) continue
    const component: PcbComponentWithAssemblyRotation = element
    const source = sources.get(component.source_component_id)
    if (!source || source.ftype === "simple_test_point") continue
    const suppliers = platform.supplier
      ? [platform.supplier]
      : (Object.keys(source.supplier_part_numbers ?? {}) as SupplierName[])
    for (const supplier of suppliers) {
      // Match core: use the first candidate part number for each supplier.
      const partNumber = source.supplier_part_numbers?.[supplier]?.[0]
      if (!partNumber) continue
      const label = `${source.name} (${supplier}:${partNumber})`
      // pin1_location is derived metadata. Old Core versions could cache a
      // mirrored bottom frame; numbered physical pads are authoritative when
      // available. Retain explicit metadata for geometry we cannot analyze.
      const localLocation =
        getLocalPin1Location(prepared, component) ?? component.pin1_location
      if (localLocation) component.pin1_location = localLocation
      const localResult = pcb_pin1_location.safeParse(localLocation)
      if (!localResult.success) {
        errors.push(
          `${label}: cannot determine authored pin-1 orientation from numbered pads`,
        )
        continue
      }
      let supplierLocation = component.supplier_pin1_location_map?.[supplier]
      let assemblyOffset =
        component.supplier_assembly_rotation_offset_map?.[supplier]
      const partsEngine = platform.partsEngine
      const canFetch =
        !platform.partsEngineDisabled && partsEngine?.fetchPartCircuitJson
      if (!supplierLocation && !canFetch) {
        errors.push(
          `${label}: supplier pin-1 orientation is missing and the parts engine is disabled or unavailable`,
        )
        continue
      }
      if (
        canFetch &&
        (!supplierLocation ||
          (assemblyOffset === undefined && !source.are_pins_interchangeable))
      ) {
        try {
          const cacheKey = `${supplier}:${partNumber}`
          let pending = supplierOrientations.get(cacheKey)
          if (!pending) {
            pending = fetchSupplierOrientation(
              { supplier, partNumber },
              platform,
            )
            supplierOrientations.set(cacheKey, pending)
          }
          const catalogOrientation = await pending
          const catalogLocation = catalogOrientation?.cadPin1Location
          // An offset is defined relative to the exact catalog CAD frame.
          if (
            catalogLocation &&
            (!supplierLocation || supplierLocation === catalogLocation)
          ) {
            supplierLocation = catalogLocation
            assemblyOffset ??= catalogOrientation.assemblyOffset
          }
        } catch (error) {
          // An optional assembly lookup must not break an existing CAD export.
          if (!supplierLocation) {
            errors.push(
              `${label}: supplier orientation lookup failed: ${error instanceof Error ? error.message : String(error)}`,
            )
            continue
          }
        }
      }
      const supplierResult = pcb_pin1_location.safeParse(supplierLocation)
      if (!supplierResult.success) {
        errors.push(`${label}: cannot determine supplier pin-1 orientation`)
        continue
      }
      if (
        getRotationBetweenPcbPin1Locations(
          supplierResult.data,
          localResult.data,
        ) === null
      ) {
        errors.push(
          `${label}: authored and supplier pin-1 frames cannot be matched by rotation`,
        )
        continue
      }
      component.supplier_pin1_location_map = {
        ...component.supplier_pin1_location_map,
        [supplier]: supplierResult.data,
      }
      if (assemblyOffset !== undefined) {
        component.supplier_assembly_rotation_offset_map = {
          ...component.supplier_assembly_rotation_offset_map,
          [supplier]: assemblyOffset,
        }
      }
    }
  }
  if (errors.length) {
    throw new Error(
      `Unverified supplier pick-and-place rotations:\n${errors.join("\n")}\nEnable the parts engine or provide the authored and supplier CAD pin-1 frames before export.`,
    )
  }
  return prepared
}
