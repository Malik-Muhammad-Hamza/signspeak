import * as fp from "fingerpose";

// 1. A Sign
const aSign = new fp.GestureDescription("A");
// Thumb should be mostly straight/no curl.
aSign.addCurl(fp.Finger.Thumb, fp.FingerCurl.NoCurl, 1.0);
aSign.addCurl(fp.Finger.Thumb, fp.FingerCurl.HalfCurl, 0.5);
// Index, middle, ring, and pinky should be full curl.
for (let finger of [fp.Finger.Index, fp.Finger.Middle, fp.Finger.Ring, fp.Finger.Pinky]) {
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
// Thumb should be half/full curl across palm.
bSign.addCurl(fp.Finger.Thumb, fp.FingerCurl.HalfCurl, 1.0);
bSign.addCurl(fp.Finger.Thumb, fp.FingerCurl.FullCurl, 0.5);

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
dSign.addDirection(fp.Finger.Index, fp.FingerDirection.DiagonalUpLeft, 0.5);
dSign.addDirection(fp.Finger.Index, fp.FingerDirection.DiagonalUpRight, 0.5);
// Middle, ring, and pinky should be curled.
for (let finger of [fp.Finger.Middle, fp.Finger.Ring, fp.Finger.Pinky]) {
  dSign.addCurl(finger, fp.FingerCurl.FullCurl, 1.0);
  dSign.addCurl(finger, fp.FingerCurl.HalfCurl, 0.5);
}
// Thumb should be half curl.
dSign.addCurl(fp.Finger.Thumb, fp.FingerCurl.HalfCurl, 1.0);

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
];

export const supportedLetters = ["A", "B", "C", "D", "L", "V", "Y", "I", "O", "W"];
