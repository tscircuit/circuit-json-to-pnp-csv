import type {
  AnyCircuitElement,
  PcbComponent,
  SupplierName,
} from "circuit-json"

/** Optional Circuit JSON field; also accept JSON built with older peers. */
export type PcbComponentWithAssemblyRotation = PcbComponent & {
  supplier_assembly_rotation_offset_map?: Partial<Record<SupplierName, number>>
}

/** Read the assembly zero supplied with the catalog footprint, without inferring it from CAD. */
export const getSupplierAssemblyRotationOffset = (
  supplierFootprint: AnyCircuitElement[],
  supplier: SupplierName,
): number | undefined => {
  const footprint: PcbComponentWithAssemblyRotation | undefined =
    supplierFootprint.find((element) => element.type === "pcb_component")
  const offset = footprint?.supplier_assembly_rotation_offset_map?.[supplier]
  return offset !== undefined && Number.isFinite(offset) ? offset : undefined
}
