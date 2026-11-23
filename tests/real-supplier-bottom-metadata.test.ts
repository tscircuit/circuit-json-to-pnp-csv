import { expect, test } from "bun:test"
import type { AnyCircuitElement } from "circuit-json"
import { populatePartOrientationMetadata } from "../src"
import placedParts from "./assets/real-supplier/placed-bottom-sot23.circuit.json"
import supplierFootprint from "./assets/real-supplier/C916374.circuit.json"

test("prepares bottom-side supplier metadata from real numbered pads without angle overrides", async () => {
  // Placed geometry is unchanged from issue 41. Only the actual BOM selection
  // is supplied; authored/supplier frames and assembly offsets are not set.
  const input = structuredClone(placedParts) as AnyCircuitElement[]
  const original = structuredClone(input)
  const requests: string[] = []
  const prepared = await populatePartOrientationMetadata(input, {
    supplier: "jlcpcb",
    partsEngine: {
      fetchPartCircuitJson: ({ supplierPartNumber }) => {
        requests.push(supplierPartNumber!)
        return supplierFootprint as AnyCircuitElement[]
      },
    },
  })
  expect(input).toEqual(original)
  expect(requests).toEqual(["C916374"])
  for (const pcb of prepared.filter((e) => e.type === "pcb_component")) {
    expect(pcb.pin1_location).toBe("leftside_top")
    expect(pcb.supplier_pin1_location_map).toEqual({
      jlcpcb: "rightside_bottom",
    })
    expect(pcb).not.toHaveProperty("supplier_assembly_rotation_offset_map")
  }
})
