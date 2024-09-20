import { expect, test, describe } from "bun:test";
import { convertSoupToPickAndPlaceRows, convertSoupToPickAndPlaceCsv } from "./index";
import type { AnyCircuitElement } from "circuit-json";

describe("circuit-json-to-pnp-csv", () => {
  const sampleSoup: AnyCircuitElement[] = [
    {
      type: "pcb_component",
      pcb_component_id: "R1",
      center: { x: 10, y: 20 },
      layer: "top",
      rotation: 0,
      width: 5,
      height: 2,
      source_component_id: "resistor1"
    },
    {
      type: "pcb_component",
      pcb_component_id: "C1",
      center: { x: 30, y: 40 },
      layer: "bottom",
      rotation: 90,
      width: 3,
      height: 3,
      source_component_id: "capacitor1"
    }
  ];

  test("convertSoupToPickAndPlaceRows", () => {
    const rows = convertSoupToPickAndPlaceRows(sampleSoup);
    expect(rows).toEqual([
      { designator: "R1", mid_x: 10, mid_y: 20, layer: "top", rotation: 0 },
      { designator: "C1", mid_x: 30, mid_y: 40, layer: "bottom", rotation: 90 }
    ]);
  });

  test("convertSoupToPickAndPlaceCsv", () => {
    const csv = convertSoupToPickAndPlaceCsv(sampleSoup);
    const expectedCsv = "Designator,Mid X,Mid Y,Layer,Rotation\r\nR1,10,20,top,0\r\nC1,30,40,bottom,90";
    expect(csv).toBe(expectedCsv);
  });

  test("convertSoupToPickAndPlaceRows with flip_y_axis option", () => {
    const rows = convertSoupToPickAndPlaceRows(sampleSoup, { flip_y_axis: true });
    expect(rows).toEqual([
      { designator: "R1", mid_x: 10, mid_y: -20, layer: "top", rotation: 0 },
      { designator: "C1", mid_x: 30, mid_y: -40, layer: "bottom", rotation: 90 }
    ]);
  });
});
