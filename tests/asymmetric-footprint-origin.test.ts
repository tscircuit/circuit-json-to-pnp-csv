import { expect, test } from "bun:test"
import type { AnyCircuitElement, PcbComponent } from "circuit-json"
import { convertCircuitJsonToPickAndPlaceCsv } from "../src"

const circuitJson: AnyCircuitElement[] = [
  {
    type: "source_component",
    source_component_id: "source_component_sensor",
    ftype: "simple_chip",
    name: "U_SENSOR",
  },
  {
    type: "pcb_component",
    pcb_component_id: "pcb_component_sensor",
    source_component_id: "source_component_sensor",
    // The complete footprint bounds include an offset mechanical cutout.
    center: { x: 0, y: -0.775 },
    // The authored footprint origin remains centered on the sensor's pin grid.
    footprint_origin: { x: 0, y: 0.2 },
    width: 11.8,
    height: 16.96,
    layer: "top",
    rotation: 90,
    obstructs_within_bounds: true,
  },
]

test("repro: PnP position for an asymmetric footprint with an offset cutout", () => {
  const pcbComponent = circuitJson.find(
    (element): element is PcbComponent => element.type === "pcb_component",
  )!

  expect(pcbComponent.center).toEqual({ x: 0, y: -0.775 })
  expect(pcbComponent.footprint_origin).toEqual({ x: 0, y: 0.2 })

  expect(convertCircuitJsonToPickAndPlaceCsv(circuitJson)).toMatchSnapshot()
})
