import { expect, mock, test } from "bun:test"
import type { AnyCircuitElement, SourcePort } from "circuit-json"
import { populatePartOrientationMetadata } from "../src"

const diode = (): AnyCircuitElement[] => [
  {
    type: "source_component",
    source_component_id: "source_diode",
    ftype: "simple_diode",
    name: "D1",
    supplier_part_numbers: { jlcpcb: ["C43491"] },
  },
  {
    type: "source_port",
    source_port_id: "anode",
    source_component_id: "source_diode",
    pin_number: 1,
    name: "pin1",
    port_hints: ["anode"],
  },
  {
    type: "source_port",
    source_port_id: "cathode",
    source_component_id: "source_diode",
    pin_number: 2,
    name: "pin2",
    port_hints: ["cathode"],
  },
  {
    type: "pcb_component",
    pcb_component_id: "pcb_diode",
    source_component_id: "source_diode",
    center: { x: 0, y: 0 },
    width: 4,
    height: 2,
    layer: "top",
    rotation: 0,
    pin1_location: "topside_left",
    obstructs_within_bounds: true,
  },
  {
    type: "pcb_smtpad",
    pcb_smtpad_id: "pad1",
    pcb_component_id: "pcb_diode",
    shape: "rect",
    layer: "top",
    x: -1,
    y: 0,
    width: 1,
    height: 1,
    port_hints: ["pin1"],
  },
  {
    type: "pcb_smtpad",
    pcb_smtpad_id: "pad2",
    pcb_component_id: "pcb_diode",
    shape: "rect",
    layer: "top",
    x: 1,
    y: 0,
    width: 1,
    height: 1,
    port_hints: ["pin2"],
  },
]

const pin1 = (circuit: AnyCircuitElement[]) =>
  circuit.find(
    (element): element is SourcePort =>
      element.type === "source_port" && element.pin_number === 1,
  )!

test("rejects opposite diode polarity even when numbered pin frames match", async () => {
  const original = diode()
  const before = structuredClone(original)
  const supplier = diode()
  pin1(supplier).port_hints = ["cathode"]
  await expect(
    populatePartOrientationMetadata(original, {
      partsEngine: { fetchPartCircuitJson: () => supplier },
    }),
  ).rejects.toThrow(
    "D1 (jlcpcb:C43491): authored pin 1 is anode, but supplier pin 1 is cathode",
  )
  expect(original).toEqual(before)
})

test("accepts matching diode polarity", async () => {
  const prepared = await populatePartOrientationMetadata(diode(), {
    partsEngine: { fetchPartCircuitJson: () => diode() },
  })
  expect(
    prepared.find((element) => element.type === "pcb_component"),
  ).toMatchObject({
    supplier_pin1_location_map: { jlcpcb: "topside_left" },
  })
})

test("rejects opposite LED polarity", async () => {
  const original = diode()
  const source = original[0]
  if (source.type !== "source_component") throw new Error("missing source")
  source.ftype = "simple_led"
  const supplier = diode()
  pin1(supplier).port_hints = ["K"]
  await expect(
    populatePartOrientationMetadata(original, {
      partsEngine: { fetchPartCircuitJson: () => supplier },
    }),
  ).rejects.toThrow("authored pin 1 is anode, but supplier pin 1 is cathode")
})

test("checks each component's polarity when supplier lookup is cached", async () => {
  const original = diode()
  original.push(
    {
      type: "source_component",
      source_component_id: "second",
      name: "D2",
      ftype: "simple_diode",
      supplier_part_numbers: { jlcpcb: ["C43491"] },
    },
    {
      type: "source_port",
      source_port_id: "second_cathode",
      source_component_id: "second",
      name: "pin1",
      pin_number: 1,
      port_hints: ["cathode"],
    },
    {
      type: "pcb_component",
      pcb_component_id: "second_pcb",
      source_component_id: "second",
      center: { x: 10, y: 0 },
      width: 4,
      height: 2,
      layer: "top",
      rotation: 0,
      pin1_location: "topside_left",
      obstructs_within_bounds: true,
    },
  )
  const fetchPartCircuitJson = mock(() => diode())
  await expect(
    populatePartOrientationMetadata(original, {
      partsEngine: { fetchPartCircuitJson },
    }),
  ).rejects.toThrow(
    "D2 (jlcpcb:C43491): authored pin 1 is cathode, but supplier pin 1 is anode",
  )
  expect(fetchPartCircuitJson).toHaveBeenCalledTimes(1)
})

test("checks pin-1 aliases when the optional pin number is absent", async () => {
  const supplier = diode()
  supplier[1] = {
    type: "source_port",
    source_port_id: "supplier_pin1",
    source_component_id: "source_diode",
    name: "K",
    port_hints: ["pin1"],
  }
  await expect(
    populatePartOrientationMetadata(diode(), {
      partsEngine: { fetchPartCircuitJson: () => supplier },
    }),
  ).rejects.toThrow("authored pin 1 is anode, but supplier pin 1 is cathode")
})

test("preserves geometry-only lookup when supplier polarity is unspecified", async () => {
  const supplier = diode().filter((element) => element.type !== "source_port")
  const prepared = await populatePartOrientationMetadata(diode(), {
    partsEngine: { fetchPartCircuitJson: () => supplier },
  })
  expect(
    prepared.find((element) => element.type === "pcb_component"),
  ).toMatchObject({
    supplier_pin1_location_map: { jlcpcb: "topside_left" },
  })
})

test("uses only the authored component's own source ports", async () => {
  const original = diode()
  original.unshift({
    type: "source_port",
    source_port_id: "unrelated_pin1",
    source_component_id: "unrelated_component",
    name: "cathode",
    pin_number: 1,
  })
  const prepared = await populatePartOrientationMetadata(original, {
    partsEngine: { fetchPartCircuitJson: () => diode() },
  })
  expect(
    prepared.find((element) => element.type === "pcb_component"),
  ).toMatchObject({
    supplier_pin1_location_map: { jlcpcb: "topside_left" },
  })
})

test("does not interpret chip pin aliases as diode polarity", async () => {
  const original = diode()
  const source = original[0]
  if (source.type !== "source_component") throw new Error("missing source")
  source.ftype = "simple_chip"
  const supplier = diode()
  pin1(supplier).port_hints = ["cathode"]
  const prepared = await populatePartOrientationMetadata(original, {
    partsEngine: { fetchPartCircuitJson: () => supplier },
  })
  expect(
    prepared.find((element) => element.type === "pcb_component"),
  ).toMatchObject({
    supplier_pin1_location_map: { jlcpcb: "topside_left" },
  })
})

test("does not guess polarity from conflicting aliases", async () => {
  const supplier = diode()
  pin1(supplier).port_hints = ["anode", "cathode"]
  const prepared = await populatePartOrientationMetadata(diode(), {
    partsEngine: { fetchPartCircuitJson: () => supplier },
  })
  expect(
    prepared.find((element) => element.type === "pcb_component"),
  ).toMatchObject({
    supplier_pin1_location_map: { jlcpcb: "topside_left" },
  })
})
