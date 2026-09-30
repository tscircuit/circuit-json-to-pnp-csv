import { expect, mock, test } from "bun:test"
import type { AnyCircuitElement, PcbComponent } from "circuit-json"
import {
  convertCircuitJsonToPickAndPlaceCsv,
  convertCircuitJsonToPickAndPlaceRows,
  populatePartOrientationMetadata,
} from "../src"
import supplierFixture from "./assets/jst-ph-c131334-supplier.circuit.json"
import routedFixture from "./assets/jst-ph-routed-without-orientation.circuit.json"

// Reduced from the RP2040 motor controller's routed J1 (B4B-PH-K-S(LF)(SN)).
// The C131334 fixture preserves the unrotated JLCsearch/EasyEDA pad positions:
// pin 1 at +2.999994 mm, then pins 2–4 toward -X. The authored footprint
// numbers the same row toward +X, requiring a 180-degree supplier correction.
const circuit = () => structuredClone(routedFixture) as AnyCircuitElement[]
const supplier = () => structuredClone(supplierFixture) as AnyCircuitElement[]
const pcb = (elements: AnyCircuitElement[]) =>
  elements.find((e): e is PcbComponent => e.type === "pcb_component")!

test("exports routed JST PH J1 at 270 degrees instead of its PCB/CAD rotation of 90", async () => {
  const original = circuit()
  const before = structuredClone(original)
  const supplierJson = supplier()
  const supplierBefore = structuredClone(supplierJson)
  const fetchPartCircuitJson = mock(async () => supplierJson)
  const prepared = await populatePartOrientationMetadata(original, {
    supplier: "jlcpcb",
    partsEngine: { fetchPartCircuitJson },
  })
  expect(fetchPartCircuitJson).toHaveBeenCalledTimes(1)
  expect(fetchPartCircuitJson).toHaveBeenCalledWith({
    supplierPartNumber: "C131334",
    platformFetch: undefined,
  })
  expect(pcb(prepared).pin1_location).toBe("topside_left")
  expect(pcb(prepared).supplier_pin1_location_map?.jlcpcb).toBe(
    "bottomside_right",
  )
  const options = { supplier: "jlcpcb", requireSupplierRotation: true } as const
  expect(convertCircuitJsonToPickAndPlaceRows(prepared, options)).toEqual([
    { designator: "J1", mid_x: 17, mid_y: -4.7, layer: "top", rotation: 270 },
  ])
  expect(convertCircuitJsonToPickAndPlaceCsv(prepared, options)).toBe(
    "Designator,Mid X,Mid Y,Layer,Rotation\r\nJ1,17.000,-4.700,top,270",
  )
  // Generic exports keep their frame; supplier exports must not double-correct.
  expect(convertCircuitJsonToPickAndPlaceRows(prepared)[0]!.rotation).toBe(90)
  expect(
    await populatePartOrientationMetadata(prepared, {
      partsEngineDisabled: true,
    }),
  ).toEqual(prepared)
  expect(original).toEqual(before)
  expect(supplierJson).toEqual(supplierBefore)
  expect(
    prepared.map((e) => {
      if (e.type !== "pcb_component") return e
      const { pin1_location, supplier_pin1_location_map, ...rest } = e
      return rest
    }),
  ).toEqual(before)
})

const rotatePads = (
  elements: AnyCircuitElement[],
  degrees: number,
  center = { x: 0, y: 0 },
) => {
  const angle = (degrees * Math.PI) / 180
  for (const e of elements) {
    if (e.type !== "pcb_plated_hole") continue
    const x = e.x - center.x
    const y = e.y - center.y
    e.x = center.x + x * Math.cos(angle) - y * Math.sin(angle)
    e.y = center.y + x * Math.sin(angle) + y * Math.cos(angle)
  }
}
const normalized = (angle: number) => ((angle % 360) + 360) % 360

test("matches horizontal and vertical supplier rows at translated and wrapped board rotations", async () => {
  for (const boardRotation of [-90, 0, 37, 90, 180, 270, 450]) {
    for (const supplierRotation of [0, 90, 180, 270]) {
      const original = circuit()
      const component = pcb(original)
      rotatePads(original, boardRotation - component.rotation, component.center)
      component.rotation = boardRotation
      const supplierJson = supplier()
      rotatePads(supplierJson, supplierRotation)
      const prepared = await populatePartOrientationMetadata(original, {
        partsEngine: { fetchPartCircuitJson: async () => supplierJson },
      })
      const row = convertCircuitJsonToPickAndPlaceRows(prepared, {
        supplier: "jlcpcb",
        requireSupplierRotation: true,
      })[0]!
      expect(row.rotation).toBe(
        normalized(boardRotation + 180 - supplierRotation),
      )
      expect([row.mid_x, row.mid_y, row.layer]).toEqual([17, -4.7, "top"])
    }
  }
})

test("does not depend on CAD model alignment or the presence of a CAD model", async () => {
  for (const cadRotation of [undefined, 0, 180, 293]) {
    const original = circuit().filter(
      (e) => cadRotation !== undefined || e.type !== "cad_component",
    )
    const cad = original.find((e) => e.type === "cad_component")
    if (cad?.type === "cad_component")
      cad.rotation = { x: 0, y: 0, z: cadRotation! }
    const prepared = await populatePartOrientationMetadata(original, {
      partsEngine: { fetchPartCircuitJson: async () => supplier() },
    })
    expect(
      convertCircuitJsonToPickAndPlaceRows(prepared, {
        supplier: "jlcpcb",
        requireSupplierRotation: true,
      })[0]!.rotation,
    ).toBe(270)
  }
})

test("uses the same single-row convention for SMT and polygon pads", async () => {
  for (const shape of ["rect", "polygon"] as const) {
    const convertPads = (elements: AnyCircuitElement[]): AnyCircuitElement[] =>
      elements.map((e) => {
        if (e.type !== "pcb_plated_hole") return e
        const base = {
          type: "pcb_smtpad" as const,
          pcb_smtpad_id: e.pcb_plated_hole_id,
          pcb_component_id: e.pcb_component_id,
          port_hints: e.port_hints,
          layer: "top" as const,
        }
        if (shape === "rect")
          return { ...base, shape, x: e.x, y: e.y, width: 1, height: 1 }
        return {
          ...base,
          shape,
          points: [
            { x: e.x - 0.5, y: e.y - 0.5 },
            { x: e.x + 0.5, y: e.y - 0.5 },
            { x: e.x + 0.5, y: e.y + 0.5 },
            { x: e.x - 0.5, y: e.y + 0.5 },
          ],
        }
      })
    const prepared = await populatePartOrientationMetadata(
      convertPads(circuit()),
      {
        partsEngine: {
          fetchPartCircuitJson: async () => convertPads(supplier()),
        },
      },
    )
    expect(
      convertCircuitJsonToPickAndPlaceRows(prepared, {
        supplier: "jlcpcb",
        requireSupplierRotation: true,
      })[0]!.rotation,
    ).toBe(270)
  }
})

test("rejects ambiguous single-row numbering instead of guessing", async () => {
  for (const hints of [
    [["pin1"], ["pin2"], ["pin2"], ["pin4"]],
    [["pin1"], ["pin2"], ["pin4"], ["pin3"]],
    [["pin1"], ["pin2"], [], ["pin4"]],
    [["pin1"], ["pin2", "pin3"], ["pin3"], ["pin4"]],
    [["pin1"], ["pin2"], ["pin4"], ["pin5"]],
  ]) {
    const supplierJson = supplier().sort(
      (a, b) =>
        Number(a.type === "pcb_plated_hole" && a.port_hints?.[0]?.slice(3)) -
        Number(b.type === "pcb_plated_hole" && b.port_hints?.[0]?.slice(3)),
    )
    for (const [i, e] of supplierJson.entries()) {
      if (e.type === "pcb_plated_hole") e.port_hints = hints[i]
    }
    await expect(
      populatePartOrientationMetadata(circuit(), {
        partsEngine: { fetchPartCircuitJson: async () => supplierJson },
      }),
    ).rejects.toThrow(
      "J1 (jlcpcb:C131334): cannot determine supplier pin-1 orientation",
    )
  }
})
