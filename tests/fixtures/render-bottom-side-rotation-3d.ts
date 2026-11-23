import type { AnyCircuitElement } from "circuit-json"
import {
  convertCircuitJsonTo3D,
  convertSceneToGLTF,
} from "circuit-json-to-gltf"
import { renderGLTFToPNGFromGLB } from "poppygl"
import Papa from "papaparse"

/** Native CAD comparison under an explicit, unverified CSV interpretation. */
export const renderBottomSideRotation3d = async (
  c: AnyCircuitElement[],
  csv: string,
): Promise<string> => {
  const variants = [
    { name: "Circuit JSON CAD reference", csv: null },
    { name: "Exported CSV: local interpretation", csv },
  ]
  const parts = ["U4", "D4"]
  const panels: string[] = []
  const project = (position: number[], eye: number[], center: number[]) => {
    const norm = (v: number[]) => {
      const l = Math.hypot(...v)
      return v.map((n) => n / l)
    }
    const cross = (a: number[], b: number[]) => [
      a[1] * b[2] - a[2] * b[1],
      a[2] * b[0] - a[0] * b[2],
      a[0] * b[1] - a[1] * b[0],
    ]
    const dot = (a: number[], b: number[]) =>
      a.reduce((n, v, i) => n + v * b[i], 0)
    const forward = norm(center.map((n, i) => n - eye[i])),
      right = norm(cross(forward, [0, 0, 1])),
      up = cross(right, forward)
    const d = position.map((n, i) => n - eye[i]),
      depth = dot(d, forward),
      tangent = Math.tan((38 * Math.PI) / 360)
    return [
      380 + (dot(d, right) / depth / tangent) * 280,
      280 - (dot(d, up) / depth / tangent) * 280,
    ]
  }
  const esc = (s: string) =>
    s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
  for (const [ri, name] of parts.entries()) {
    const source = c.find(
      (e) => e.type === "source_component" && e.name === name,
    )
    if (source?.type !== "source_component") throw Error("Missing source")
    const pcb = c.find(
      (e) =>
        e.type === "pcb_component" &&
        e.source_component_id === source.source_component_id,
    )!
    if (pcb.type !== "pcb_component") throw Error("Missing PCB placement")
    const cad = c.find(
      (e) =>
        e.type === "cad_component" &&
        e.pcb_component_id === pcb.pcb_component_id,
    )!
    if (cad.type !== "cad_component" || !cad.rotation)
      throw Error("Missing CAD")
    const pads = c.filter(
      (e) =>
        e.type === "pcb_smtpad" && e.pcb_component_id === pcb.pcb_component_id,
    )
    for (const [ci, variant] of variants.entries()) {
      const row = variant.csv
        ? Papa.parse<Record<string, string>>(variant.csv, {
            header: true,
          }).data.find((r) => r.Designator === name)
        : null
      const copy = structuredClone(c).filter(
        (e) =>
          e.type !== "cad_component" ||
          e.pcb_component_id === pcb.pcb_component_id,
      )
      const part = copy.find((e) => e.type === "cad_component")!
      if (part.type !== "cad_component" || !part.rotation)
        throw Error("Missing copied CAD")
      part.position.z -= 2.2
      // Explicitly a local hypothesis: CSV bottom angles are read in the same
      // component-view frame as the stored CAD z rotation. This is NOT JLCPCB UI.
      if (row) part.rotation.z = Number(row.Rotation)
      const scene = await convertCircuitJsonTo3D(copy, {
        textureResolution: 1024,
      })
      const glb = (await convertSceneToGLTF(scene, {
        binary: true,
      })) as ArrayBuffer

      const x = -pcb.center.x,
        z = pcb.center.y
      const png = await renderGLTFToPNGFromGLB(glb, {
        width: 760,
        height: 560,
        camPos: [x - 4, -10, z + 6],
        lookAt: [x, -1.6, z],
        up: "z+",
        fov: 38,
        realistic: false,
        ambient: 0.65,
        lightDir: [-0.4, -0.8, 0.3],
        backgroundColor: "#e5ebf0",
        showEdges: true,
        edgeWidth: 0.65,
      })

      const eye = [x - 4, -10, z + 6],
        center = [x, -1.6, z]
      const delta = (-(part.rotation.z - cad.rotation.z) * Math.PI) / 180
      const annotations = pads
        .map((p) => {
          if (p.type !== "pcb_smtpad" || p.shape === "polygon")
            throw Error("Missing rectangular pad")
          const board = [-p.x, -0.84, p.y]
          const dx = p.x - pcb.center.x,
            dy = p.y - pcb.center.y
          const contact = [
            -(pcb.center.x + dx * Math.cos(delta) - dy * Math.sin(delta)),
            -3.0,
            pcb.center.y + dx * Math.sin(delta) + dy * Math.cos(delta),
          ]
          const a = project(board, eye, center),
            b = project(contact, eye, center),
            pin = p.port_hints?.[0]
          return `<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" stroke="#0891b2" stroke-width="2.5" stroke-dasharray="6 5"/>
      <circle cx="${a[0]}" cy="${a[1]}" r="15" fill="#fbbf24" stroke="#fff" stroke-width="2"/>
      <text x="${a[0]}" y="${a[1] + 7}" font-size="20" text-anchor="middle" font-weight="700">${pin}</text>
      <circle cx="${b[0]}" cy="${b[1]}" r="15" fill="#cffafe" stroke="#0891b2" stroke-width="2"/>
      <text x="${b[0]}" y="${b[1] + 7}" font-size="20" text-anchor="middle" font-weight="700">${pin}</text>`
        })
        .join("\n")
      const px = 24 + ci * 792,
        py = 152 + ri * 756
      const csvLine = row
        ? `${row.Designator},${row["Mid X"]},${row["Mid Y"]},${row.Layer},${row.Rotation}`
        : "Reference from native cad_component"
      panels.push(`<g transform="translate(${px},${py})">
      <rect width="768" height="732" rx="12" fill="#fff" stroke="#cbd5e1"/>
      <text x="18" y="30" font-size="22" font-weight="700">${name} | ${esc(variant.name)}</text>
      <text x="18" y="62" font-size="18">PCB rotation: ${pcb.rotation} deg | CAD: (0,180,${part.rotation.z}) deg</text>
      <image x="4" y="78" width="760" height="560" href="data:image/png;base64,${Buffer.from(png).toString("base64")}"/>
      <g transform="translate(4,78)">${annotations}</g>
      <text x="18" y="662" font-family="DejaVu Sans Mono, monospace" font-size="16">Designator,Mid X,Mid Y,Layer,Rotation</text>
      <text x="18" y="691" font-family="DejaVu Sans Mono, monospace" font-size="19" font-weight="700">${csvLine}</text>
      <text x="18" y="717" font-size="15">${row ? "CAD z was set from CSV under the stated hypothesis." : "CAD rotation is read directly from the reporter's JSON."}</text>
    </g>`)
    }
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1608" height="1895" viewBox="0 0 1608 1895">
<rect width="1608" height="1895" fill="#f1f5f9"/>
<g font-family="DejaVu Sans, sans-serif" fill="#0f172a">
<text x="28" y="40" font-size="29" font-weight="700">Issue 41 | Real 3D geometry, exact stored angles and exact CSV rows</text>
<text x="28" y="78" font-size="24" fill="#9a3412" font-weight="700">LOCAL RECONSTRUCTION — separate real JLCPCB captures are in docs/repros/issue-41</text>
<text x="28" y="114" font-size="21">Camera below the board (PCB Z&lt;0), looking up; PCB +Y is upward. Bodies lifted 2.2 mm to expose pads; XY and rotation are preserved.</text>
${panels.join("\n")}
<text x="28" y="1680" font-size="21">Gold circles: recorded board pad centers. Cyan circles: authored numbered contact frame on the lifted CAD.</text>
<text x="28" y="1716" font-size="21">Dashed lines join corresponding pin centers. Generic CAD dimensions are not supplier-zero calibration.</text>
<text x="28" y="1754" font-size="22" font-weight="700">Observed: PCB rotation 90 deg and native CAD z=270 deg coexist in the same Circuit JSON.</text>
<text x="28" y="1792" font-size="21">This local mapping omits supplier zeros. See the separate calibrated JLCPCB comparison for external evidence.</text>
<text x="28" y="1830" font-size="20">Geometry: actual footprinter CAD via circuit-json-to-gltf; CPU rasterization by PoppyGL. This is not a JLCPCB capture.</text>
<text x="28" y="1868" font-size="20">No supplier-specific zero offset is applied here. The vendor experiment checks top/0 and bottom/0 controls separately.</text>
</g></svg>`
  return svg
}
