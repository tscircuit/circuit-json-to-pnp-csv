import { Resvg } from "@resvg/resvg-js"
const root = new URL("./full-pipeline/", import.meta.url)
const esc = (s: string) =>
  s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
const text = (
  x: number,
  y: number,
  s: string,
  size = 23,
  color = "#0f172a",
  bold = false,
) =>
  `<text x="${x}" y="${y}" font-size="${size}" fill="${color}" font-weight="${bold ? 700 : 400}">${esc(s)}</text>`
const reproCsv = await Bun.file(new URL("CPL-repro-generated.csv", root)).text()
const fixCsv = await Bun.file(new URL("CPL-generated.csv", root)).text()
const panels = []
for (const [i, variant] of ["repro", "fix"].entries()) {
  const filename =
    variant === "repro"
      ? "repro-generated-bottom.jpg"
      : "final-generated-bottom.jpg"
  const photo = Buffer.from(
    await Bun.file(new URL(`jlcpcb/${filename}`, root)).arrayBuffer(),
  ).toString("base64")
  const csv = variant === "repro" ? reproCsv : fixCsv
  const rows = csv
    .split(/\r?\n/)
    .filter((row) => row.startsWith("D4,") || row.startsWith("U4,"))
  const color = variant === "repro" ? "#b91c1c" : "#047857"
  panels.push(`<g transform="translate(${24 + i * 858},146)">
 <rect width="834" height="960" rx="12" fill="white" stroke="#cbd5e1"/>
 ${text(20, 40, variant === "repro" ? "REPRO | automatic supplier CAD, wrong side angle" : "FIX | automatic supplier CAD + correct side angle", 24, color, true)}
 <g font-family="DejaVu Sans Mono, monospace">${rows.map((row, n) => text(20, 79 + n * 31, row, 24)).join("")}</g>
 <g transform="translate(86,132) scale(1.5)">
 <svg width="424" height="534" viewBox="0 0 424 534" overflow="hidden"><image width="424" height="571" href="data:image/jpeg;base64,${photo}"/></svg>
 <g fill="none" stroke="#fbbf24" stroke-width="2.3"><circle cx="54" cy="213" r="12"/><circle cx="76" cy="385" r="12"/></g>
 <g stroke="${color}" stroke-width="2.5" fill="none"><path d="M80 203 L114 185 L168 185"/><path d="M91 380 L120 353 L217 353"/></g>
 ${text(119, 177, "D4: pad 1 / cathode", 12, "#fff", true)}
 ${text(124, 345, "U4: expected pad 1", 12, "#fff", true)}
 </g>
 ${text(22, 937, variant === "repro" ? "D4 band faces pad 2; U4 two-lead side misses the upper pads." : "D4 cathode and U4 numbered lead frame match the board pads.", 20, color, true)}
 </g>`)
}
const table = [
  ["Part", "PCB rotation", "Native CAD z", "JLCPCB CSV"],
  ["D4 bottom", "90°", "270°", "270°"],
  ["U3 bottom", "0°", "0°", "180°"],
  ["U4 bottom", "90°", "270°", "90°"],
]
const tableText = table
  .map((row, r) =>
    row
      .map((v, c) =>
        text(
          895 + c * 195,
          1190 + r * 36,
          v,
          22,
          r === 0 ? "#334155" : "#0f172a",
          r === 0,
        ),
      )
      .join(""),
  )
  .join("")
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1740" height="1690" viewBox="0 0 1740 1690">
<rect width="1740" height="1690" fill="#f1f5f9"/><g font-family="DejaVu Sans, sans-serif">
${text(26, 42, "Automatic Core → Circuit JSON → CLI → JLCPCB | no manual offsets", 33, "#0f172a", true)}
${text(26, 82, "Actual JLCPCB 3D captures. C81598 diode + C916374 SOT-23. Same 24 × 16 mm copper and pad geometry.", 25)}
${text(26, 119, "Gold rings identify expected Circuit JSON pad 1. No rotate, translate or auto-align was used in JLCPCB.", 24)}
${panels.join("\n")}
${text(26, 1158, "Exact fixed CSV extracted from the CLI fabrication ZIP", 25, "#0f172a", true)}
<g font-family="DejaVu Sans Mono, monospace">${fixCsv
  .split(/\r?\n/)
  .map((row, i) => text(26, 1200 + i * 31, row, 23))
  .join("")}</g>
${tableText}
${text(895, 1344, "SOT-23 authored frame: leftside_top", 23)}
${text(895, 1378, "Real supplier CAD frame: rightside_bottom → +180°", 23, "#047857", true)}
${text(895, 1412, "Bottom CSV = normalize(−PCB angle + CAD difference)", 22)}
${text(895, 1446, "Factory zero is absent, not a manually supplied +180°.", 22, "#9a3412", true)}
${text(26, 1522, "Top-side controls align in the separate raw top capture. Native CAD Euler z is not a vendor CSV angle.", 25, "#0f172a", true)}
${text(26, 1566, "CSV SHA-256: a174e597838bee42edb4a260dc805e2f84ce4eb6ea9a5546a4c0c01d473f6361", 20)}
${text(26, 1605, "The live supplier response contains no factory assembly offset. CLI warns; unknown stays distinct from confirmed zero.", 22)}
${text(26, 1650, "Both TSX and prebuilt JSON exports produce these identical CSV bytes. No order or payment was submitted.", 23)}
</g></svg>`
await Bun.write(new URL("jlcpcb-automatic-comparison.svg", root), svg)
await Bun.write(
  new URL("jlcpcb-automatic-comparison.png", root),
  new Uint8Array(new Resvg(svg).render().asPng()),
)
