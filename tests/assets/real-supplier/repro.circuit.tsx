// Same two polarised parts, four times each: top at 0 and 90, bottom at 0 and 90.
// The diode shows polarity (pad 1 / pad 2); the SOT-23 is asymmetric, so it also
// tells a mirror image from a turn.
export default () => (
  <board width="24mm" height="16mm">
    <diode name="D1" supplierPartNumbers={{ jlcpcb: ["C81598"] }} footprint="sod123" pcbX={-9} pcbY={4} pcbRotation={0} layer="top" />
    <diode name="D2" supplierPartNumbers={{ jlcpcb: ["C81598"] }} footprint="sod123" pcbX={-3} pcbY={4} pcbRotation={90} layer="top" />
    <diode name="D3" supplierPartNumbers={{ jlcpcb: ["C81598"] }} footprint="sod123" pcbX={3} pcbY={4} pcbRotation={0} layer="bottom" />
    <diode name="D4" supplierPartNumbers={{ jlcpcb: ["C81598"] }} footprint="sod123" pcbX={9} pcbY={4} pcbRotation={90} layer="bottom" />
    <chip name="U1" supplierPartNumbers={{ jlcpcb: ["C916374"] }} footprint="sot23" pcbX={-9} pcbY={-4} pcbRotation={0} layer="top" />
    <chip name="U2" supplierPartNumbers={{ jlcpcb: ["C916374"] }} footprint="sot23" pcbX={-3} pcbY={-4} pcbRotation={90} layer="top" />
    <chip name="U3" supplierPartNumbers={{ jlcpcb: ["C916374"] }} footprint="sot23" pcbX={3} pcbY={-4} pcbRotation={0} layer="bottom" />
    <chip name="U4" supplierPartNumbers={{ jlcpcb: ["C916374"] }} footprint="sot23" pcbX={9} pcbY={-4} pcbRotation={90} layer="bottom" />
  </board>
)
