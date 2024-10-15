import { test, expect } from "bun:test"
import { convertCircuitJsonToPickAndPlaceRows } from "../src/index"
import nine_key_keyboard from "./assets/nine-key-keyboard.json"

test("nine-key-keyboard", () => {
  const rows = convertCircuitJsonToPickAndPlaceRows(nine_key_keyboard as any)
  console.log(rows)
  /*[
  {
    designator: "U1",
    mid_x: -30,
    mid_y: 0,
    layer: "top",
    rotation: 0,
  }, {
    designator: "K1",
    mid_x: 0.9499999999999993,
    mid_y: -19.05,
    layer: "bottom",
    rotation: 0,
  }, {
    designator: "K1_shaft",
    mid_x: 0.9499999999999993,
    mid_y: -19.57,
    layer: "top",
    rotation: 0,
  }, {
    designator: "pcb_component_3",
    mid_x: 0,
    mid_y: 0,
    layer: "top",
    rotation: 0,
  }, {
    designator: "D1",
    mid_x: 0.9499999999999993,
    mid_y: -32.05,
    layer: "bottom",
    rotation: 0,
  }, {
    designator: "pcb_component_5",
    mid_x: 0,
    mid_y: 0,
    layer: "top",
    rotation: 0,
  }, {
    designator: "K2",
    mid_x: 20,
    mid_y: -19.05,
    layer: "bottom",
    rotation: 0,
  }, {
    designator: "K2_shaft",
    mid_x: 20,
    mid_y: -19.57,
    layer: "top",
    rotation: 0,
  }, {
    designator: "pcb_component_8",
    mid_x: 0,
    mid_y: 0,
    layer: "top",
    rotation: 0,
  }, {
    designator: "D2",
    mid_x: 20,
    mid_y: -32.05,
    layer: "bottom",
    rotation: 0,
  }, {
    designator: "pcb_component_10",
    mid_x: 0,
    mid_y: 0,
    layer: "top",
    rotation: 0,
  }, {
    designator: "K3",
    mid_x: 39.05,
    mid_y: -19.05,
    layer: "bottom",
    rotation: 0,
  }, {
    designator: "K3_shaft",
    mid_x: 39.05,
    mid_y: -19.57,
    layer: "top",
    rotation: 0,
  }, {
    designator: "pcb_component_13",
    mid_x: 0,
    mid_y: 0,
    layer: "top",
    rotation: 0,
  }, {
    designator: "D3",
    mid_x: 39.05,
    mid_y: -32.05,
    layer: "bottom",
    rotation: 0,
  }, {
    designator: "pcb_component_15",
    mid_x: 0,
    mid_y: 0,
    layer: "top",
    rotation: 0,
  }, {
    designator: "K4",
    mid_x: 0.9499999999999993,
    mid_y: 0,
    layer: "bottom",
    rotation: 0,
  }, {
    designator: "K4_shaft",
    mid_x: 0.9499999999999993,
    mid_y: -0.52,
    layer: "top",
    rotation: 0,
  }, {
    designator: "pcb_component_18",
    mid_x: 0,
    mid_y: 0,
    layer: "top",
    rotation: 0,
  }, {
    designator: "D4",
    mid_x: 0.9499999999999993,
    mid_y: -13,
    layer: "bottom",
    rotation: 0,
  }, {
    designator: "pcb_component_20",
    mid_x: 0,
    mid_y: 0,
    layer: "top",
    rotation: 0,
  }, {
    designator: "K5",
    mid_x: 20,
    mid_y: 0,
    layer: "bottom",
    rotation: 0,
  }, {
    designator: "K5_shaft",
    mid_x: 20,
    mid_y: -0.52,
    layer: "top",
    rotation: 0,
  }, {
    designator: "pcb_component_23",
    mid_x: 0,
    mid_y: 0,
    layer: "top",
    rotation: 0,
  }, {
    designator: "D5",
    mid_x: 20,
    mid_y: -13,
    layer: "bottom",
    rotation: 0,
  }, {
    designator: "pcb_component_25",
    mid_x: 0,
    mid_y: 0,
    layer: "top",
    rotation: 0,
  }, {
    designator: "K6",
    mid_x: 39.05,
    mid_y: 0,
    layer: "bottom",
    rotation: 0,
  }, {
    designator: "K6_shaft",
    mid_x: 39.05,
    mid_y: -0.52,
    layer: "top",
    rotation: 0,
  }, {
    designator: "pcb_component_28",
    mid_x: 0,
    mid_y: 0,
    layer: "top",
    rotation: 0,
  }, {
    designator: "D6",
    mid_x: 39.05,
    mid_y: -13,
    layer: "bottom",
    rotation: 0,
  }, {
    designator: "pcb_component_30",
    mid_x: 0,
    mid_y: 0,
    layer: "top",
    rotation: 0,
  }, {
    designator: "K7",
    mid_x: 0.9499999999999993,
    mid_y: 19.05,
    layer: "bottom",
    rotation: 0,
  }, {
    designator: "K7_shaft",
    mid_x: 0.9499999999999993,
    mid_y: 18.53,
    layer: "top",
    rotation: 0,
  }, {
    designator: "pcb_component_33",
    mid_x: 0,
    mid_y: 0,
    layer: "top",
    rotation: 0,
  }, {
    designator: "D7",
    mid_x: 0.9499999999999993,
    mid_y: 6.050000000000001,
    layer: "bottom",
    rotation: 0,
  }, {
    designator: "pcb_component_35",
    mid_x: 0,
    mid_y: 0,
    layer: "top",
    rotation: 0,
  }, {
    designator: "K8",
    mid_x: 20,
    mid_y: 19.05,
    layer: "bottom",
    rotation: 0,
  }, {
    designator: "K8_shaft",
    mid_x: 20,
    mid_y: 18.53,
    layer: "top",
    rotation: 0,
  }, {
    designator: "pcb_component_38",
    mid_x: 0,
    mid_y: 0,
    layer: "top",
    rotation: 0,
  }, {
    designator: "D8",
    mid_x: 20,
    mid_y: 6.050000000000001,
    layer: "bottom",
    rotation: 0,
  }, {
    designator: "pcb_component_40",
    mid_x: 0,
    mid_y: 0,
    layer: "top",
    rotation: 0,
  }, {
    designator: "K9",
    mid_x: 39.05,
    mid_y: 19.05,
    layer: "bottom",
    rotation: 0,
  }, {
    designator: "K9_shaft",
    mid_x: 39.05,
    mid_y: 18.53,
    layer: "top",
    rotation: 0,
  }, {
    designator: "pcb_component_43",
    mid_x: 0,
    mid_y: 0,
    layer: "top",
    rotation: 0,
  }, {
    designator: "D9",
    mid_x: 39.05,
    mid_y: 6.050000000000001,
    layer: "bottom",
    rotation: 0,
  }, {
    designator: "pcb_component_45",
    mid_x: 0,
    mid_y: 0,
    layer: "top",
    rotation: 0,
  }
]*/
})
