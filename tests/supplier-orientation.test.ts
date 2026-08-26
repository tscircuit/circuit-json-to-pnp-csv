import { describe, expect, spyOn, test } from "bun:test"
import type { AnyCircuitElement, PcbComponent } from "circuit-json"
import {
  convertCircuitJsonToPickAndPlaceCsv,
  convertCircuitJsonToPickAndPlaceRows,
} from "../src/index"

// Pin-1 frames from the RP2040 motor board and the matching supplier footprints.
const driver: PcbComponent = {
  type: "pcb_component",
  pcb_component_id: "pcb_driver",
  source_component_id: "source_driver",
  center: { x: 3.875, y: -10.75 },
  width: 4.9,
  height: 7,
  layer: "top",
  rotation: 0,
  obstructs_within_bounds: true,
  pin1_location: "bottomside_left",
  supplier_pin1_location_map: { jlcpcb: "leftside_top" },
}

const mosfet: PcbComponent = {
  ...driver,
  pcb_component_id: "pcb_mosfet",
  source_component_id: "source_mosfet",
  center: { x: -1.625, y: -10.25 },
  width: 3.6,
  height: 2.5,
  pin1_location: "leftside_top",
  supplier_pin1_location_map: { jlcpcb: "rightside_bottom" },
}

const makeCircuit = (pcbComponents: PcbComponent[]): AnyCircuitElement[] => [
  {
    type: "source_component",
    ftype: "simple_chip",
    source_component_id: "source_driver",
    name: "DRIVER",
    supplier_part_numbers: { jlcpcb: ["C544361"] },
  },
  {
    type: "source_component",
    ftype: "simple_chip",
    source_component_id: "source_mosfet",
    name: "Q_PD_ENABLE",
    supplier_part_numbers: { jlcpcb: ["C85202"] },
  },
  ...pcbComponents,
]

const strictSupplierOptions = {
  supplier: "jlcpcb",
  unverified_rotation: "error",
} as const

describe("supplier-specific placement export", () => {
  test("corrects driver and MOSFET rotations without moving the board footprints", () => {
    const circuit = makeCircuit([driver, mosfet])
    const before = structuredClone(circuit)
    expect(
      convertCircuitJsonToPickAndPlaceRows(circuit, strictSupplierOptions),
    ).toEqual([
      {
        designator: "DRIVER",
        mid_x: 3.875,
        mid_y: -10.75,
        layer: "top",
        rotation: 90,
      },
      {
        designator: "Q_PD_ENABLE",
        mid_x: -1.625,
        mid_y: -10.25,
        layer: "top",
        rotation: 180,
      },
    ])
    expect(
      convertCircuitJsonToPickAndPlaceCsv(circuit, strictSupplierOptions),
    ).toContain("Q_PD_ENABLE,-1.625,-10.250,top,180")
    expect(circuit).toEqual(before)
  })

  test("rejects old Circuit JSON missing its local pin-1 frame", () => {
    const circuit = makeCircuit([{ ...driver, pin1_location: undefined }])
    expect(() =>
      convertCircuitJsonToPickAndPlaceRows(circuit, strictSupplierOptions),
    ).toThrow(/DRIVER.*jlcpcb.*pin1_location/)
    expect(() =>
      convertCircuitJsonToPickAndPlaceCsv(circuit, strictSupplierOptions),
    ).toThrow(/DRIVER.*jlcpcb.*pin1_location/)
  })

  test("rejects missing supplier data after a failed lookup, including later rows", () => {
    const circuit = makeCircuit([
      driver,
      { ...mosfet, supplier_pin1_location_map: undefined },
    ])
    expect(() =>
      convertCircuitJsonToPickAndPlaceCsv(circuit, strictSupplierOptions),
    ).toThrow(/Q_PD_ENABLE.*jlcpcb.*supplier_pin1_location_map/)
  })

  test("does not substitute another supplier's orientation", () => {
    const circuit = makeCircuit([
      { ...driver, supplier_pin1_location_map: { pcbway: "leftside_top" } },
    ])
    expect(() =>
      convertCircuitJsonToPickAndPlaceRows(circuit, strictSupplierOptions),
    ).toThrow(/DRIVER.*jlcpcb.*supplier_pin1_location_map/)
  })

  test("rejects incompatible pin-1 frames instead of preserving an unchecked rotation", () => {
    const circuit = makeCircuit([
      { ...driver, supplier_pin1_location_map: { jlcpcb: "bottomside_right" } },
    ])
    expect(() =>
      convertCircuitJsonToPickAndPlaceRows(circuit, strictSupplierOptions),
    ).toThrow(/DRIVER.*jlcpcb.*incompatible/)
  })

  test("keeps generic exports independent of supplier metadata", () => {
    const circuit = makeCircuit([
      {
        ...driver,
        rotation: 45,
        pin1_location: undefined,
        supplier_pin1_location_map: undefined,
      },
    ])
    expect(convertCircuitJsonToPickAndPlaceRows(circuit)[0]?.rotation).toBe(45)
  })

  test("ignores missing orientation on do-not-place components and bare test pads", () => {
    const circuit: AnyCircuitElement[] = [
      ...makeCircuit([
        {
          ...driver,
          do_not_place: true,
          pin1_location: undefined,
          supplier_pin1_location_map: undefined,
        },
      ]),
      {
        type: "source_component",
        ftype: "simple_test_point",
        source_component_id: "source_tp",
        name: "TP1",
        footprint_variant: "pad",
        pad_shape: "circle",
        pad_diameter: 1.2,
      },
      {
        ...driver,
        pcb_component_id: "pcb_tp",
        source_component_id: "source_tp",
        pin1_location: undefined,
        supplier_pin1_location_map: undefined,
      },
    ]
    expect(
      convertCircuitJsonToPickAndPlaceRows(circuit, strictSupplierOptions),
    ).toEqual([])
  })

  test("warns by default when legacy Circuit JSON has no orientation metadata", () => {
    const warn = spyOn(console, "warn").mockImplementation(() => {})
    try {
      const circuit = makeCircuit([
        {
          ...driver,
          pin1_location: undefined,
          supplier_pin1_location_map: undefined,
        },
      ])
      const rows = convertCircuitJsonToPickAndPlaceRows(circuit, {
        supplier: "jlcpcb",
      })
      expect(rows[0]?.rotation).toBe(0)
      expect(warn).toHaveBeenCalledTimes(1)
      expect(warn.mock.calls[0]?.[0]).toMatch(/DRIVER.*jlcpcb.*pin1_location/)
      expect(warn.mock.calls[0]?.[0]).toContain(
        "Falling back to raw PCB rotation 0 degrees",
      )
    } finally {
      warn.mockRestore()
    }
  })

  test("reports failed lookups and incompatible frames to the export UI", () => {
    const warnings: string[] = []
    const circuit = makeCircuit([
      { ...driver, supplier_pin1_location_map: undefined },
      { ...mosfet, supplier_pin1_location_map: { jlcpcb: "leftside_bottom" } },
    ])
    const csv = convertCircuitJsonToPickAndPlaceCsv(circuit, {
      supplier: "jlcpcb",
      onWarning: (message) => warnings.push(message),
    })
    expect(warnings).toHaveLength(2)
    expect(warnings[0]).toMatch(/DRIVER.*supplier_pin1_location_map/)
    expect(warnings[1]).toMatch(/Q_PD_ENABLE.*incompatible/)
    expect(csv).toContain("DRIVER,3.875,-10.750,top,0")
  })

  test("does not assume that an unanalyzable two-pad package is nonpolarized", () => {
    const warnings: string[] = []
    const circuit: AnyCircuitElement[] = [
      {
        type: "source_component",
        ftype: "simple_diode",
        source_component_id: "source_driver",
        name: "D1",
      },
      {
        ...driver,
        pin1_location: undefined,
        supplier_pin1_location_map: undefined,
        rotation: 90,
      },
    ]
    expect(
      convertCircuitJsonToPickAndPlaceRows(circuit, {
        supplier: "jlcpcb",
        onWarning: (message) => warnings.push(message),
      })[0]?.rotation,
    ).toBe(90)
    expect(warnings[0]).toMatch(/D1.*jlcpcb.*verify its orientation manually/)
    expect(() =>
      convertCircuitJsonToPickAndPlaceRows(circuit, strictSupplierOptions),
    ).toThrow(/D1.*jlcpcb/)
  })

  test("does not warn for verified supplier rotations or generic exports", () => {
    const warnings: string[] = []
    const onWarning = (message: string) => warnings.push(message)
    convertCircuitJsonToPickAndPlaceRows(makeCircuit([driver, mosfet]), {
      supplier: "jlcpcb",
      onWarning,
    })
    convertCircuitJsonToPickAndPlaceRows(
      makeCircuit([{ ...driver, pin1_location: undefined }]),
      { unverified_rotation: "error", onWarning },
    )
    expect(warnings).toEqual([])
  })
})
