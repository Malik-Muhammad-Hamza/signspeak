//description
import * as fp from "fingerpose";

const aSign = new fp.GestureDescription("A");

// A should be a fist with the thumb exposed/sticking out.
// Thumb must be mostly straight, not closed inside the fist.
aSign.addCurl(fp.Finger.Thumb, fp.FingerCurl.NoCurl, 1.0);

// Thumb direction tolerance because camera mirroring/angle changes the direction.
aSign.addDirection(fp.Finger.Thumb, fp.FingerDirection.VerticalUp, 0.8);
aSign.addDirection(fp.Finger.Thumb, fp.FingerDirection.DiagonalUpLeft, 0.8);
aSign.addDirection(fp.Finger.Thumb, fp.FingerDirection.DiagonalUpRight, 0.8);
aSign.addDirection(fp.Finger.Thumb, fp.FingerDirection.HorizontalLeft, 0.7);
aSign.addDirection(fp.Finger.Thumb, fp.FingerDirection.HorizontalRight, 0.7);

// Index, middle, ring, and pinky must be fully curled.
for (const finger of [
  fp.Finger.Index,
  fp.Finger.Middle,
  fp.Finger.Ring,
  fp.Finger.Pinky,
]) {
  aSign.addCurl(finger, fp.FingerCurl.FullCurl, 1.0);
}

// 2. B Sign
const bSign = new fp.GestureDescription("B");
// Index, middle, ring, and pinky should be straight/no curl and vertical up.
for (let finger of [fp.Finger.Index, fp.Finger.Middle, fp.Finger.Ring, fp.Finger.Pinky]) {
  bSign.addCurl(finger, fp.FingerCurl.NoCurl, 1.0);
  bSign.addDirection(finger, fp.FingerDirection.VerticalUp, 1.0);
  bSign.addDirection(finger, fp.FingerDirection.DiagonalUpLeft, 0.5);
  bSign.addDirection(finger, fp.FingerDirection.DiagonalUpRight, 0.5);
}
// Thumb should be fully curled/tucked inside the palm — NOT extended.
bSign.addCurl(fp.Finger.Thumb, fp.FingerCurl.FullCurl, 1.0);
bSign.addCurl(fp.Finger.Thumb, fp.FingerCurl.HalfCurl, 0.6);

// 3. C Sign
const cSign = new fp.GestureDescription("C");
// All fingers should be half curl or slightly no curl.
for (let finger of [fp.Finger.Thumb, fp.Finger.Index, fp.Finger.Middle, fp.Finger.Ring, fp.Finger.Pinky]) {
  cSign.addCurl(finger, fp.FingerCurl.HalfCurl, 1.0);
  cSign.addCurl(finger, fp.FingerCurl.NoCurl, 0.5);
}

// 4. D Sign
const dSign = new fp.GestureDescription("D");
// Index should be straight/no curl and vertical up.
dSign.addCurl(fp.Finger.Index, fp.FingerCurl.NoCurl, 1.0);
dSign.addDirection(fp.Finger.Index, fp.FingerDirection.VerticalUp, 1.0);
dSign.addDirection(fp.Finger.Index, fp.FingerDirection.DiagonalUpLeft, 0.6);
dSign.addDirection(fp.Finger.Index, fp.FingerDirection.DiagonalUpRight, 0.6);
// Middle, ring, and pinky should be curled.
for (const finger of [fp.Finger.Middle, fp.Finger.Ring, fp.Finger.Pinky]) {
  dSign.addCurl(finger, fp.FingerCurl.FullCurl, 1.0);
  dSign.addCurl(finger, fp.FingerCurl.HalfCurl, 0.5);
}
// Thumb should be visible/active (near index/curled area) for D — NOT fully tucked.
dSign.addCurl(fp.Finger.Thumb, fp.FingerCurl.HalfCurl, 1.0);
dSign.addCurl(fp.Finger.Thumb, fp.FingerCurl.NoCurl, 0.7);

// 5. L Sign
const lSign = new fp.GestureDescription("L");
// Index straight/no curl and vertical up.
lSign.addCurl(fp.Finger.Index, fp.FingerCurl.NoCurl, 1.0);
lSign.addDirection(fp.Finger.Index, fp.FingerDirection.VerticalUp, 1.0);
lSign.addDirection(fp.Finger.Index, fp.FingerDirection.DiagonalUpLeft, 0.5);
lSign.addDirection(fp.Finger.Index, fp.FingerDirection.DiagonalUpRight, 0.5);
// Thumb straight/no curl and horizontal left/right.
lSign.addCurl(fp.Finger.Thumb, fp.FingerCurl.NoCurl, 1.0);
lSign.addDirection(fp.Finger.Thumb, fp.FingerDirection.HorizontalLeft, 1.0);
lSign.addDirection(fp.Finger.Thumb, fp.FingerDirection.HorizontalRight, 1.0);
// Middle, ring, and pinky curled.
for (let finger of [fp.Finger.Middle, fp.Finger.Ring, fp.Finger.Pinky]) {
  lSign.addCurl(finger, fp.FingerCurl.FullCurl, 1.0);
  lSign.addCurl(finger, fp.FingerCurl.HalfCurl, 0.5);
}

// 6. V Sign
const vSign = new fp.GestureDescription("V");
// Index and middle straight/no curl and vertical/diagonal up.
for (let finger of [fp.Finger.Index, fp.Finger.Middle]) {
  vSign.addCurl(finger, fp.FingerCurl.NoCurl, 1.0);
  vSign.addDirection(finger, fp.FingerDirection.VerticalUp, 1.0);
  vSign.addDirection(finger, fp.FingerDirection.DiagonalUpLeft, 1.0);
  vSign.addDirection(finger, fp.FingerDirection.DiagonalUpRight, 1.0);
}
// Ring and pinky curled.
for (let finger of [fp.Finger.Ring, fp.Finger.Pinky]) {
  vSign.addCurl(finger, fp.FingerCurl.FullCurl, 1.0);
  vSign.addCurl(finger, fp.FingerCurl.HalfCurl, 0.5);
}
// Thumb curled or half curled.
vSign.addCurl(fp.Finger.Thumb, fp.FingerCurl.HalfCurl, 1.0);
vSign.addCurl(fp.Finger.Thumb, fp.FingerCurl.FullCurl, 1.0);

// 7. Y Sign
const ySign = new fp.GestureDescription("Y");
// Thumb straight/no curl and horizontal or diagonal.
ySign.addCurl(fp.Finger.Thumb, fp.FingerCurl.NoCurl, 1.0);
ySign.addDirection(fp.Finger.Thumb, fp.FingerDirection.HorizontalLeft, 1.0);
ySign.addDirection(fp.Finger.Thumb, fp.FingerDirection.HorizontalRight, 1.0);
ySign.addDirection(fp.Finger.Thumb, fp.FingerDirection.DiagonalUpLeft, 1.0);
ySign.addDirection(fp.Finger.Thumb, fp.FingerDirection.DiagonalUpRight, 1.0);
// Pinky straight/no curl.
ySign.addCurl(fp.Finger.Pinky, fp.FingerCurl.NoCurl, 1.0);
// Index, middle, and ring curled.
for (let finger of [fp.Finger.Index, fp.Finger.Middle, fp.Finger.Ring]) {
  ySign.addCurl(finger, fp.FingerCurl.FullCurl, 1.0);
  ySign.addCurl(finger, fp.FingerCurl.HalfCurl, 0.5);
}

// 8. I Sign
const iSign = new fp.GestureDescription("I");
// Pinky straight/no curl and vertical up.
iSign.addCurl(fp.Finger.Pinky, fp.FingerCurl.NoCurl, 1.0);
iSign.addDirection(fp.Finger.Pinky, fp.FingerDirection.VerticalUp, 1.0);
iSign.addDirection(fp.Finger.Pinky, fp.FingerDirection.DiagonalUpLeft, 0.5);
iSign.addDirection(fp.Finger.Pinky, fp.FingerDirection.DiagonalUpRight, 0.5);
// Thumb, index, middle, and ring curled.
for (let finger of [fp.Finger.Thumb, fp.Finger.Index, fp.Finger.Middle, fp.Finger.Ring]) {
  iSign.addCurl(finger, fp.FingerCurl.FullCurl, 1.0);
  iSign.addCurl(finger, fp.FingerCurl.HalfCurl, 0.5);
}

// 9. O Sign
const oSign = new fp.GestureDescription("O");
// All fingers should be half curled/full curled enough to form a rounded O.
for (let finger of [fp.Finger.Thumb, fp.Finger.Index, fp.Finger.Middle, fp.Finger.Ring, fp.Finger.Pinky]) {
  oSign.addCurl(finger, fp.FingerCurl.HalfCurl, 1.0);
  oSign.addCurl(finger, fp.FingerCurl.FullCurl, 0.5);
  oSign.addDirection(finger, fp.FingerDirection.DiagonalUpLeft, 0.5);
  oSign.addDirection(finger, fp.FingerDirection.DiagonalUpRight, 0.5);
  oSign.addDirection(finger, fp.FingerDirection.VerticalUp, 0.5);
}

// 10. W Sign
const wSign = new fp.GestureDescription("W");
// Index, middle, and ring straight/no curl and vertical up.
for (let finger of [fp.Finger.Index, fp.Finger.Middle, fp.Finger.Ring]) {
  wSign.addCurl(finger, fp.FingerCurl.NoCurl, 1.0);
  wSign.addDirection(finger, fp.FingerDirection.VerticalUp, 1.0);
  wSign.addDirection(finger, fp.FingerDirection.DiagonalUpLeft, 0.5);
  wSign.addDirection(finger, fp.FingerDirection.DiagonalUpRight, 0.5);
}
// Pinky curled.
wSign.addCurl(fp.Finger.Pinky, fp.FingerCurl.FullCurl, 1.0);
wSign.addCurl(fp.Finger.Pinky, fp.FingerCurl.HalfCurl, 0.5);
// Thumb curled/half curled.
wSign.addCurl(fp.Finger.Thumb, fp.FingerCurl.HalfCurl, 1.0);
wSign.addCurl(fp.Finger.Thumb, fp.FingerCurl.FullCurl, 1.0);

// 11. M Sign
// Tight closed fist — fingers FULLY curled into the palm, thumb tucked inside.
// Key difference from A: thumb is curled/hidden, NOT exposed.
// Key difference from E: E fingers are BENT/HOOKED (HalfCurl dominant);
//   M fingers are FULLY CLOSED (FullCurl dominant, very low HalfCurl tolerance).
// No direction rules — fist orientation varies too much with hand tilt.
const mSign = new fp.GestureDescription("M");

for (const finger of [
  fp.Finger.Index,
  fp.Finger.Middle,
  fp.Finger.Ring,
  fp.Finger.Pinky,
]) {
  mSign.addCurl(finger, fp.FingerCurl.FullCurl, 1.0);
  // Low HalfCurl tolerance — M is a tight fist, not a bent/hooked hand.
  mSign.addCurl(finger, fp.FingerCurl.HalfCurl, 0.3);
}

// Thumb must be curled (tucked inside), never straight/exposed like A.
mSign.addCurl(fp.Finger.Thumb, fp.FingerCurl.FullCurl, 1.0);
mSign.addCurl(fp.Finger.Thumb, fp.FingerCurl.HalfCurl, 0.8);

// 12. Z Sign
// Simplified static pose: index finger extended, thumb FULLY TUCKED.
// Key difference from D: D has thumb exposed/near fingers; Z has thumb curled/closed.
// Note: Real ASL Z is a dynamic motion gesture (drawing Z in the air).
const zSign = new fp.GestureDescription("Z");

zSign.addCurl(fp.Finger.Index, fp.FingerCurl.NoCurl, 1.0);
zSign.addDirection(fp.Finger.Index, fp.FingerDirection.VerticalUp, 1.0);
zSign.addDirection(fp.Finger.Index, fp.FingerDirection.DiagonalUpLeft, 0.8);
zSign.addDirection(fp.Finger.Index, fp.FingerDirection.DiagonalUpRight, 0.8);

for (const finger of [fp.Finger.Middle, fp.Finger.Ring, fp.Finger.Pinky]) {
  zSign.addCurl(finger, fp.FingerCurl.FullCurl, 1.0);
  zSign.addCurl(finger, fp.FingerCurl.HalfCurl, 0.5);
}

// Thumb must be tucked/closed for Z — this is the primary D vs Z discriminator.
zSign.addCurl(fp.Finger.Thumb, fp.FingerCurl.FullCurl, 1.0);
zSign.addCurl(fp.Finger.Thumb, fp.FingerCurl.HalfCurl, 0.8);

// 13. H Sign
// Index and middle fingers extended horizontally (sideways).
// Key difference from V: V points upward/diagonal-up; H points horizontal.
const hSign = new fp.GestureDescription("H");

for (const finger of [fp.Finger.Index, fp.Finger.Middle]) {
  hSign.addCurl(finger, fp.FingerCurl.NoCurl, 1.0);
  hSign.addDirection(finger, fp.FingerDirection.HorizontalLeft, 1.0);
  hSign.addDirection(finger, fp.FingerDirection.HorizontalRight, 1.0);
  hSign.addDirection(finger, fp.FingerDirection.DiagonalUpLeft, 0.4);
  hSign.addDirection(finger, fp.FingerDirection.DiagonalUpRight, 0.4);
  hSign.addDirection(finger, fp.FingerDirection.DiagonalDownLeft, 0.4);
  hSign.addDirection(finger, fp.FingerDirection.DiagonalDownRight, 0.4);
}

for (const finger of [fp.Finger.Thumb, fp.Finger.Ring, fp.Finger.Pinky]) {
  hSign.addCurl(finger, fp.FingerCurl.FullCurl, 1.0);
  hSign.addCurl(finger, fp.FingerCurl.HalfCurl, 0.5);
}

// 14. E Sign
// ASL E: All four fingers bent/hooked DOWNWARD, fingertips pointing forward/down.
// Thumb tucked alongside/under the bent fingers.
// M takes priority: M has no direction constraints and scores 10 on any tight fist.
// E only scores well when fingerpose reads curled fingers as DiagonalDown/Horizontal.
const eSign = new fp.GestureDescription("E");

// Thumb: HalfCurl alongside/under the bent fingers.
eSign.addCurl(fp.Finger.Thumb, fp.FingerCurl.HalfCurl, 1.0);
eSign.addCurl(fp.Finger.Thumb, fp.FingerCurl.FullCurl, 0.5);
eSign.addDirection(fp.Finger.Thumb, fp.FingerDirection.HorizontalLeft, 0.7);
eSign.addDirection(fp.Finger.Thumb, fp.FingerDirection.HorizontalRight, 0.7);
eSign.addDirection(fp.Finger.Thumb, fp.FingerDirection.DiagonalUpLeft, 0.4);
eSign.addDirection(fp.Finger.Thumb, fp.FingerDirection.DiagonalUpRight, 0.4);

// Index: FullCurl primary — bent/hooked downward.
eSign.addCurl(fp.Finger.Index, fp.FingerCurl.FullCurl, 1.0);
eSign.addCurl(fp.Finger.Index, fp.FingerCurl.HalfCurl, 0.7);
eSign.addDirection(fp.Finger.Index, fp.FingerDirection.DiagonalDownLeft, 0.8);
eSign.addDirection(fp.Finger.Index, fp.FingerDirection.DiagonalDownRight, 0.8);
eSign.addDirection(fp.Finger.Index, fp.FingerDirection.HorizontalLeft, 0.5);
eSign.addDirection(fp.Finger.Index, fp.FingerDirection.HorizontalRight, 0.5);

// Middle, Ring, Pinky: FullCurl, tips curled downward/forward.
for (const finger of [
  fp.Finger.Middle,
  fp.Finger.Ring,
  fp.Finger.Pinky,
]) {
  eSign.addCurl(finger, fp.FingerCurl.FullCurl, 1.0);
  eSign.addCurl(finger, fp.FingerCurl.HalfCurl, 0.5);
  eSign.addDirection(finger, fp.FingerDirection.DiagonalDownLeft, 0.7);
  eSign.addDirection(finger, fp.FingerDirection.DiagonalDownRight, 0.7);
  eSign.addDirection(finger, fp.FingerDirection.HorizontalLeft, 0.5);
  eSign.addDirection(finger, fp.FingerDirection.HorizontalRight, 0.5);
}
// 15. F Sign
// Thumb and index form a small loop/circle; middle, ring, pinky extended upward.
// Resembles an OK sign.
const fSign = new fp.GestureDescription("F");

// Thumb and index curl to form the loop.
fSign.addCurl(fp.Finger.Thumb, fp.FingerCurl.HalfCurl, 1.0);
fSign.addCurl(fp.Finger.Thumb, fp.FingerCurl.FullCurl, 0.7);

fSign.addCurl(fp.Finger.Index, fp.FingerCurl.HalfCurl, 1.0);
fSign.addCurl(fp.Finger.Index, fp.FingerCurl.FullCurl, 0.7);

// Middle, ring, pinky extended upward.
for (const finger of [fp.Finger.Middle, fp.Finger.Ring, fp.Finger.Pinky]) {
  fSign.addCurl(finger, fp.FingerCurl.NoCurl, 1.0);
  fSign.addDirection(finger, fp.FingerDirection.VerticalUp, 1.0);
  fSign.addDirection(finger, fp.FingerDirection.DiagonalUpLeft, 0.6);
  fSign.addDirection(finger, fp.FingerDirection.DiagonalUpRight, 0.6);
}

// 16. G Sign
// G has the index finger extended sideways/forward and the thumb visible near/below it.
// Middle, ring, and pinky are curled. Shown side-facing.
// Key difference from L: L has index pointing UP with thumb horizontal.
//   G has index pointing HORIZONTAL/SIDEWAYS with thumb also visible (not tucked).
// Key difference from M/Z: thumb must NOT be fully hidden; HalfCurl or NoCurl allowed.
const gSign = new fp.GestureDescription("G");

// Index finger extended sideways/forward.
gSign.addCurl(fp.Finger.Index, fp.FingerCurl.NoCurl, 1.0);
gSign.addDirection(fp.Finger.Index, fp.FingerDirection.HorizontalLeft, 1.0);
gSign.addDirection(fp.Finger.Index, fp.FingerDirection.HorizontalRight, 1.0);
gSign.addDirection(fp.Finger.Index, fp.FingerDirection.DiagonalUpLeft, 0.4);
gSign.addDirection(fp.Finger.Index, fp.FingerDirection.DiagonalUpRight, 0.4);
gSign.addDirection(fp.Finger.Index, fp.FingerDirection.DiagonalDownLeft, 0.4);
gSign.addDirection(fp.Finger.Index, fp.FingerDirection.DiagonalDownRight, 0.4);

// Thumb visible below/near the index finger — not hidden inside the fist.
// HalfCurl is the primary state (thumb bent slightly, pointing sideways);
// NoCurl is also accepted but weighted lower.
gSign.addCurl(fp.Finger.Thumb, fp.FingerCurl.HalfCurl, 1.0);
gSign.addCurl(fp.Finger.Thumb, fp.FingerCurl.NoCurl, 0.8);
gSign.addDirection(fp.Finger.Thumb, fp.FingerDirection.HorizontalLeft, 0.8);
gSign.addDirection(fp.Finger.Thumb, fp.FingerDirection.HorizontalRight, 0.8);
gSign.addDirection(fp.Finger.Thumb, fp.FingerDirection.DiagonalUpLeft, 0.4);
gSign.addDirection(fp.Finger.Thumb, fp.FingerDirection.DiagonalUpRight, 0.4);
gSign.addDirection(fp.Finger.Thumb, fp.FingerDirection.DiagonalDownLeft, 0.4);
gSign.addDirection(fp.Finger.Thumb, fp.FingerDirection.DiagonalDownRight, 0.4);

// Middle, ring, and pinky curled into the palm.
for (const finger of [fp.Finger.Middle, fp.Finger.Ring, fp.Finger.Pinky]) {
  gSign.addCurl(finger, fp.FingerCurl.FullCurl, 1.0);
  gSign.addCurl(finger, fp.FingerCurl.HalfCurl, 0.5);
}

export const gestureDescriptions = [
  aSign,
  bSign,
  cSign,
  dSign,
  lSign,
  vSign,
  ySign,
  iSign,
  oSign,
  wSign,
  mSign,
  zSign,
  hSign,
  eSign,
  fSign,
  gSign,
];

export const supportedLetters = ["A", "B", "C", "D", "L", "V", "Y", "I", "O", "W", "M", "Z", "H", "E", "F", "G"];
