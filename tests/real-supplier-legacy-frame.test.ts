import { expect, test } from "bun:test"
import type { AnyCircuitElement } from "circuit-json"
import { populatePartOrientationMetadata } from "../src"
import legacyParts from "./assets/real-supplier/placed-bottom-sot23-with-legacy-frame.circuit.json"
import supplierFootprint from "./assets/real-supplier/C916374.circuit.json"

test("refreshes stale derived authored frames from unchanged numbered pads", async () => {
  // These pin1_location values are copied unchanged from the issue attachment;
  // U3's old Core-derived frame is wrong even though its pads are correct.
  const input = structuredClone(legacyParts) as AnyCircuitElement[]
  const original = structuredClone(input)
  const prepared = await populatePartOrientationMetadata(input, {
    supplier: "jlcpcb",
    partsEngine: {
      fetchPartCircuitJson: () => supplierFootprint as AnyCircuitElement[],
    },
  })
  for (const component of prepared.filter((e) => e.type === "pcb_component")) {
    expect(component.pin1_location).toBe("leftside_top")
    expect(component.supplier_pin1_location_map).toEqual({
      jlcpcb: "rightside_bottom",
    })
    expect(component).not.toHaveProperty(
      "supplier_assembly_rotation_offset_map",
    )
  }
  expect(input).toEqual(original)
})
