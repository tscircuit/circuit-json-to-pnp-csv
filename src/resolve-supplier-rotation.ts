import { analyzePcbPin1Location } from "@tscircuit/circuit-json-util"
import {
  type AnyCircuitElement,
  type PcbComponent,
  type SourceComponentBase,
  type SupplierName,
  getRotationBetweenPcbPin1Locations,
} from "circuit-json"
import {
  getLocalPads,
  getMatchedPadRotation,
  getPads,
} from "./footprint-orientation"
import type { PartOrientationOptions } from "./populate-part-orientation-metadata"

export interface SupplierPickAndPlaceOptions extends PartOrientationOptions {
  supplier: SupplierName
  flip_y_axis?: boolean
}

export interface Placement {
  component: PcbComponent
  source: SourceComponentBase
  designator: string
}

export const getStoredRotationAdjustment = (
  component: PcbComponent,
  supplier: SupplierName,
): number | null => {
  const local = component.pin1_location
  const supplied = component.supplier_pin1_location_map?.[supplier]
  return local && supplied
    ? getRotationBetweenPcbPin1Locations(supplied, local)
    : null
}

export const createSupplierRotationResolver = (
  circuitJson: AnyCircuitElement[],
  options: SupplierPickAndPlaceOptions,
) => {
  const { supplier } = options
  const footprints = new Map<string, Promise<AnyCircuitElement[] | undefined>>()

  return async ({ component, source }: Placement): Promise<number> => {
    const stored = getStoredRotationAdjustment(component, supplier)
    if (stored !== null) return stored

    // A saved bottom-side placement does not describe the original mirror.
    if (component.layer !== "top") {
      throw new Error(
        "bottom-side JSON requires verified authored and supplier orientation metadata",
      )
    }

    const localPads = getLocalPads(circuitJson, component)
    const local = analyzePcbPin1Location(localPads) ?? component.pin1_location
    const storedSupplier = component.supplier_pin1_location_map?.[supplier]
    if (local && storedSupplier) {
      const adjustment = getRotationBetweenPcbPin1Locations(
        storedSupplier,
        local,
      )
      if (adjustment !== null) return adjustment
    }

    const partNumber = source.supplier_part_numbers?.[supplier]?.[0]
    if (!partNumber) throw new Error(`missing ${supplier} part number`)
    const engine = options.partsEngine
    if (options.partsEngineDisabled || !engine?.fetchPartCircuitJson) {
      throw new Error(
        `supplier orientation is missing for ${partNumber} and the parts engine is unavailable`,
      )
    }

    let pending = footprints.get(partNumber)
    if (!pending) {
      pending = Promise.resolve().then(() =>
        engine.fetchPartCircuitJson!({
          supplierPartNumber: partNumber,
          platformFetch: options.platformFetch,
        }),
      )
      footprints.set(partNumber, pending)
    }

    const supplierJson = await pending
    if (!supplierJson?.length)
      throw new Error(`no supplier footprint for ${partNumber}`)
    const components = supplierJson.filter(
      (element) => element.type === "pcb_component",
    )
    const [supplierComponent] = components
    if (
      components.length > 1 ||
      (supplierComponent && supplierComponent.layer !== "top")
    ) {
      throw new Error(
        `expected one top-side supplier footprint for ${partNumber}`,
      )
    }

    const supplierPads = supplierComponent
      ? getLocalPads(supplierJson, supplierComponent)
      : getPads(supplierJson)
    if (
      !supplierPads.length ||
      supplierPads.some(
        (pad) => pad.type === "pcb_smtpad" && pad.layer !== "top",
      )
    ) {
      throw new Error(`expected top-side supplier pads for ${partNumber}`)
    }
    const supplied = analyzePcbPin1Location(supplierPads) ?? storedSupplier
    if (local && supplied) {
      const adjustment = getRotationBetweenPcbPin1Locations(supplied, local)
      if (adjustment !== null) return adjustment
    }

    const adjustment = getMatchedPadRotation(
      circuitJson,
      component,
      localPads,
      supplierJson,
      supplierComponent,
      supplierPads,
    )
    if (adjustment === null) {
      throw new Error(
        `cannot match authored and supplier pad orientation for ${partNumber}`,
      )
    }
    return adjustment
  }
}
