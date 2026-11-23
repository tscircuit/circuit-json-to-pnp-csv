import { expect, test } from "bun:test"
import type { PcbComponent, SourceSimpleTestPoint } from "circuit-json"
import {
  convertCircuitJsonToPickAndPlaceCsv,
  convertCircuitJsonToPickAndPlaceRows,
} from "../src"
import { sampleSoup } from "./fixtures/basic"

test("skips testpoints", () => {
  const testPoint: SourceSimpleTestPoint = {
    type: "source_component",
    ftype: "simple_test_point",
    source_component_id: "source_component_testpoint_1",
    name: "TP1",
    footprint_variant: "pad",
    pad_shape: "circle",
    pad_diameter: 1.2,
  }
  const testPointPcbComponent: PcbComponent = {
    type: "pcb_component",
    pcb_component_id: "pcb_component_testpoint_1",
    center: { x: 50, y: 60 },
    layer: "top",
    rotation: 0,
    width: 1.2,
    height: 1.2,
    source_component_id: testPoint.source_component_id,
    obstructs_within_bounds: true,
  }
  const circuitJson = [...sampleSoup, testPoint, testPointPcbComponent]

  const rows = convertCircuitJsonToPickAndPlaceRows(circuitJson)
  const csv = convertCircuitJsonToPickAndPlaceCsv(circuitJson)

  expect(rows.map((row) => row.designator)).toEqual(["R1", "C1"])
  expect(csv).not.toContain("TP1")
})
