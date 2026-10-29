import { expect, test } from "bun:test"
import type { AnyCircuitElement, PcbComponent } from "circuit-json"
import { Circuit } from "tscircuit"
import {
  type PickAndPlaceRow,
  convertCircuitJsonToPickAndPlaceRows,
} from "../src"

const renderCircuit = async (): Promise<AnyCircuitElement[]> => {
  const circuit = new Circuit()

  circuit.add(
    <board width={20} height={22} routingDisabled>
      <chip
        name="U_SENSOR"
        pcbX={0}
        pcbY={0.2}
        pcbRotation={90}
        footprint={
          <footprint>
            <platedhole
              shape="circle"
              pcbX={-6.674993}
              pcbY={-5.350002}
              outerDiameter={1.0999978}
              holeDiameter={0.700024}
              portHints={["pin1"]}
            />
            <platedhole
              shape="circle"
              pcbX={-4.894961}
              pcbY={-5.350002}
              outerDiameter={1.0999978}
              holeDiameter={0.700024}
              portHints={["pin2"]}
            />
            <platedhole
              shape="circle"
              pcbX={-3.114929}
              pcbY={-5.350002}
              outerDiameter={1.0999978}
              holeDiameter={0.700024}
              portHints={["pin3"]}
            />
            <platedhole
              shape="circle"
              pcbX={-1.334897}
              pcbY={-5.350002}
              outerDiameter={1.0999978}
              holeDiameter={0.700024}
              portHints={["pin4"]}
            />
            <platedhole
              shape="circle"
              pcbX={0.445135}
              pcbY={-5.350002}
              outerDiameter={1.0999978}
              holeDiameter={0.700024}
              portHints={["pin5"]}
            />
            <platedhole
              shape="circle"
              pcbX={2.225167}
              pcbY={-5.350002}
              outerDiameter={1.0999978}
              holeDiameter={0.700024}
              portHints={["pin6"]}
            />
            <platedhole
              shape="circle"
              pcbX={4.005199}
              pcbY={-5.350002}
              outerDiameter={1.0999978}
              holeDiameter={0.700024}
              portHints={["pin7"]}
            />
            <platedhole
              shape="circle"
              pcbX={5.785231}
              pcbY={-5.350002}
              outerDiameter={1.0999978}
              holeDiameter={0.700024}
              portHints={["pin8"]}
            />
            <platedhole
              shape="circle"
              pcbX={6.674993}
              pcbY={5.350002}
              outerDiameter={1.0999978}
              holeDiameter={0.700024}
              portHints={["pin9"]}
            />
            <platedhole
              shape="circle"
              pcbX={4.894961}
              pcbY={5.350002}
              outerDiameter={1.0999978}
              holeDiameter={0.700024}
              portHints={["pin10"]}
            />
            <platedhole
              shape="circle"
              pcbX={3.114929}
              pcbY={5.350002}
              outerDiameter={1.0999978}
              holeDiameter={0.700024}
              portHints={["pin11"]}
            />
            <platedhole
              shape="circle"
              pcbX={1.334897}
              pcbY={5.350002}
              outerDiameter={1.0999978}
              holeDiameter={0.700024}
              portHints={["pin12"]}
            />
            <platedhole
              shape="circle"
              pcbX={-0.445135}
              pcbY={5.350002}
              outerDiameter={1.0999978}
              holeDiameter={0.700024}
              portHints={["pin13"]}
            />
            <platedhole
              shape="circle"
              pcbX={-2.225167}
              pcbY={5.350002}
              outerDiameter={1.0999978}
              holeDiameter={0.700024}
              portHints={["pin14"]}
            />
            <platedhole
              shape="circle"
              pcbX={-4.005199}
              pcbY={5.350002}
              outerDiameter={1.0999978}
              holeDiameter={0.700024}
              portHints={["pin15"]}
            />
            <platedhole
              shape="circle"
              pcbX={-5.785231}
              pcbY={5.350002}
              outerDiameter={1.0999978}
              holeDiameter={0.700024}
              portHints={["pin16"]}
            />
            <cutout shape="rect" pcbX={-0.975} width={16.96} height={8.6} />
          </footprint>
        }
      />
    </board>,
  )
  await circuit.renderUntilSettled()
  return circuit.getCircuitJson()
}

const renderPnpPositionSvg = (
  elements: AnyCircuitElement[],
  pnpRow: PickAndPlaceRow,
): string => {
  const component = elements.find(
    (element): element is PcbComponent => element.type === "pcb_component",
  )!
  const origin = component.footprint_origin!
  const scale = 24
  const svgX = (x: number) => 400 + x * scale
  const svgY = (y: number) => 300 - y * scale
  const point = (x: number, y: number) =>
    `${svgX(x).toFixed(2)},${svgY(y).toFixed(2)}`
  const holes = elements
    .filter((element) => element.type === "pcb_plated_hole")
    .map(
      (hole) =>
        `<circle cx="${svgX(hole.x).toFixed(2)}" cy="${svgY(hole.y).toFixed(2)}" r="13.20" fill="#d1d5db" stroke="#f59e0b" stroke-width="5"/>`,
    )
    .join("\n    ")

  return `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600">
  <rect width="800" height="600" fill="#0f172a"/>
  <text x="400" y="35" fill="#f8fafc" font-family="Arial, sans-serif" font-size="24" text-anchor="middle">Asymmetric sensor footprint PnP origin</text>
  <text x="400" y="65" fill="#86efac" font-family="Arial, sans-serif" font-size="17" text-anchor="middle">Footprint origin: (${origin.x.toFixed(3)}, ${origin.y.toFixed(3)})</text>
  <text x="400" y="90" fill="#fca5a5" font-family="Arial, sans-serif" font-size="17" text-anchor="middle">Exported PnP: (${pnpRow.mid_x.toFixed(3)}, ${pnpRow.mid_y.toFixed(3)})</text>
  <rect x="258.40" y="96.48" width="283.20" height="407.04" rx="12" fill="#14532d" stroke="#4ade80" stroke-width="3"/>
  <rect x="296.80" y="96.48" width="206.40" height="407.04" fill="#111827" stroke="#f472b6" stroke-width="3"/>
  <line x1="245" y1="${svgY(origin.y).toFixed(2)}" x2="555" y2="${svgY(origin.y).toFixed(2)}" stroke="#4ade80" stroke-width="2" stroke-dasharray="8 7"/>
  ${holes}
  <polygon points="${point(origin.x, origin.y + 0.36)} ${point(origin.x + 0.36, origin.y)} ${point(origin.x, origin.y - 0.36)} ${point(origin.x - 0.36, origin.y)}" fill="#22c55e" stroke="#dcfce7" stroke-width="2"/>
  <circle cx="${svgX(pnpRow.mid_x).toFixed(2)}" cy="${svgY(pnpRow.mid_y).toFixed(2)}" r="13" fill="none" stroke="#ef4444" stroke-width="5"/>
  <line x1="${svgX(pnpRow.mid_x) - 18}" y1="${svgY(pnpRow.mid_y)}" x2="${svgX(pnpRow.mid_x) + 18}" y2="${svgY(pnpRow.mid_y)}" stroke="#ef4444" stroke-width="4"/>
  <line x1="${svgX(pnpRow.mid_x)}" y1="${svgY(pnpRow.mid_y) - 18}" x2="${svgX(pnpRow.mid_x)}" y2="${svgY(pnpRow.mid_y) + 18}" stroke="#ef4444" stroke-width="4"/>
  <rect x="80" y="530" width="18" height="18" transform="rotate(45 89 539)" fill="#22c55e"/>
  <text x="110" y="545" fill="#e2e8f0" font-family="Arial, sans-serif" font-size="16">footprint origin / pin-grid center</text>
  <circle cx="440" cy="539" r="10" fill="none" stroke="#ef4444" stroke-width="4"/>
  <text x="460" y="545" fill="#e2e8f0" font-family="Arial, sans-serif" font-size="16">exported PnP position</text>
</svg>`
}

test("repro: PnP position for an asymmetric footprint with an offset cutout", async () => {
  const circuitJson = await renderCircuit()
  const pcbComponent = circuitJson.find(
    (element): element is PcbComponent => element.type === "pcb_component",
  )!

  expect(pcbComponent.center.x).toBeCloseTo(0)
  expect(pcbComponent.center.y).toBeCloseTo(-0.775)
  expect(pcbComponent.footprint_origin?.x).toBeCloseTo(0)
  expect(pcbComponent.footprint_origin?.y).toBeCloseTo(0.2)

  const [pnpRow] = convertCircuitJsonToPickAndPlaceRows(circuitJson)
  expect({
    ...pnpRow,
    mid_x: Number(pnpRow.mid_x.toFixed(3)),
    mid_y: Number(pnpRow.mid_y.toFixed(3)),
  }).toEqual({
    designator: "U_SENSOR",
    mid_x: 0,
    mid_y: -0.775,
    layer: "top",
    rotation: 90,
  })

  const svg = renderPnpPositionSvg(circuitJson, pnpRow)
  const snapshotUrl = new URL(
    "./__snapshots__/asymmetric-footprint-origin.snap.svg",
    import.meta.url,
  )
  if (process.env.BUN_UPDATE_SNAPSHOTS === "1") {
    await Bun.write(snapshotUrl, svg)
  }
  expect(svg).toBe(await Bun.file(snapshotUrl).text())
})
