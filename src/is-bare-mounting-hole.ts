import type {
  AnyCircuitElement,
  PcbComponent,
  SourceComponentBase,
} from "circuit-json"

export const isBareMountingHole = (
  circuitJson: AnyCircuitElement[],
  source: SourceComponentBase,
  pcb: PcbComponent,
): boolean => {
  if (source.ftype !== "simple_chip") return false
  if (source.manufacturer_part_number?.trim()) return false
  if (
    Object.values(source.supplier_part_numbers ?? {}).some((numbers) =>
      numbers?.some((number) => number.trim()),
    )
  )
    return false

  if (
    circuitJson.some(
      (element) =>
        element.type === "cad_component" &&
        (element.pcb_component_id
          ? element.pcb_component_id === pcb.pcb_component_id
          : element.source_component_id === source.source_component_id) &&
        Boolean(
          element.model_obj_url?.trim() ||
            element.model_stl_url?.trim() ||
            element.model_3mf_url?.trim() ||
            element.model_gltf_url?.trim() ||
            element.model_glb_url?.trim() ||
            element.model_step_url?.trim() ||
            element.model_wrl_url?.trim() ||
            element.model_asset?.url?.trim() ||
            element.model_asset?.project_relative_path?.trim() ||
            element.model_jscad,
        ),
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
  return (
    geometry.length === 1 &&
    (geometry[0].type === "pcb_plated_hole" || geometry[0].type === "pcb_hole")
  )
}
