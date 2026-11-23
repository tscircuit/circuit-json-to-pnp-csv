import { expect, test } from "bun:test"
import { Resvg } from "@resvg/resvg-js"
import type { AnyCircuitElement } from "circuit-json"
import { convertCircuitJsonToPickAndPlaceCsv } from "../src"
import fixture from "./assets/bottom-side-rotation.circuit.json"
import { renderBottomSideRotation3d } from "./fixtures/render-bottom-side-rotation-3d"

test("native CAD and exact CSV in an annotated 3D comparison", async () => {
  const input = structuredClone(fixture) as AnyCircuitElement[]
  const original = structuredClone(input)
  const csv = convertCircuitJsonToPickAndPlaceCsv(input, {
    supplier: "jlcpcb",
    onRotationWarning: () => {},
  })
  const svg = await renderBottomSideRotation3d(input, csv)
  const snapshot = new URL(
    "./__snapshots__/bottom-side-rotation-3d.snap.svg",
    import.meta.url,
  )
  if (process.env.BUN_UPDATE_SNAPSHOTS === "1") {
    await Bun.write(snapshot, svg)
    await Bun.write(
      new URL(
        "./__snapshots__/bottom-side-rotation-3d.snap.png",
        import.meta.url,
      ),
      new Uint8Array(new Resvg(svg).render().asPng()),
    )
  }
  const hash = (text: string) =>
    new Bun.CryptoHasher("sha256").update(text).digest("hex")
  expect(hash(svg)).toBe(hash(await Bun.file(snapshot).text()))
  expect(input).toEqual(original)
}, 60_000)
