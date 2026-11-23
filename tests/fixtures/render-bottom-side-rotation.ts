import type { AnyCircuitElement } from "circuit-json"
import type { PickAndPlaceRow } from "../../src"

// Reconstruct the supplier's zero-angle footprint from each recorded top/0
// control. Interpret bottom CSV angles from above the component, then show
// both the real pads and the CSV placement from above the board.
export const renderBottomSideRotation = (
  circuit: AnyCircuitElement[],
  rows: PickAndPlaceRow[],
): string => {
  const scale = 36
  const panels = rows
    .map((row, index) => {
      const component = circuit.find(
        (e) =>
          e.type === "pcb_component" &&
          e.layer === row.layer &&
          e.footprint_origin?.x === row.mid_x &&
          e.footprint_origin?.y === row.mid_y,
      )
      if (component?.type !== "pcb_component")
        throw new Error("Missing placement")
      const control = circuit.find(
        (e) =>
          e.type === "pcb_component" &&
          e.layer === "top" &&
          e.rotation === 0 &&
          e.center.y === component.center.y,
      )
      if (control?.type !== "pcb_component")
        throw new Error("Missing zero-angle control")
      const pads = circuit.filter(
        (e) =>
          e.type === "pcb_smtpad" &&
          e.pcb_component_id === component.pcb_component_id,
      )
      const referencePads = circuit.filter(
        (e) =>
          e.type === "pcb_smtpad" &&
          e.pcb_component_id === control.pcb_component_id,
      )
      const x = 18 + (index % 4) * 244
      const y = 100 + Math.floor(index / 4) * 275
      const boardPads = pads
        .map((pad) => {
          if (pad.type !== "pcb_smtpad" || pad.shape !== "rect")
            throw new Error("Expected rectangular pad")
          const px = (pad.x - row.mid_x) * scale
          const py = -(pad.y - row.mid_y) * scale
          const pin = pad.port_hints?.[0]
          return `<rect x="${(px - (pad.width * scale) / 2).toFixed(2)}" y="${(py - (pad.height * scale) / 2).toFixed(2)}" width="${(pad.width * scale).toFixed(2)}" height="${(pad.height * scale).toFixed(2)}" fill="${pin === "1" ? "#fbbf24" : "#64748b"}"/>
        <text x="${px.toFixed(2)}" y="${(py + 5).toFixed(2)}" fill="#0f172a" text-anchor="middle" font-size="13">${pin}</text>`
        })
        .join("\n")
      const csvPads = referencePads
        .map((pad) => {
          if (pad.type !== "pcb_smtpad" || pad.shape !== "rect")
            throw new Error("Expected rectangular pad")
          const px = (pad.x - control.center.x) * scale
          const py = -(pad.y - control.center.y) * scale
          return `<rect x="${(px - (pad.width * scale) / 2).toFixed(2)}" y="${(py - (pad.height * scale) / 2).toFixed(2)}" width="${(pad.width * scale).toFixed(2)}" height="${(pad.height * scale).toFixed(2)}" fill="none" stroke="#67e8f9" stroke-width="2"/>
        ${pad.port_hints?.[0] === "1" ? `<circle cx="${px.toFixed(2)}" cy="${py.toFixed(2)}" r="11" fill="none" stroke="#67e8f9" stroke-width="3"/>` : ""}`
        })
        .join("\n")
      return `<g transform="translate(${x},${y})">
      <rect width="232" height="260" rx="10" fill="#172033" stroke="#334155"/>
      <text x="116" y="28" text-anchor="middle" fill="#f8fafc" font-size="18">${row.designator} · ${row.layer}</text>
      <text x="116" y="52" text-anchor="middle" fill="#67e8f9" font-size="16">PCB ${component.rotation}° · CSV ${row.rotation}°</text>
      <g transform="translate(116,157)">${boardPads}
        <g transform="rotate(${row.layer === "bottom" ? row.rotation : -row.rotation}) scale(${row.layer === "bottom" ? -1 : 1},1)">${csvPads}</g>
      </g>
    </g>`
    })
    .join("\n")
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="675" viewBox="0 0 1000 675">
  <rect width="1000" height="675" fill="#0f172a"/>
  <g font-family="Arial, sans-serif">
    <text x="24" y="34" fill="#f8fafc" font-size="24">Local component-view hypothesis · top view</text>
    <text x="24" y="64" fill="#cbd5e1" font-size="16">Solid pads: Circuit JSON · cyan outlines: CSV placement · gold pad and cyan ring: pin 1</text>
    ${panels}
    <text x="24" y="658" fill="#94a3b8" font-size="14">Recorded SOD-123 / SOT-23 controls. Zero offset assumed. This is a local reconstruction, not JLCPCB UI.</text>
  </g>
</svg>`
}
