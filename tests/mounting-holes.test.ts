import type { AnyCircuitElement } from "circuit-json"
import { expect, test } from "bun:test"
import {
  convertCircuitJsonToPickAndPlaceRows,
  convertCircuitJsonToPickAndPlaceCsv,
} from "../src"
import { mountingHoleCircuit } from "./fixtures/mounting-hole-circuit"

test("excludes bare MH mounting-hole footprints from placement rows and CSV", () => {
  const rows = convertCircuitJsonToPickAndPlaceRows(mountingHoleCircuit)
  expect(rows).toEqual([
    { designator: "R1", mid_x: 0, mid_y: 5, layer: "top", rotation: 90 },
  ])
  const csv = convertCircuitJsonToPickAndPlaceCsv(mountingHoleCircuit)
  for (const name of ["MH1", "MH2", "MH3", "MH4"])
    expect(csv).not.toContain(name)
  expect(csv).toContain("R1,0.000,5.000,top,90")
})

const getRows = convertCircuitJsonToPickAndPlaceRows

const singleHole = () => structuredClone(mountingHoleCircuit.slice(0, 3))

const preservedCases: Array<
  [string, (circuit: AnyCircuitElement[]) => AnyCircuitElement[]]
> = [
  [
    "single-pin connector without a supplier number",
    (circuit) =>
      circuit.map((element) =>
        element.type === "source_component"
          ? { ...element, name: "J1" }
          : element,
      ),
  ],
  [
    "similar component name",
    (circuit) =>
      circuit.map((element) =>
        element.type === "source_component"
          ? { ...element, name: "MH1_DRIVER" }
          : element,
      ),
  ],
  [
    "assigned manufacturer part number",
    (circuit) =>
      circuit.map((element) =>
        element.type === "source_component"
          ? { ...element, manufacturer_part_number: "M3-INSERT" }
          : element,
      ),
  ],
  [
    "assigned supplier part number",
    (circuit) =>
      circuit.map((element) =>
        element.type === "source_component"
          ? { ...element, supplier_part_numbers: { lcsc: ["C123"] } }
          : element,
      ),
  ],
  [
    "incomplete footprint geometry",
    (circuit) =>
      circuit.filter((element) => element.type !== "pcb_plated_hole"),
  ],
  [
    "multi-hole component",
    (circuit) => [
      ...circuit,
      ...circuit
        .filter((element) => element.type === "pcb_plated_hole")
        .map((element) => ({
          ...element,
          pcb_plated_hole_id: "second_hole",
          x: 1,
        })),
    ],
  ],
  [
    "component with an SMT pad",
    (circuit) => [
      ...circuit,
      {
        type: "pcb_smtpad",
        pcb_smtpad_id: "pad1",
        pcb_component_id: "pcb_mh1",
        shape: "rect",
        x: 0,
        y: 0,
        width: 1,
        height: 1,
        layer: "top",
        port_hints: ["pin2"],
      },
    ],
  ],
  [
    "physical mounting hardware model",
    (circuit) => [
      ...circuit,
      {
        type: "cad_component",
        cad_component_id: "cad_mh1",
        source_component_id: "source_mh1",
        anchor_alignment: "center_of_component_on_board_surface",
        model_object_fit: "contain_within_bounds",
        pcb_component_id: "pcb_mh1",
        position: { x: -15.5, y: -15.5, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        model_step_url: "https://example.com/m3-insert.step",
      },
    ],
  ],
]

test.each(preservedCases)("preserves %s", async (_name, transform) => {
  const rows = await getRows(transform(singleHole()))
  expect(rows).toHaveLength(1)
})

test("excludes non-plated mounting holes too", async () => {
  const circuit = singleHole().map(
    (element): AnyCircuitElement =>
      element.type === "pcb_plated_hole"
        ? {
            type: "pcb_hole",
            pcb_hole_id: "npth1",
            pcb_component_id: "pcb_mh1",
            hole_shape: "circle",
            hole_diameter: 3.3,
            x: -15.5,
            y: -15.5,
          }
        : element,
  )
  expect(await getRows(circuit)).toEqual([])
})

test("does not count pads belonging to another component as mounting-hole pads", async () => {
  const circuit: AnyCircuitElement[] = [
    ...singleHole(),
    {
      type: "pcb_smtpad",
      pcb_smtpad_id: "pad1",
      pcb_component_id: "pcb_r1",
      shape: "rect",
      x: 0,
      y: 0,
      width: 1,
      height: 1,
      layer: "top",
      port_hints: ["pin1"],
    },
  ]
  expect(await getRows(circuit)).toEqual([])
})

test("does not warn or throw for mounting-hole supplier rotations", () => {
  const warnings: unknown[] = []
  expect(
    convertCircuitJsonToPickAndPlaceRows(singleHole(), {
      supplier: "jlcpcb",
      onRotationWarning: (warning) => warnings.push(warning),
    }),
  ).toEqual([])
  expect(warnings).toEqual([])
  expect(
    convertCircuitJsonToPickAndPlaceRows(singleHole(), {
      supplier: "jlcpcb",
      requireSupplierRotation: true,
    }),
  ).toEqual([])
})
