import { expect, test } from "bun:test"
import type { AnyCircuitElement } from "circuit-json"
import {
  convertCircuitJsonToPickAndPlaceCsv,
  convertCircuitJsonToSupplierPickAndPlaceCsv,
} from "../src"
import supplier from "./assets/c165948-supplier.circuit.json"
import board from "./assets/rp2040-usb-c-connectors.circuit.json"

const exportWithSupplier = (footprint: AnyCircuitElement[]) =>
  convertCircuitJsonToSupplierPickAndPlaceCsv(board as AnyCircuitElement[], {
    supplier: "jlcpcb",
    partsEngine: {
      fetchPartCircuitJson: async ({ supplierPartNumber }) => {
        expect(supplierPartNumber).toBe("C165948")
        return footprint
      },
    },
  })

// v1.0.51 of imrishabh18/rp2040-motor-controller, reduced to the two
// connectors and their pads/ports. C165948 comes from the JLCPCB parts engine.
test("exports supplier rotations for the RP2040 board's renumbered USB-C pads", async () => {
  const circuit = board as AnyCircuitElement[]
  expect(() =>
    convertCircuitJsonToPickAndPlaceCsv(circuit, { supplier: "jlcpcb" }),
  ).toThrow(
    "J_USB: cannot verify jlcpcb pick-and-place rotation (missing_pin1_location)",
  )

  const csv = await exportWithSupplier(supplier as AnyCircuitElement[])
  expect(csv.split(/\r?\n/)).toEqual([
    "Designator,Mid X,Mid Y,Layer,Rotation",
    "J_USB,-6.000,16.700,top,180",
    "J_MOTOR_USB,7.000,16.700,top,180",
  ])
})

test("rejects a supplier footprint with a moved shell slot despite matching contact names", async () => {
  const footprint = structuredClone(supplier) as AnyCircuitElement[]
  const slot = footprint.find((element) => element.type === "pcb_plated_hole")!
  slot.x += 0.1
  await expect(exportWithSupplier(footprint)).rejects.toThrow(
    "cannot match authored and supplier pad orientation for C165948",
  )
})
