import type {
  AnyCircuitElement,
  PcbComponent,
  SourceComponentBase,
} from "circuit-json"

/** Recognize legacy bare mounting-hole chips without hiding assigned hardware. */
export const isBareMountingHole = (
  circuitJson: AnyCircuitElement[],
  source: SourceComponentBase,
  pcb: PcbComponent,
): boolean => {
  if (
    source.ftype !== "simple_chip" ||
    !/^MH\d+$/i.test(source.name?.trim() ?? "")
  )
    return false
  if (source.manufacturer_part_number?.trim()) return false
  if (
    Object.values(source.supplier_part_numbers ?? {}).some((numbers) =>
      numbers?.some((number) => number.trim()),
    )
  )
    return false

  // An authored physical model can represent a real screw, terminal or insert.
  if (
    circuitJson.some(
      (element) =>
        element.type === "cad_component" &&
        element.pcb_component_id === pcb.pcb_component_id &&
        (element.model_obj_url ||
          element.model_stl_url ||
          element.model_3mf_url ||
          element.model_gltf_url ||
          element.model_glb_url ||
          element.model_step_url ||
          element.model_wrl_url ||
          element.model_jscad),
    )
  )
    return false

  const geometry = circuitJson.filter(
    (element) =>
      (element.type === "pcb_plated_hole" ||
        element.type === "pcb_hole" ||
        element.type === "pcb_smtpad") &&
      element.pcb_component_id === pcb.pcb_component_id,
  )
  // A name or missing supplier number alone is not enough: preserve connectors,
  // multi-pin footprints and ordinary chips without supplier metadata.
  return (
    geometry.length === 1 &&
    (geometry[0].type === "pcb_plated_hole" || geometry[0].type === "pcb_hole")
  )
}
