import { analyzePcbPin1Location, cju } from "@tscircuit/circuit-json-util"
import {
  type AnyCircuitElement,
  type PcbPin1Location,
  type SupplierName,
  getRotationBetweenPcbPin1Locations,
  pcb_pin1_location,
} from "circuit-json"
import { getLocalPads } from "./footprint-orientation"

import {
  createSupplierFootprintLookup,
  type PartOrientationOptions,
} from "./supplier-footprints"

export type { PartOrientationOptions } from "./supplier-footprints"

/**
 * Populate orientation metadata using the same parts-engine contract as core.
 * This also runs on prebuilt JSON, where the core render phases never execute.
 */
export const populatePartOrientationMetadata = async (
  circuitJson: AnyCircuitElement[],
  platform: PartOrientationOptions = {},
): Promise<AnyCircuitElement[]> => {
  const prepared = structuredClone(circuitJson)
  const { source_component } = cju([...prepared])
  const fetchFootprint = createSupplierFootprintLookup(platform)
  const supplierLocations = new Map<string, PcbPin1Location | null>()
  const errors: string[] = []
  for (const component of prepared) {
    if (component.type !== "pcb_component" || component.do_not_place) continue
    const source = source_component.get(component.source_component_id)
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
        // Prebuilt JSON does not record the original footprint layer for
        // safely undoing mirroring on the bottom side.
        if (component.layer === "top")
          localLocation =
            analyzePcbPin1Location(getLocalPads(prepared, component)) ??
            undefined
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
        if (!fetchFootprint) {
          errors.push(
            `${label}: supplier pin-1 orientation is missing and the parts engine is disabled or unavailable`,
          )
          continue
        }
        try {
          const cacheKey = `${supplier}:${partNumber}`
          if (!supplierLocations.has(cacheKey)) {
            const supplierJson = await fetchFootprint(supplier, partNumber)
            supplierLocations.set(
              cacheKey,
              supplierJson?.length
                ? analyzePcbPin1Location(supplierJson)
                : null,
            )
          }
          supplierLocation = supplierLocations.get(cacheKey) ?? undefined
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
