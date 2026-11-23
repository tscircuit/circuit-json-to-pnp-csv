import type { AnyCircuitElement } from "circuit-json"

export const sampleSoup: AnyCircuitElement[] = [
  {
    type: "source_component",
    ftype: "simple_resistor",
    source_component_id: "source_component_1",
    name: "R1",
    resistance: 100,
  },
  {
    type: "pcb_component",
    pcb_component_id: "pcb_component_1",
    center: { x: 10, y: 20 },
    layer: "top",
    rotation: 0,
    width: 5,
    height: 2,
    source_component_id: "source_component_1",
    obstructs_within_bounds: true,
  },
  {
    type: "source_component",
    ftype: "simple_capacitor",
    source_component_id: "source_component_2",
    name: "C1",
    capacitance: 100,
  },
  {
    type: "pcb_component",
    pcb_component_id: "pcb_component_2",
    center: { x: 30, y: 40 },
    layer: "bottom",
    rotation: 90,
    width: 3,
    height: 3,
    source_component_id: "source_component_2",
    obstructs_within_bounds: true,
  },
]
