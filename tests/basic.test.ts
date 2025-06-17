import { expect, test, describe } from "bun:test"
import {
  convertCircuitJsonToPickAndPlaceRows,
  convertCircuitJsonToPickAndPlaceCsv,
} from "../src/index"
import type { AnyCircuitElement } from "circuit-json"

describe("circuit-json-to-pnp-csv", () => {
  const sampleSoup: AnyCircuitElement[] = [
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
    },
  ]

  test("convertCircuitJsonToPickAndPlaceRows", () => {
    const rows = convertCircuitJsonToPickAndPlaceRows(sampleSoup)
    expect(rows).toEqual([
      { designator: "R1", mid_x: 10, mid_y: 20, layer: "top", rotation: 0 },
      { designator: "C1", mid_x: 30, mid_y: 40, layer: "bottom", rotation: 90 },
    ])
  })

  test("convertCircuitJsonToPickAndPlaceCsv", () => {
    const csv = convertCircuitJsonToPickAndPlaceCsv(sampleSoup)
    const expectedCsv =
      "Designator,Mid X,Mid Y,Layer,Rotation\r\nR1,10.000,20.000,top,0\r\nC1,30.000,40.000,bottom,90"
    expect(csv).toBe(expectedCsv)
  })

  test("convertCircuitJsonToPickAndPlaceRows with flip_y_axis option", () => {
    const rows = convertCircuitJsonToPickAndPlaceRows(sampleSoup, {
      flip_y_axis: true,
    })
    expect(rows).toEqual([
      { designator: "R1", mid_x: 10, mid_y: -20, layer: "top", rotation: 0 },
      {
        designator: "C1",
        mid_x: 30,
        mid_y: -40,
        layer: "bottom",
        rotation: 90,
      },
    ])
  })
})
