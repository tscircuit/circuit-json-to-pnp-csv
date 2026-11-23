import { expect, test } from "bun:test"
import type { AnyCircuitElement } from "circuit-json"
import { convertCircuitJsonToPickAndPlaceCsv } from "../src"
import generatedCircuit from "./assets/real-supplier/generated-selected-parts.circuit.json"

test.failing(
  "exports the real supplier-selected Core board as the unchanged JLCPCB-verified CSV",
  async () => {
    const circuit = structuredClone(generatedCircuit) as AnyCircuitElement[]
    const original = structuredClone(circuit)
    for (const component of circuit.filter((e) => e.type === "pcb_component")) {
      // Real supplier responses provide CAD geometry, not factory offsets.
      expect(component).not.toHaveProperty(
        "supplier_assembly_rotation_offset_map",
      )
      expect(component.supplier_pin1_location_map?.jlcpcb).toBeTruthy()
    }
    const csv = convertCircuitJsonToPickAndPlaceCsv(circuit, {
      supplier: "jlcpcb",
      onRotationWarning: () => {},
    })
    expect(csv).toBe(
      await Bun.file(
        new URL("./assets/real-supplier/jlcpcb-verified.csv", import.meta.url),
      ).text(),
    )
    expect(circuit).toEqual(original)
  },
)
