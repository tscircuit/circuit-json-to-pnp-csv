import { analyzePcbPin1Location } from "@tscircuit/circuit-json-util"
import {
  type AnyCircuitElement,
  type PcbComponent,
  type PcbPin1Location,
  type SupplierName,
  getRotationBetweenPcbPin1Locations,
  pcb_pin1_location,
} from "circuit-json"

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

/** Recover the authored frame from placed pads without changing routed geometry. */
const getLocalPin1Location = (
  circuitJson: AnyCircuitElement[],
  component: PcbComponent,
): PcbPin1Location | null => {
  // Prebuilt JSON does not record the footprint's original layer. Without that
  // information we cannot safely undo mirroring for bottom-side components.
  if (component.layer !== "top") return null
  const radians = (-component.rotation * Math.PI) / 180
  const cos = Math.cos(radians)
  const sin = Math.sin(radians)
  const toLocal = (point: { x: number; y: number }) => {
    const x = point.x - component.center.x
    const y = point.y - component.center.y
    return { x: x * cos - y * sin, y: x * sin + y * cos }
  }
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
  const supplierLocations = new Map<string, Promise<PcbPin1Location | null>>()
  const errors: string[] = []
  for (const component of prepared) {
    if (component.type !== "pcb_component" || component.do_not_place) continue
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
      let localLocation = component.pin1_location
      if (!localLocation) {
        localLocation = getLocalPin1Location(prepared, component) ?? undefined
        if (localLocation) component.pin1_location = localLocation
      }
      const localResult = pcb_pin1_location.safeParse(localLocation)
      if (!localResult.success) {
        errors.push(
          `${label}: cannot determine authored pin-1 orientation${component.layer === "bottom" ? "; bottom-side JSON requires explicit pin1_location" : " from numbered pads"}`,
        )
        continue
      }
      let supplierLocation = component.supplier_pin1_location_map?.[supplier]
      if (!supplierLocation) {
        const partsEngine = platform.partsEngine
        if (
          platform.partsEngineDisabled ||
          !partsEngine?.fetchPartCircuitJson
        ) {
          errors.push(
            `${label}: supplier pin-1 orientation is missing and the parts engine is disabled or unavailable`,
          )
          continue
        }
        try {
          const cacheKey = `${supplier}:${partNumber}`
          let pending = supplierLocations.get(cacheKey)
          if (!pending) {
            pending = Promise.resolve()
              .then(() =>
                partsEngine.fetchPartCircuitJson!({
                  supplierPartNumber: partNumber,
                  platformFetch: platform.platformFetch,
                }),
              )
              .then((supplierJson) =>
                supplierJson?.length
                  ? analyzePcbPin1Location(supplierJson)
                  : null,
              )
            supplierLocations.set(cacheKey, pending)
          }
          supplierLocation = (await pending) ?? undefined
        } catch (error) {
          errors.push(
            `${label}: supplier orientation lookup failed: ${error instanceof Error ? error.message : String(error)}`,
          )
          continue
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
    }
  }
  if (errors.length) {
    throw new Error(
      `Unverified supplier pick-and-place rotations:\n${errors.join("\n")}\nEnable the parts engine or provide verified pin1_location and supplier_pin1_location_map entries before fabrication export.`,
    )
  }
  return prepared
}
