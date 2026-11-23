import type { AnyCircuitElement, PcbComponent } from "circuit-json"
import recordedCircuit from "../assets/bottom-side-rotation.circuit.json"

// Geometry/identity records extracted without coordinate changes from the
// reporter's output/circuit.json in the attachment to:
// https://github.com/tscircuit/circuit-json-to-pnp-csv/issues/41
export const fixture = recordedCircuit as AnyCircuitElement[]

export const circuit = (
  overrides: Partial<PcbComponent> = {},
): AnyCircuitElement[] => [
  {
    type: "source_component",
    source_component_id: "source",
    ftype: "simple_chip",
    name: "U1",
  },
  {
    type: "pcb_component",
    pcb_component_id: "pcb",
    source_component_id: "source",
    center: { x: 12, y: -4 },
    footprint_origin: { x: 12.5, y: -4.25 },
    width: 3,
    height: 2,
    layer: "bottom",
    rotation: 90,
    obstructs_within_bounds: true,
    ...overrides,
  },
]
