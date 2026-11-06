import { expect, test } from "bun:test"
import type { AnyCircuitElement } from "circuit-json"
import {
  convertCircuitJsonToPickAndPlaceCsv,
  convertCircuitJsonToSupplierPickAndPlaceCsv,
} from "../src"
import supplier from "./assets/c165948-supplier.circuit.json"
import board from "./assets/rp2040-usb-c-connectors.circuit.json"

// v1.0.51 of imrishabh18/rp2040-motor-controller, reduced to the two
// connectors and their pads/ports. C165948 comes from the JLCPCB parts engine.
test("exports supplier rotations for the RP2040 board's renumbered USB-C pads", async () => {
  const circuit = board as AnyCircuitElement[]
  expect(() =>
    convertCircuitJsonToPickAndPlaceCsv(circuit, { supplier: "jlcpcb" }),
  ).toThrow(
    "J_USB: cannot verify jlcpcb pick-and-place rotation (missing_pin1_location)",
  )

  const csv = await convertCircuitJsonToSupplierPickAndPlaceCsv(circuit, {
    supplier: "jlcpcb",
    partsEngine: {
      fetchPartCircuitJson: async ({ supplierPartNumber }) => {
        expect(supplierPartNumber).toBe("C165948")
        return supplier as AnyCircuitElement[]
      },
    },
  })
  expect(csv.split(/\r?\n/)).toEqual([
    "Designator,Mid X,Mid Y,Layer,Rotation",
    "J_USB,-6.000,16.700,top,180",
    "J_MOTOR_USB,7.000,16.700,top,180",
  ])
})
