import { transformPCBElements } from "@tscircuit/circuit-json-util"
import type {
  AnyCircuitElement,
  PcbComponent,
  PcbPlatedHole,
  PcbSmtPad,
} from "circuit-json"
import { compose, rotateDEG, translate } from "transformation-matrix"

type Pad = PcbSmtPad | PcbPlatedHole

export const getPads = (json: AnyCircuitElement[], componentId?: string) =>
  json.filter(
    (e): e is Pad =>
      (e.type === "pcb_smtpad" || e.type === "pcb_plated_hole") &&
      (componentId === undefined || e.pcb_component_id === componentId),
  )

export const getLocalPads = (
  json: AnyCircuitElement[],
  component: PcbComponent,
): Pad[] => {
  const boardToLocal = compose(
    rotateDEG(-component.rotation),
    translate(-component.center.x, -component.center.y),
  )
  // The shared transformer mutates its input. The pads here are export copies.
  return transformPCBElements(
    structuredClone(getPads(json, component.pcb_component_id)),
    boardToLocal,
  ) as Pad[]
}
