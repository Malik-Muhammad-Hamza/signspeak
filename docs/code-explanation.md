# SignSpeak Code Explanation

## 1. Project Overview
SignSpeak is a browser-based prototype designed to translate American Sign Language (ASL) into text and speech. In simple terms, the project:
- Opens the user's webcam.
- Detects the position of the hand and its joints (landmarks).
- Recognizes selected ASL signs by analyzing the shape of the hand.
- Converts those recognized signs into letters.
- Builds those letters into words and sentences using timing rules.
- Speaks the generated text out loud using the browser's built-in text-to-speech engine.

## 2. High-Level Application Flow
Here is the step-by-step journey of data through the application:
1. The user opens the app in a modern browser.
2. React initializes and renders the user interface.
3. The `WebcamFeed` component requests camera permissions and displays the live video input.
4. The `useHandDetection` hook loads the TensorFlow Handpose machine learning model.
5. The live webcam video is continuously passed to the Handpose model frame by frame.
6. Handpose analyzes the image and returns 21 3D hand landmarks representing the joints and fingertips.
7. The `drawHand` utility takes these landmarks and visually draws them as dots and lines on an invisible canvas placed over the webcam feed.
8. The `gestureDetector` utility sends the detected landmarks to the Fingerpose library.
9. Fingerpose compares the angles and curls of the landmarks against predefined rules in `gestureDescriptions`.
10. The best matching supported letter (e.g., A, B, C) is returned.
11. The `useWordBuilder` hook waits to ensure the detected sign remains stable, avoiding accidental inputs.
12. Once stable, the letter is added to the current word.
13. When the user drops their hand and no sign is detected for a short delay, the word is finalized and added to the sentence.
14. The `speechOutput` utility uses the Web Speech API to read the finalized text out loud.
15. `App.jsx` handles all state management and updates the screen with the current letter, word, sentence, and interactive controls.

## 3. Folder Structure
The actual project folder structure is organized as follows:
- `src/components`: Contains reusable UI building blocks like the webcam display and popup modals.
- `src/hooks`: Contains custom React hooks that handle complex state and business logic (like hand tracking and word building) independently of the UI.
- `src/utils`: Contains helper functions for drawing, gesture definitions, detection logic, and speech synthesis.
- `docs`: Contains markdown files for project documentation and presentation scripts.
- `public`: Contains static assets that are served directly without being processed by Vite.

## 4. Main Entry Files

### index.html
- **Role:** The root HTML file.
- **Purpose:** It provides the basic structure of the webpage and contains the `<div id="root"></div>` where the entire React application is mounted.

### src/main.jsx
- **Role:** The React entry point.
- **Purpose:** It imports React, the global CSS styles (`index.css`), and the main `App.jsx` component. It uses `createRoot` to render the React application into the DOM.

### src/index.css
- **Role:** Global styling configuration.
- **Purpose:** It imports Tailwind CSS directives (base, components, utilities) and establishes the base styling rules for the application.

### vite.config.js
- **Role:** The build tool configuration file.
- **Purpose:** It tells Vite how to bundle the application for production. It includes the React plugin and sets the `base: "/signspeak/"` path to ensure assets load correctly when deployed to GitHub Pages.

### package.json
- **Role:** Project metadata and dependency manager.
- **Purpose:** It lists the external libraries (dependencies like `react`, `@tensorflow-models/handpose`, `fingerpose`) and developer tools used. It defines essential scripts:
  - `npm run dev`: Starts the local development server.
  - `npm run build`: Compiles the app for production.
  - `npm run preview`: Previews the production build locally.
  - `npm run deploy`: Automates the GitHub Pages deployment process.

## 5. App.jsx Explanation
`App.jsx` is the core of the user interface. It acts as the central hub connecting the logic hooks to the visual elements.
- **State Management:** It manages the overarching state of the application, such as tracking camera errors and controlling the visibility of the "How to Use" modal.
- **Refs:** It uses React `useRef` to maintain persistent references to the webcam video element and the drawing canvas, allowing the detection logic to access them without causing re-renders.
- **Hook Integration:** It calls `useHandDetection` to retrieve the current detected letter and the model's loading status. It passes the `detectedLetter` into `useWordBuilder` to handle the timing and text generation.
- **Keyboard Demo Mode:** It hooks into `useKeyboardDemo` to allow manual keyboard input as a fallback if the webcam or model fails.
- **UI Layout:** 
  - **Header:** Displays the app title, Model Status indicator (Loading/Ready), and the "How to Use" button.
  - **Main Content:** Split into a Webcam Panel (showing the live feed and hand tracking status) and a Recognition Panel.
  - **Recognition Panel:** Displays the currently active detected letter, the forming current word, and the full finalized sentence.
  - **Controls:** Contains interactive buttons:
    - **Delete:** Removes the last added letter.
    - **Clear:** Wipes the current word and sentence clean.
    - **Copy Text:** Copies the generated sentence to the clipboard.
    - **Download Transcript:** Saves the output as a `.txt` file.
    - **Speak Again:** Replays the audio for the current text.
- **Modals:** Conditionally renders the `HowToUseModal` based on state.

## 6. Components Explanation

### WebcamFeed.jsx
- **Purpose:** Uses the `react-webcam` library to display the live camera feed to the user.
- **Canvas Overlay:** It places an absolutely positioned HTML canvas directly on top of the webcam video. This ensures that the hand landmarks drawn by TensorFlow align perfectly with the user's hand in the video.
- **Mirroring:** The video is mirrored (flipped horizontally) so that it acts like a natural mirror for the user, making it easier to aim their hand.
- **Sizing:** The canvas is forced to match the exact dimensions of the webcam to ensure the drawn landmarks map accurately to the real-world coordinates.

### HowToUseModal.jsx
- **Purpose:** An educational overlay that guides new users.
- **Behavior:** It receives `isOpen` and `onClose` props to control visibility. It can be dismissed by clicking the close button, clicking the dark backdrop, or pressing the Escape key.
- **Content:** It details the steps to start signing, lists the supported letters, explains the timing rules for word and sentence formation, and provides a text-based physical guide on how to form each gesture.
- **Accessibility:** Uses appropriate semantic attributes like `role="dialog"` and `aria-modal="true"`.

## 7. Hooks Explanation

### useHandDetection.js
- **Purpose:** Manages the integration of the TensorFlow.js Handpose model.
- **Initialization:** Uses a `useEffect` hook to load the machine learning model when the app starts. The model is heavy, so it only loads once to save memory and processing power.
- **Detection Loop:** Sets up an interval loop (e.g., running every 100ms) that continuously grabs the current frame from the `webcamRef.current.video`.
- **Processing:** It checks if the video has loaded properly, then calls `model.estimateHands(video)`.
- **Output:** It receives a set of predictions. If a hand is found, it calls `drawHand` to render the landmarks, updates the `handDetected` status, and calls `detectGesture` to decipher the sign. If no hand is found, it clears the canvas.
- **Returns:** It provides `isModelLoading`, `handDetected`, `detectedLetter`, and any initialization errors back to `App.jsx`.

### useWordBuilder.js
- **Purpose:** Translates raw frame-by-frame letter detections into meaningful words and sentences using time delays.
- **Stable Detection:** It tracks the `detectedLetter`. It uses a delay timer (around 1.2 seconds) to ensure the user is holding the sign steadily before officially adding it to the `currentWord`. This prevents the app from spamming letters instantly.
- **Sentence Formation:** It utilizes a "no-hand" delay. If the detector sees no letter for about 2 seconds, the hook assumes the user has finished signing the word. It then finalizes the word, adds it to the `fullSentence`, and calls `speakWord()` to trigger the audio.
- **Controls:** It provides functions like `deleteLetter` and `clearAll` to manage mistakes.

### useKeyboardDemo.js
- **Purpose:** Provides a reliable backup mode for presentations.
- **Behavior:** Listens for physical keyboard keydown events. If the pressed key matches a supported letter, it simulates a gesture detection. 
- **Utility:** Machine learning relies heavily on good lighting and processing power. If the environment fails during a live demo, this mode allows the presenter to quickly demonstrate the UI, word builder, and speech engine without relying on the webcam.

## 8. Utility Files Explanation

### gestureDescriptions.js
- **Purpose:** Defines the physical rules for what each sign looks like.
- **Library:** Imports the `fingerpose` package as `fp`.
- **Rules:** Uses `GestureDescription` to map out the required state for each finger (Thumb, Index, Middle, Ring, Pinky). It evaluates whether a finger is curled (`NoCurl`, `HalfCurl`, `FullCurl`) and its direction (`VerticalUp`, `HorizontalLeft`, etc.).
- **Supported Gestures:** It defines strict rules for exactly 10 static letters:
  - **A:** Fist with thumb outside.
  - **B:** Four fingers straight up, thumb folded.
  - **C:** Open curved hand with a gap between thumb and index.
  - **D:** Index up, other fingers curled.
  - **L:** Thumb and index extended horizontally and vertically.
  - **V:** Index and middle extended apart.
  - **Y:** Thumb and pinky extended.
  - **I:** Pinky extended alone.
  - **O:** Closed rounded shape where thumb and index touch.
  - **W:** Index, middle, ring extended.
- **Note:** These rules are mathematical approximations of human joints and require tuning.

### gestureDetector.js
- **Purpose:** Acts as the brain that compares the live webcam hand against the rules defined in `gestureDescriptions`.
- **Estimation:** It uses `GestureEstimator` to process the landmarks. It assigns a confidence score to matching gestures and sorts them to find the most probable letter.
- **Geometry Correction:** Fingerpose curl rules alone often confuse visually similar signs like "C" and "O" because both use curled fingers. This utility includes custom geometric helpers that calculate the 2D Euclidean distance between the thumb tip (landmark 4) and index tip (landmark 8).
- **C/O Separation:** 
  - It normalizes this distance against the size of the hand. 
  - If the gap is visibly open, it enforces a "C" classification.
  - If the gap is pinched closed, it overrides the estimation to an "O".

### drawHand.js
- **Purpose:** A purely visual utility that draws dots (for joints) and lines (for bones) on the HTML canvas. It helps the user see exactly what the machine learning model is "seeing," which is crucial for debugging hand placement and lighting.

### speechOutput.js
- **Purpose:** Handles the text-to-speech functionality.
- **Behavior:** It uses the native browser Web Speech API. Before speaking, it cleans the text (trimming spaces, converting to lowercase) to ensure acronyms aren't spelled out awkwardly. It attempts to select the most natural-sounding English voice available on the user's system.
- **Limitations:** The pronunciation and voice quality depend entirely on the operating system and browser being used.

## 9. Detection Pipeline Explained Simply
1. **Webcam frame:** The camera captures a picture of your hand.
2. **Handpose model:** AI scans the picture and finds 21 specific dots (joints) on your hand.
3. **Fingerpose rules:** The system checks if the bending and direction of those 21 dots match any known sign (like A, B, or C).
4. **Best matching gesture:** The system guesses the most likely letter based on the rules.
5. **Stable letter confirmation:** The app waits 1 second to make sure you meant to make that sign, and aren't just moving your hand around.
6. **Word/sentence output:** The confirmed letter is added to your word. If you drop your hand, the word is finalized.
7. **Speech synthesis:** The browser reads the finalized word out loud.

## 10. Timing Logic Explained
The app relies on time delays to interpret continuous video into structured text. 
- **Stable Detection Delay:** If the app accepted every detected letter immediately, a 30-frames-per-second webcam would output "AAAAAAA" in a fraction of a second. By waiting ~1.2 seconds, the app guarantees the user is intentionally holding a sign.
- **No-Hand Delay:** Because there is no "spacebar" in static sign language, the app uses the absence of a hand to signify the end of a word. Dropping your hand for 2 seconds tells the app to finalize the text and trigger the speech output.

## 11. C vs O Improvement Explanation
The letters "C" and "O" are visually very similar—both require curving all fingers. Standard curl detection often confuses them. 
To fix this, the app uses raw mathematical geometry. It calculates the exact distance between the tip of your thumb and the tip of your index finger. 
- If there is a wide, open gap, the app knows it is a **C**. 
- If the distance is tiny and the fingers form a closed loop, the app knows it is an **O**. 
This custom calculation overrides the AI's best guess, drastically improving accuracy.

## 12. Error Handling
- **Camera Permissions:** If the user denies camera access, the `WebcamFeed` catches the error and displays a safe, readable error message in the UI telling the user to allow permissions.
- **Model Loading:** The UI displays a loading indicator until the TensorFlow model is fully downloaded and initialized, preventing crashes from attempting to detect hands before the AI is ready.
- **Safe Checks:** The detection loop uses `try/catch` blocks and null-checks. If the webcam feed drops or the video element disappears, the loop fails gracefully instead of breaking the entire application.

## 13. Deployment Explanation
The application is built using **Vite**. 
When the developer runs `npm run build`, Vite takes the React JSX, Tailwind CSS, and external packages, and compresses them into a highly optimized bundle inside a `dist` folder.
This static folder is then uploaded to a free hosting service provided by **GitHub Pages**. Because it is served from a subdirectory, `vite.config.js` uses a specific base path (`base: "/signspeak/"`) so the browser knows exactly where to find the JavaScript and CSS assets on the live URL: 
https://malik-muhammad-hamza.github.io/signspeak/

## 14. Limitations
- **Prototype Only:** This is an academic proof-of-concept, not a production-ready translation tool.
- **Selected Letters Only:** It only supports 10 static ASL signs.
- **Static Signs Only:** It cannot process signs that require motion (like sweeping the hand for J or Z).
- **No ASL Grammar:** True ASL has complex sentence structures and facial expressions; this app only processes letter-by-letter spelling.
- **Environmental Dependency:** Accuracy requires good lighting, a clean background, and the hand remaining squarely facing the camera.
- **Inconsistent Audio:** The Web Speech API uses system voices, meaning the app will sound different on Windows, macOS, Android, and iOS.

## 15. Future Improvements
- **Full Alphabet Expansion:** Carefully tuning rules to support A-Z.
- **Neural Network Classifier:** Replacing the rule-based Fingerpose library with a custom-trained dataset model for higher accuracy.
- **Dynamic Gestures:** Adding frame-over-frame tracking to support moving signs like J and Z.
- **Multi-Hand Support:** Tracking both hands simultaneously for complex signs.
- **Practice Mode:** Adding gamified UI for users trying to learn ASL.
- **PWA Support:** Making the application fully installable and functional offline.
- **Urdu/Local Speech:** Adding support for local language text-to-speech synthesis.

## 16. Team Members
- **Muhammad Hamza** - Group Leader - 2K23-815
- **Ahmad Fazeel** - 2K23-850
- **Ramish Ali** - 2K23-811
- **Abdul Munim** - 2K23-836

**Department:** Department of Computer Information Technology  
**Institute:** Government College of Technology Bahawalpur

## 17. Presentation Explanation
During a viva or presentation, use these simple answers to explain the underlying technology clearly:

**Q: What does TensorFlow.js do here?**
A: It runs the core artificial intelligence model directly in the browser.

**Q: What does Handpose do?**
A: It analyzes the video and detects 21 specific landmark points (joints) on the user's hand.

**Q: What does Fingerpose do?**
A: It compares those landmark positions against predefined rules (like finger curl and direction) to guess the sign.

**Q: Why selected letters only?**
A: Some ASL letters are visually very similar or require motion (dynamic). To ensure a highly reliable live demonstration, this prototype focuses on distinct, static letters.

**Q: Why is there a delay before adding letters?**
A: To prevent "spamming." Without a delay, holding an 'A' for one second would type 'A' 30 times. The delay ensures intent.

**Q: Does it use a backend?**
A: No, everything runs on the frontend in the user's browser, which protects privacy and speeds up response times.

**Q: Does it use external paid APIs?**
A: No, it utilizes free, open-source browser libraries (TensorFlow) and the native browser Web Speech API.
