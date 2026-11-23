import { Resvg } from "@resvg/resvg-js"

const root = new URL("./", import.meta.url)
const text = (
  x: number,
  y: number,
  value: string,
  size = 23,
  color = "#0f172a",
) =>
  `<text x="${x}" y="${y}" font-size="${size}" fill="${color}">${value}</text>`
const panels: string[] = []
for (const [i, side] of ["top", "bottom"].entries()) {
  const capture = Buffer.from(
    await Bun.file(
      new URL(`jlcpcb/actual-exporter-${side}.jpg`, root),
    ).arrayBuffer(),
  ).toString("base64")
  panels.push(`<g transform="translate(${20 + i * 860},155)">
    ${text(10, 30, `${side.toUpperCase()} | unchanged built exporter output`, 26)}
    <g font-family="DejaVu Sans Mono, monospace">
      ${text(10, 68, side === "top" ? "U1,-9.000,-4.000,top,0" : "U3,3.000,-4.000,bottom,0")}
      ${text(10, 100, side === "top" ? "U2,-3.000,-4.000,top,90" : "U4,9.000,-4.000,bottom,270")}
    </g>
    <svg x="0" y="120" width="820" height="1070" viewBox="0 0 820 1070" overflow="hidden"><image width="1680" height="2268" href="data:image/jpeg;base64,${capture}"/></svg>
  </g>`)
}
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1740" height="1520" viewBox="0 0 1740 1520">
<rect width="1740" height="1520" fill="#f1f5f9"/>
<g font-family="DejaVu Sans, sans-serif">
${text(24, 42, "Actual exporter output uploaded unchanged | #43 does not fix supplier-zero discovery", 29)}
${text(24, 83, "Original reporter JSON; built exporter 303524d; supplier: jlcpcb. No input metadata or CSV angle edits.", 24)}
${text(24, 121, "Result: D4's side angle is corrected, but SOT-23 leads still do not align. Eight missing-supplier-metadata warnings.", 23, "#b91c1c")}
${panels.join("\n")}
${text(24, 1390, "These are actual JLCPCB 3D captures of CPL-actual-exporter.csv, without the earlier manual +180° calibration.", 23)}
${text(24, 1428, "The reporter JSON has no selected supplier part numbers or supplier pin-1 map. The preparation helper changes nothing.", 23)}
${text(24, 1466, "CSV SHA-256: 7c8afcde37f5bb98ab67cf1e28329cbe6633cda1ab0912ad41c054b268a02e6c", 21)}
${text(24, 1502, "No manual rotation/translation/auto-alignment in JLCPCB. No order or payment. Separate supplier-data integration is needed.", 22)}
</g></svg>`
await Bun.write(new URL("jlcpcb-actual-exporter.svg", root), svg)
await Bun.write(
  new URL("jlcpcb-actual-exporter.png", root),
  new Uint8Array(new Resvg(svg).render().asPng()),
)
