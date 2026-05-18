# SignSpeak: Real-Time Sign Language Interpreter

## Overview
**SignSpeak** is a browser-based, real-time sign language interpreter prototype. It leverages machine learning to track hand gestures via a webcam, translates them into ASL (American Sign Language) alphabet characters, and synthesizes the resulting words into spoken audio.

## Problem Statement
Communication barriers exist between the Deaf and Hard of Hearing (DHH) community and those who do not understand sign language. While sign language is a rich and expressive visual language, the lack of widespread fluency creates daily challenges in accessibility and interaction. SignSpeak aims to bridge this gap by exploring how computer vision and machine learning can act as a real-time interpreter, instantly translating signs into spoken words.

## Features
- **Live Hand Tracking**: Detects hand landmarks in real-time using a standard webcam.
- **Gesture Classification**: Translates complex 3D hand shapes into recognizable text characters.
- **Dynamic Word Builder**: Intelligently strings together individual ASL letters into full words and sentences based on hand stability and timing.
- **Text-to-Speech**: Synthesizes constructed sentences into spoken audio using the browser's Web Speech API.

## Tech Stack
- **Frontend Framework**: React.js, Vite
- **Styling**: Tailwind CSS
- **Machine Learning**: 
  - `@tensorflow/tfjs` (Core Engine)
  - `@tensorflow-models/handpose` (Hand Landmark Detection)
  - `fingerpose` (Gesture Classification)
- **Audio Output**: Web Speech API (`window.speechSynthesis`)

## How the System Works
1. **Capture**: `react-webcam` captures a live video feed from the user's camera.
2. **Detect**: The TensorFlow Handpose model analyzes the video frames, plotting 21 3D landmarks across the user's hand and fingers.
3. **Classify**: The Fingerpose library analyzes the curls and directions of those 21 landmarks, comparing them against predefined ASL rules to identify a match.
4. **Build**: A custom debouncer ensures that only deliberately held signs (stable for 1200ms) are appended to the current word. When the user drops their hand for 2 seconds, the word is completed.
5. **Speak**: The completed text is sent to the Web Speech API and read aloud.

## Supported Gestures
This prototype focuses on demonstrating viability. While the codebase contains experimental logic for the entire alphabet,while the logic of all alphabets from A-Z is added the following letters have been primarily targeted for stability testing:
**A, B, C, D, L, V, Y, I,J, W**

## Installation Steps
Ensure you have [Node.js](https://nodejs.org/) (v16+) installed on your machine.

1. Clone the repository or extract the project folder.
2. Open a terminal in the project's root directory (`signspeak`).
3. Install the required dependencies:
   ```bash
   npm install
   ```

## How to Run Locally
Start the local Vite development server by running:
```bash
npm run dev
```
Open the provided local URL (typically `http://localhost:5173`) in your browser. 
*(Note: You must grant the browser permission to access your webcam.)*

## How to Build for Production
To create an optimized production build, run:
```bash
npm run build
```
This will bundle the application into a `dist/` directory, ready to be deployed to any static hosting service.

## Limitations
- **Prototype Status**: This is a proof-of-concept student project, not a production-ready medical or accessibility device.
- **2D Camera Occlusion**: The system relies on a standard 2D webcam. Gestures where fingers hide or block other fingers from the camera's view (occlusion) can cause detection instability.
- **Lighting and Backgrounds**: Detection accuracy heavily depends on the user's environment. Poor lighting or busy backgrounds may interfere with TensorFlow's ability to track the hand accurately.
- **Static Alphabet Only**: The system currently maps static alphabet shapes. It does not support dynamic signs (like 'J' which require motion) or full ASL word signs.

## Future Improvements
- Migration to modern MediaPipe hand tracking for improved speed, 3D depth perception, and accuracy.
- Addition of an LSTM (Long Short-Term Memory) neural network to track hand motion over time, allowing for the detection of dynamic signs and full words rather than just static letters.
- User-calibration settings to account for different hand sizes, skin tones, and resting positions.

---

## Project Details

### Team Members
- **Muhammad Hamza** *(Group Leader)* - 2K23-815
- **Ahmad Fazeel** - 2K23-850
- **Ramish Ali** - 2K23-811
- **Abdul Munim** - 2K23-836

### Department
Department of Computer Information Technology

### Institute
Government College of Technology Bahawalpur
