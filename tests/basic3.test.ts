import { expect, test } from "bun:test"
import type { PcbComponent, SourceManuallyPlacedVia } from "circuit-json"
import { convertCircuitJsonToPickAndPlaceRows } from "../src"
import { sampleSoup } from "./fixtures/basic"

test("skips pcb components without source components", () => {
  const manuallyPlacedVia: SourceManuallyPlacedVia = {
    type: "source_manually_placed_via",
    source_manually_placed_via_id: "source_manually_placed_via_1",
    source_group_id: "source_group_1",
    source_net_id: "",
  }
  const manuallyPlacedViaPcbComponent: PcbComponent = {
    type: "pcb_component",
    pcb_component_id: "pcb_component_via_1",
    center: { x: 50, y: 60 },
    layer: "top",
    rotation: 0,
    width: 0.6096,
    height: 0.6096,
    source_component_id: "source_manually_placed_via_1",
    obstructs_within_bounds: true,
  }

  const rows = convertCircuitJsonToPickAndPlaceRows([
    ...sampleSoup,
    manuallyPlacedVia,
    manuallyPlacedViaPcbComponent,
  ])

  expect(rows).toHaveLength(2)
  expect(rows.map((row) => row.designator)).toEqual(["R1", "C1"])
})
