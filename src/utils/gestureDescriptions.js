import * as fp from "fingerpose";

const { GestureDescription, Finger, FingerCurl, FingerDirection } = fp;

// A
const aSign = new GestureDescription("A");
aSign.addCurl(Finger.Thumb, FingerCurl.NoCurl, 1.0);
aSign.addDirection(Finger.Thumb, FingerDirection.VerticalUp, 1.0);
aSign.addDirection(Finger.Thumb, FingerDirection.DiagonalUpLeft, 0.9);
aSign.addDirection(Finger.Thumb, FingerDirection.DiagonalUpRight, 0.9);
for (let finger of [Finger.Index, Finger.Middle, Finger.Ring, Finger.Pinky]) {
  aSign.addCurl(finger, FingerCurl.FullCurl, 1.0);
}

// B
const bSign = new GestureDescription("B");
bSign.addCurl(Finger.Thumb, FingerCurl.HalfCurl, 1.0);
bSign.addCurl(Finger.Thumb, FingerCurl.FullCurl, 0.9);
for (let finger of [Finger.Index, Finger.Middle, Finger.Ring, Finger.Pinky]) {
  bSign.addCurl(finger, FingerCurl.NoCurl, 1.0);
  bSign.addDirection(finger, FingerDirection.VerticalUp, 1.0);
}

// C
const cSign = new GestureDescription("C");

for (const finger of [Finger.Thumb, Finger.Index, Finger.Middle, Finger.Ring, Finger.Pinky]) {
  cSign.addCurl(finger, FingerCurl.HalfCurl, 1.0);
  cSign.addCurl(finger, FingerCurl.NoCurl, 0.6);
}

// D
const dSign = new GestureDescription("D");
dSign.addCurl(Finger.Index, FingerCurl.NoCurl, 1.0);
dSign.addDirection(Finger.Index, FingerDirection.VerticalUp, 1.0);
for (let finger of [Finger.Thumb, Finger.Middle, Finger.Ring, Finger.Pinky]) {
  dSign.addCurl(finger, FingerCurl.HalfCurl, 1.0);
  dSign.addCurl(finger, FingerCurl.FullCurl, 0.9);
}

// L
const lSign = new GestureDescription("L");
lSign.addCurl(Finger.Index, FingerCurl.NoCurl, 1.0);
lSign.addDirection(Finger.Index, FingerDirection.VerticalUp, 1.0);
lSign.addCurl(Finger.Thumb, FingerCurl.NoCurl, 1.0);
lSign.addDirection(Finger.Thumb, FingerDirection.HorizontalLeft, 1.0);
lSign.addDirection(Finger.Thumb, FingerDirection.HorizontalRight, 1.0);
for (let finger of [Finger.Middle, Finger.Ring, Finger.Pinky]) {
  lSign.addCurl(finger, FingerCurl.FullCurl, 1.0);
}

// V
const vSign = new GestureDescription("V");
vSign.addCurl(Finger.Index, FingerCurl.NoCurl, 1.0);
vSign.addDirection(Finger.Index, FingerDirection.VerticalUp, 1.0);
vSign.addDirection(Finger.Index, FingerDirection.DiagonalUpLeft, 1.0);
vSign.addDirection(Finger.Index, FingerDirection.DiagonalUpRight, 1.0);

vSign.addCurl(Finger.Middle, FingerCurl.NoCurl, 1.0);
vSign.addDirection(Finger.Middle, FingerDirection.VerticalUp, 1.0);
vSign.addDirection(Finger.Middle, FingerDirection.DiagonalUpLeft, 1.0);
vSign.addDirection(Finger.Middle, FingerDirection.DiagonalUpRight, 1.0);

for (let finger of [Finger.Thumb, Finger.Ring, Finger.Pinky]) {
  vSign.addCurl(finger, FingerCurl.FullCurl, 1.0);
  vSign.addCurl(finger, FingerCurl.HalfCurl, 0.9);
}

// Y
const ySign = new GestureDescription("Y");
ySign.addCurl(Finger.Thumb, FingerCurl.NoCurl, 1.0);
ySign.addDirection(Finger.Thumb, FingerDirection.DiagonalUpLeft, 1.0);
ySign.addDirection(Finger.Thumb, FingerDirection.DiagonalUpRight, 1.0);
ySign.addDirection(Finger.Thumb, FingerDirection.HorizontalLeft, 1.0);
ySign.addDirection(Finger.Thumb, FingerDirection.HorizontalRight, 1.0);

ySign.addCurl(Finger.Pinky, FingerCurl.NoCurl, 1.0);
ySign.addDirection(Finger.Pinky, FingerDirection.DiagonalUpLeft, 1.0);
ySign.addDirection(Finger.Pinky, FingerDirection.DiagonalUpRight, 1.0);
ySign.addDirection(Finger.Pinky, FingerDirection.HorizontalLeft, 1.0);
ySign.addDirection(Finger.Pinky, FingerDirection.HorizontalRight, 1.0);

for (let finger of [Finger.Index, Finger.Middle, Finger.Ring]) {
  ySign.addCurl(finger, FingerCurl.FullCurl, 1.0);
  ySign.addCurl(finger, FingerCurl.HalfCurl, 0.9);
}

// I
const iSign = new GestureDescription("I");
iSign.addCurl(Finger.Pinky, FingerCurl.NoCurl, 1.0);
iSign.addDirection(Finger.Pinky, FingerDirection.VerticalUp, 1.0);
for (let finger of [Finger.Thumb, Finger.Index, Finger.Middle, Finger.Ring]) {
  iSign.addCurl(finger, FingerCurl.FullCurl, 1.0);
  iSign.addCurl(finger, FingerCurl.HalfCurl, 0.9);
}

// O
const oSign = new GestureDescription("O");

for (const finger of [
  Finger.Thumb,
  Finger.Index,
  Finger.Middle,
  Finger.Ring,
  Finger.Pinky,
]) {
  oSign.addCurl(finger, FingerCurl.HalfCurl, 1.0);
  oSign.addCurl(finger, FingerCurl.FullCurl, 0.5);
}

// Encourage the visible fingers to point generally upward/diagonal,
// so this does not become just a closed fist.
for (const finger of [Finger.Index, Finger.Middle, Finger.Ring, Finger.Pinky]) {
  oSign.addDirection(finger, FingerDirection.VerticalUp, 0.6);
  oSign.addDirection(finger, FingerDirection.DiagonalUpLeft, 0.6);
  oSign.addDirection(finger, FingerDirection.DiagonalUpRight, 0.6);
}

// W
const wSign = new GestureDescription("W");
wSign.addCurl(Finger.Index, FingerCurl.NoCurl, 1.0);
wSign.addCurl(Finger.Middle, FingerCurl.NoCurl, 1.0);
wSign.addCurl(Finger.Ring, FingerCurl.NoCurl, 1.0);
wSign.addDirection(Finger.Index, FingerDirection.VerticalUp, 1.0);
wSign.addDirection(Finger.Middle, FingerDirection.VerticalUp, 1.0);
wSign.addDirection(Finger.Ring, FingerDirection.VerticalUp, 1.0);

wSign.addCurl(Finger.Thumb, FingerCurl.FullCurl, 1.0);
wSign.addCurl(Finger.Thumb, FingerCurl.HalfCurl, 0.9);
wSign.addCurl(Finger.Pinky, FingerCurl.FullCurl, 1.0);
wSign.addCurl(Finger.Pinky, FingerCurl.HalfCurl, 0.9);

// E
const eSign = new GestureDescription("E");
for (let finger of [Finger.Thumb, Finger.Index, Finger.Middle, Finger.Ring, Finger.Pinky]) {
  eSign.addCurl(finger, FingerCurl.FullCurl, 1.0);
  eSign.addCurl(finger, FingerCurl.HalfCurl, 0.9);
}

// F
const fSign = new GestureDescription("F");
fSign.addCurl(Finger.Thumb, FingerCurl.HalfCurl, 1.0);
fSign.addCurl(Finger.Thumb, FingerCurl.FullCurl, 0.9);
fSign.addCurl(Finger.Index, FingerCurl.HalfCurl, 1.0);
fSign.addCurl(Finger.Index, FingerCurl.FullCurl, 0.9);
for (let finger of [Finger.Middle, Finger.Ring, Finger.Pinky]) {
  fSign.addCurl(finger, FingerCurl.NoCurl, 1.0);
  fSign.addDirection(finger, FingerDirection.VerticalUp, 1.0);
}
for (let finger of [Finger.Middle, Finger.Ring, Finger.Pinky]) {
  fSign.addCurl(finger, FingerCurl.NoCurl, 1.0);
  fSign.addDirection(finger, FingerDirection.VerticalUp, 1.0);
  fSign.addDirection(finger, FingerDirection.DiagonalUpLeft, 0.8);
  fSign.addDirection(finger, FingerDirection.DiagonalUpRight, 0.8);
}

// G
const gSign = new GestureDescription("G");
gSign.addCurl(Finger.Thumb, FingerCurl.NoCurl, 1.0);
gSign.addDirection(Finger.Thumb, FingerDirection.HorizontalLeft, 1.0);
gSign.addDirection(Finger.Thumb, FingerDirection.HorizontalRight, 1.0);
gSign.addCurl(Finger.Index, FingerCurl.NoCurl, 1.0);
gSign.addDirection(Finger.Index, FingerDirection.HorizontalLeft, 1.0);
gSign.addDirection(Finger.Index, FingerDirection.HorizontalRight, 1.0);
for (let finger of [Finger.Middle, Finger.Ring, Finger.Pinky]) {
  gSign.addCurl(finger, FingerCurl.FullCurl, 1.0);
  gSign.addCurl(finger, FingerCurl.HalfCurl, 0.9);
}

// H
const hSign = new GestureDescription("H");
hSign.addCurl(Finger.Index, FingerCurl.NoCurl, 1.0);
hSign.addDirection(Finger.Index, FingerDirection.HorizontalLeft, 1.0);
hSign.addDirection(Finger.Index, FingerDirection.HorizontalRight, 1.0);
hSign.addCurl(Finger.Middle, FingerCurl.NoCurl, 1.0);
hSign.addDirection(Finger.Middle, FingerDirection.HorizontalLeft, 1.0);
hSign.addDirection(Finger.Middle, FingerDirection.HorizontalRight, 1.0);
for (let finger of [Finger.Thumb, Finger.Ring, Finger.Pinky]) {
  hSign.addCurl(finger, FingerCurl.FullCurl, 1.0);
  hSign.addCurl(finger, FingerCurl.HalfCurl, 0.9);
}

// J
const jSign = new GestureDescription("J");
jSign.addCurl(Finger.Index, FingerCurl.NoCurl, 1.0);
jSign.addDirection(Finger.Index, FingerDirection.VerticalUp, 1.0);
jSign.addDirection(Finger.Index, FingerDirection.DiagonalUpLeft, 0.8);
jSign.addDirection(Finger.Index, FingerDirection.DiagonalUpRight, 0.8);

jSign.addCurl(Finger.Pinky, FingerCurl.NoCurl, 1.0);
jSign.addDirection(Finger.Pinky, FingerDirection.VerticalUp, 1.0);
jSign.addDirection(Finger.Pinky, FingerDirection.DiagonalUpLeft, 0.8);
jSign.addDirection(Finger.Pinky, FingerDirection.DiagonalUpRight, 0.8);

for (const finger of [Finger.Thumb, Finger.Middle, Finger.Ring]) {
  jSign.addCurl(finger, FingerCurl.FullCurl, 1.0);
  jSign.addCurl(finger, FingerCurl.HalfCurl, 0.8);
}
// All other fingers stay curled.
for (const finger of [Finger.Thumb, Finger.Index, Finger.Middle, Finger.Ring]) {
  jSign.addCurl(finger, FingerCurl.FullCurl, 1.0);
  jSign.addCurl(finger, FingerCurl.HalfCurl, 0.8);
}
// K
const kSign = new GestureDescription("K");
kSign.addCurl(Finger.Index, FingerCurl.NoCurl, 1.0);
kSign.addDirection(Finger.Index, FingerDirection.VerticalUp, 1.0);
kSign.addDirection(Finger.Index, FingerDirection.DiagonalUpLeft, 0.9);
kSign.addDirection(Finger.Index, FingerDirection.DiagonalUpRight, 0.9);
kSign.addCurl(Finger.Middle, FingerCurl.NoCurl, 1.0);
kSign.addDirection(Finger.Middle, FingerDirection.VerticalUp, 1.0);
kSign.addDirection(Finger.Middle, FingerDirection.DiagonalUpLeft, 0.9);
kSign.addDirection(Finger.Middle, FingerDirection.DiagonalUpRight, 0.9);
kSign.addCurl(Finger.Thumb, FingerCurl.NoCurl, 1.0);
kSign.addCurl(Finger.Thumb, FingerCurl.HalfCurl, 0.9);
for (let finger of [Finger.Ring, Finger.Pinky]) {
  kSign.addCurl(finger, FingerCurl.FullCurl, 1.0);
  kSign.addCurl(finger, FingerCurl.HalfCurl, 0.9);
}

// M
const mSign = new GestureDescription("M");
for (let finger of [Finger.Thumb, Finger.Index, Finger.Middle, Finger.Ring, Finger.Pinky]) {
  mSign.addCurl(finger, FingerCurl.FullCurl, 1.0);
  mSign.addCurl(finger, FingerCurl.HalfCurl, 0.9);
}

// N
const nSign = new GestureDescription("N");
for (let finger of [Finger.Thumb, Finger.Index, Finger.Middle, Finger.Ring, Finger.Pinky]) {
  nSign.addCurl(finger, FingerCurl.FullCurl, 1.0);
  nSign.addCurl(finger, FingerCurl.HalfCurl, 0.9);
}

// P
const pSign = new GestureDescription("P");
pSign.addCurl(Finger.Index, FingerCurl.NoCurl, 1.0);
pSign.addDirection(Finger.Index, FingerDirection.VerticalDown, 1.0);
pSign.addDirection(Finger.Index, FingerDirection.DiagonalDownLeft, 1.0);
pSign.addDirection(Finger.Index, FingerDirection.DiagonalDownRight, 1.0);
pSign.addCurl(Finger.Middle, FingerCurl.NoCurl, 1.0);
pSign.addDirection(Finger.Middle, FingerDirection.VerticalDown, 1.0);
pSign.addDirection(Finger.Middle, FingerDirection.DiagonalDownLeft, 1.0);
pSign.addDirection(Finger.Middle, FingerDirection.DiagonalDownRight, 1.0);
pSign.addCurl(Finger.Thumb, FingerCurl.NoCurl, 1.0);
pSign.addCurl(Finger.Thumb, FingerCurl.HalfCurl, 0.9);
for (let finger of [Finger.Ring, Finger.Pinky]) {
  pSign.addCurl(finger, FingerCurl.FullCurl, 1.0);
  pSign.addCurl(finger, FingerCurl.HalfCurl, 0.9);
}

// Q
const qSign = new GestureDescription("Q");
qSign.addCurl(Finger.Thumb, FingerCurl.NoCurl, 1.0);
qSign.addDirection(Finger.Thumb, FingerDirection.VerticalDown, 1.0);
qSign.addDirection(Finger.Thumb, FingerDirection.DiagonalDownLeft, 1.0);
qSign.addDirection(Finger.Thumb, FingerDirection.DiagonalDownRight, 1.0);
qSign.addCurl(Finger.Index, FingerCurl.NoCurl, 1.0);
qSign.addDirection(Finger.Index, FingerDirection.VerticalDown, 1.0);
qSign.addDirection(Finger.Index, FingerDirection.DiagonalDownLeft, 1.0);
qSign.addDirection(Finger.Index, FingerDirection.DiagonalDownRight, 1.0);
for (let finger of [Finger.Middle, Finger.Ring, Finger.Pinky]) {
  qSign.addCurl(finger, FingerCurl.FullCurl, 1.0);
  qSign.addCurl(finger, FingerCurl.HalfCurl, 0.9);
}

// R
const rSign = new GestureDescription("R");
rSign.addCurl(Finger.Index, FingerCurl.NoCurl, 1.0);
rSign.addDirection(Finger.Index, FingerDirection.VerticalUp, 1.0);
rSign.addCurl(Finger.Middle, FingerCurl.NoCurl, 1.0);
rSign.addDirection(Finger.Middle, FingerDirection.VerticalUp, 1.0);
for (let finger of [Finger.Thumb, Finger.Ring, Finger.Pinky]) {
  rSign.addCurl(finger, FingerCurl.FullCurl, 1.0);
  rSign.addCurl(finger, FingerCurl.HalfCurl, 0.9);
}

// S
const sSign = new GestureDescription("S");
for (let finger of [Finger.Thumb, Finger.Index, Finger.Middle, Finger.Ring, Finger.Pinky]) {
  sSign.addCurl(finger, FingerCurl.FullCurl, 1.0);
  sSign.addCurl(finger, FingerCurl.HalfCurl, 0.9);
}

// T
const tSign = new GestureDescription("T");
for (let finger of [Finger.Thumb, Finger.Index, Finger.Middle, Finger.Ring, Finger.Pinky]) {
  tSign.addCurl(finger, FingerCurl.FullCurl, 1.0);
  tSign.addCurl(finger, FingerCurl.HalfCurl, 0.9);
}

// U
const uSign = new GestureDescription("U");
uSign.addCurl(Finger.Index, FingerCurl.NoCurl, 1.0);
uSign.addDirection(Finger.Index, FingerDirection.VerticalUp, 1.0);
uSign.addCurl(Finger.Middle, FingerCurl.NoCurl, 1.0);
uSign.addDirection(Finger.Middle, FingerDirection.VerticalUp, 1.0);
for (let finger of [Finger.Thumb, Finger.Ring, Finger.Pinky]) {
  uSign.addCurl(finger, FingerCurl.FullCurl, 1.0);
  uSign.addCurl(finger, FingerCurl.HalfCurl, 0.9);
}

// X
const xSign = new GestureDescription("X");
xSign.addCurl(Finger.Index, FingerCurl.HalfCurl, 1.0);
xSign.addDirection(Finger.Index, FingerDirection.VerticalUp, 1.0);
for (let finger of [Finger.Thumb, Finger.Middle, Finger.Ring, Finger.Pinky]) {
  xSign.addCurl(finger, FingerCurl.FullCurl, 1.0);
  xSign.addCurl(finger, FingerCurl.HalfCurl, 0.9);
}

// Z
const zSign = new GestureDescription("Z");
zSign.addCurl(Finger.Index, FingerCurl.NoCurl, 1.0);
zSign.addDirection(Finger.Index, FingerDirection.VerticalUp, 1.0);
zSign.addDirection(Finger.Index, FingerDirection.DiagonalUpLeft, 1.0);
zSign.addDirection(Finger.Index, FingerDirection.DiagonalUpRight, 1.0);
for (let finger of [Finger.Thumb, Finger.Middle, Finger.Ring, Finger.Pinky]) {
  zSign.addCurl(finger, FingerCurl.FullCurl, 1.0);
  zSign.addCurl(finger, FingerCurl.HalfCurl, 0.9);
}

export const gestureDescriptions = [
  aSign,
  bSign,
  cSign,
  dSign,
  eSign,
  fSign,
  gSign,
  hSign,
  iSign,
  jSign,
  kSign,
  lSign,
  mSign,
  nSign,
  oSign,
  pSign,
  qSign,
  rSign,
  sSign,
  tSign,
  uSign,
  vSign,
  wSign,
  xSign,
  ySign,
  zSign,
];
