import { Resvg } from "@resvg/resvg-js"

// Assemble annotations around unaltered browser captures. This does not render
// replacement component geometry or contact positions in the vendor images.
const root = new URL("./", import.meta.url)
const capture = async (name: string) =>
  `data:image/jpeg;base64,${Buffer.from(await Bun.file(new URL(`jlcpcb/${name}`, root)).arrayBuffer()).toString("base64")}`
const text = (
  x: number,
  y: number,
  value: string,
  size = 20,
  color = "#0f172a",
) =>
  `<text x="${x}" y="${y}" font-size="${size}" fill="${color}">${value}</text>`
const rawImage = async (name: string, y: number, height = 1070) =>
  `<svg x="0" y="${y}" width="820" height="${height}" viewBox="0 0 820 ${height}" overflow="hidden"><image width="1680" height="2268" href="${await capture(name)}"/></svg>`

const panels: string[] = []
for (const [index, variant] of ["main", "proposed"].entries()) {
  const fixed = variant === "proposed"
  const color = fixed ? "#047857" : "#b91c1c"
  const dAngle = fixed ? 270 : 90
  const uAngle = fixed ? 90 : 270
  const annotations = `<g transform="translate(0,145)">
    <circle cx="90" cy="430" r="23" fill="none" stroke="#fbbf24" stroke-width="4"/>
    <circle cx="134" cy="758" r="23" fill="none" stroke="#fbbf24" stroke-width="4"/>
    <path d="M210,605 L100,${fixed ? 453 : 537}" fill="none" stroke="${color}" stroke-width="4" marker-end="url(#arrow-${variant})"/>
    ${text(190, 638, `D4: cathode on pad ${fixed ? 1 : 2}`, 24, "#fff")}
    <path d="M220,915 L${fixed ? "134,775" : "48,865"}" fill="none" stroke="${color}" stroke-width="4" marker-end="url(#arrow-${variant})"/>
    ${text(220, 942, fixed ? "U4: two leads meet upper pads" : "U4: two leads face lower side", 23, "#fff")}
  </g>`
  panels.push(`<g transform="translate(${20 + index * 860},150)">
    <rect width="840" height="1240" rx="12" fill="#fff" stroke="#cbd5e1"/>
    ${text(16, 35, fixed ? "FIX: -PCB angle, then supplier offset" : "MAIN: PCB angle + supplier offset", 27, color)}
    ${text(16, 70, "Exact uploaded CSV (Designator,Mid X,Mid Y,Layer,Rotation):", 19)}
    <g font-family="DejaVu Sans Mono, monospace">
      ${text(16, 103, `D4,9.000,4.000,bottom,${dAngle}`, 23)}
      ${text(16, 134, `U4,9.000,-4.000,bottom,${uAngle}`, 23)}
    </g>
    ${await rawImage(`calibrated-${variant}-bottom.jpg`, 145)}
    ${annotations}
  </g>`)
}
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1740" height="1570" viewBox="0 0 1740 1570">
<defs>${["main", "proposed"].map((v) => `<marker id="arrow-${v}" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto"><path d="M0,0 L0,6 L9,3 z" fill="${v === "main" ? "#ef4444" : "#4ade80"}"/></marker>`).join("")}</defs>
<rect width="1740" height="1570" fill="#f1f5f9"/>
<g font-family="DejaVu Sans, sans-serif">
${text(24, 42, "Issue 41 | Actual JLCPCB 3D placement preview, same board and supplier models", 29)}
${text(24, 80, "Bottom view. D4 and U4 both have PCB rotation 90° and native CAD Euler (0°,180°,270°).", 24)}
${text(24, 119, "Same calibrated supplier offsets in both uploads: diode C81598 = 0°; SOT-23 C916374 = 180°.", 23)}
${panels.join("\n")}
${text(24, 1430, "Gold rings: expected pad 1 from recorded Circuit JSON. Magenta markers are part of JLCPCB’s viewer.", 23)}
${text(24, 1468, "Controls D3/U3 (PCB 0°): CSV 0°/180° in both uploads. Top controls are identical and aligned in both uploads.", 23)}
${text(24, 1506, "Only D4/U4 angles differ between these two files. No manual component rotation, translation or auto-alignment.", 23)}
${text(24, 1544, "Captured 2026-11-23. This verifies this preview fixture, not every supplier model or manufactured boards. No order/payment.", 21)}
</g></svg>`
await Bun.write(new URL("jlcpcb-bottom-3d-comparison.svg", root), svg)
await Bun.write(
  new URL("jlcpcb-bottom-3d-comparison.png", root),
  new Uint8Array(new Resvg(svg).render().asPng()),
)

const calibration = `<svg xmlns="http://www.w3.org/2000/svg" width="1740" height="1370" viewBox="0 0 1740 1370">
<rect width="1740" height="1370" fill="#f1f5f9"/>
<g font-family="DejaVu Sans, sans-serif">
${text(24, 42, "Supplier-zero control | Actual JLCPCB 3D top-side previews", 29)}
${text(24, 82, "U1 PCB angle = 0°. The chosen C916374 model needs +180° to match this authored footprint.", 25)}
<g transform="translate(20,120)">
${text(10, 30, "Unadjusted CSV: U1,-9.000,-4.000,top,0", 24, "#b91c1c")}
${text(10, 66, "Two-lead side is opposite the PCB pads", 23)}
${await rawImage("raw-top.jpg", 90)}
</g>
<g transform="translate(880,120)">
${text(10, 30, "Calibrated CSV: U1,-9.000,-4.000,top,180", 24, "#047857")}
${text(10, 66, "Two-lead side and pin-1 dot match the pads", 23)}
${await rawImage("calibrated-main-top.jpg", 90)}
</g>
${text(24, 1320, "Apply this same +180° to every U row, on both sides, in both A/B files. Diode rows keep their 0° supplier offset.", 23)}
${text(24, 1356, "A side-convention error can cancel a supplier-zero error: raw main U4 happens to align while raw U3 does not.", 22)}
</g></svg>`
await Bun.write(new URL("jlcpcb-supplier-zero.svg", root), calibration)
await Bun.write(
  new URL("jlcpcb-supplier-zero.png", root),
  new Uint8Array(new Resvg(calibration).render().asPng()),
)
