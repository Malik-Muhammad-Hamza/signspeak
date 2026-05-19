# SignSpeak: Real-Time Sign Language Interpreter

## Overview
SignSpeak is a browser-based prototype for recognizing selected ASL alphabet gestures through a webcam and converting them into text and speech. 

It runs entirely in the browser, using webcam input to detect hand landmarks and recognize selected static ASL signs. The app then builds words and sentences, using the browser's Web Speech API for text-to-speech output. The project is deployed and accessible via GitHub Pages.

## Live Demo
https://malik-muhammad-hamza.github.io/signspeak/

## Repository
https://github.com/Malik-Muhammad-Hamza/signspeak

## Features
- Real-time webcam feed
- Hand landmark detection
- Selected ASL alphabet recognition
- Current letter display
- Word formation using stable sign timing
- Sentence formation after no-hand delay
- Text-to-speech output
- Delete, Clear, and Speak Again controls
- How to Use popup/modal
- Supported signs guide
- Responsive UI
- GitHub Pages deployment

## Supported Gestures
A, B, C, D, E, F, G, H, I, L, M, O, V, W, Y, Z

*Note: This prototype currently supports selected static ASL alphabet gestures only. Unsupported signs may not be detected correctly.*

## How It Works
1. Webcam captures the user’s hand.
2. TensorFlow.js Handpose detects 21 hand landmarks.
3. Fingerpose compares the landmarks with selected gesture rules.
4. A stable detected sign is accepted after a short delay.
5. Accepted letters form the current word.
6. When no hand/sign is detected for a short period, the word is completed.
7. The browser Web Speech API speaks the generated text.

## Timing and Word Formation
- A sign must remain stable for about 1.2 seconds before being added.
- This prevents accidental repeated letters.
- When no hand/sign is detected for about 2 seconds, the current word is completed.
- Delete removes the last letter.
- Clear resets the text.
- Speak Again repeats the generated text.

## Gesture Guide
- **A:** Make a fist with all fingers curled. Keep the thumb along the side/outside of the fist, slightly exposed.
- **B:** Keep all four fingers straight and together. Fold the thumb across the palm.
- **C:** Curve the fingers and thumb to form an open C shape. There should be a visible gap between the thumb and index finger.
- **D:** Point the index finger upward. Curl the middle, ring, and pinky fingers. Keep the thumb near the curled fingers.
- **L:** Extend the thumb and index finger to form an L shape. Curl the remaining fingers.
- **V:** Extend the index and middle fingers apart like a V. Curl the ring and pinky fingers.
- **Y:** Extend the thumb and pinky finger. Curl the index, middle, and ring fingers.
- **I:** Extend only the pinky finger. Curl the thumb, index, middle, and ring fingers.
- **O:** Curve all fingers and thumb into a closed O shape. The thumb and index finger should touch or nearly touch.
- **W:** Extend the index, middle, and ring fingers. Curl the pinky and thumb.
- **M:** Make a closed fist with the thumb tucked under/behind the index, middle, and ring fingers. The thumb must NOT be exposed like A.
- **Z:** Extend the index finger upward while keeping all other fingers curled. *Note: Real ASL Z is a dynamic motion gesture. This prototype uses a simplified static index-finger pose.*
- **H:** Extend the index and middle fingers together sideways (horizontally). Curl the thumb, ring, and pinky. H differs from V because the fingers point horizontally, not upward.
- **E:** Bend all four fingers downward/hooked and tuck the thumb closed against the fingers. Unlike A, the thumb should not stick out.
- **F:** Touch the thumb and index finger together to form a small loop. Keep the middle, ring, and pinky fingers extended upward.
- **G:** Extend the index finger and thumb sideways/forward with a small gap. Curl the middle, ring, and pinky. This sign is usually shown from the side.

## Installation
```bash
npm install
```

## Run Locally
```bash
npm run dev
```
The local URL is usually: http://localhost:5173/

## Build
```bash
npm run build
```

## Deployment
SignSpeak is deployed using GitHub Pages. 
The `vite.config.js` is configured with `base: "/signspeak/"`. 
Deployment uses the `gh-pages` branch depending on the repository setup.

## Project Structure
```text
src/
  components/
    HowToUseModal.jsx
    WebcamFeed.jsx
  hooks/
    useHandDetection.js
    useKeyboardDemo.js
    useWordBuilder.js
  utils/
    drawHand.js
    gestureDescriptions.js
    gestureDetector.js
    speechOutput.js
  App.jsx
  index.css
  main.jsx
docs/
  demo-script.md
  project-documentation.md
```

## Limitations
- Prototype only.
- Supports 16 selected ASL alphabet gestures (A, B, C, D, E, F, G, H, I, L, M, O, V, W, Y, Z), not full A-Z.
- Recognizes static signs only.
- Does not translate full sign language grammar.
- Accuracy depends on lighting, camera quality, hand distance, hand angle, and background.
- Similar signs such as C and O may require careful positioning.
- **M** requires the thumb to be fully tucked inside the fist to avoid confusion with A.
- **Z** is a simplified static gesture (index finger extended); real ASL Z requires drawing a Z motion in the air.
- **H** is orientation-sensitive — fingers must point sideways, not upward, to avoid confusion with V.
- **E** may resemble A or M; the thumb must be tucked against bent fingertips, not sticking out sideways.
- **F** may be confused with O if the extended three fingers are not clearly pointing upward.
- **G** may be confused with L or H; the index finger must point sideways, not upward.
- Speech pronunciation depends on browser/system voice.

## Future Improvements
- Full alphabet support after better tuning.
- Dataset-trained classifier instead of only rule-based Fingerpose.
- Improved C/O and similar gesture separation.
- Better support for dynamic signs like J and Z.
- Multi-hand support.
- Urdu/local language speech support.
- User calibration mode.
- Practice/training mode.
- Backend-free offline-ready PWA mode.

## Team Members
- Muhammad Hamza - Group Leader - 2K23-815
- Ahmad Fazeel - 2K23-850
- Ramish Ali - 2K23-811
- Abdul Munim - 2K23-836

## Department
Department of Computer Information Technology

## Institute
Government College of Technology Bahawalpur
