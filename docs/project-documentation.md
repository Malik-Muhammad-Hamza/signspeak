# SignSpeak: Real-Time Sign Language Interpreter

## 1. Title Page
**SignSpeak: Real-Time Sign Language Interpreter**
A browser-based prototype for recognizing selected static ASL hand gestures.
**Department:** Department of Computer Information Technology
**Institute:** Government College of Technology Bahawalpur

## 2. Abstract
SignSpeak is an accessible, browser-based prototype designed to recognize selected static alphabetic signs from American Sign Language (ASL) using a standard webcam. It converts these recognized gestures into text and synthesizes speech using the Web Speech API. This project demonstrates the feasibility of real-time sign language interpretation directly within a modern web browser without requiring external software installations or external APIs.

## 3. Introduction
Communication barriers frequently exist between individuals who use sign language and those who do not. SignSpeak aims to bridge this gap by offering a simple, client-side web application. Users can form selected ASL gestures in front of their webcam, and the system translates the recognized signs into text and synthesized speech.

## 4. Problem Statement
Many existing sign language translation tools require specialized hardware, intensive backend processing, or expensive APIs. Furthermore, many systems are not easily accessible to the general public. There is a need for a lightweight, accessible tool that works directly in the browser to facilitate basic communication.

## 5. Objectives
- To build a real-time, browser-based gesture recognition prototype.
- To recognize a selected subset of static ASL alphabet gestures accurately.
- To provide text-to-speech capabilities for the recognized gestures.
- To maintain an accessible, backend-free architecture.

## 6. Scope
The application is a prototype focused exclusively on recognizing a selected subset of static ASL alphabetic signs: A, B, C, D, L, V, Y, I, O, W. It supports simple word and sentence formation by stringing together individual letters based on timing delays. It does not support full ASL grammar, dynamic signs (like J or Z), or the complete A-Z alphabet.

## 7. Tools and Technologies
- **Frontend Framework:** React, Vite
- **Styling:** Tailwind CSS
- **Webcam Interface:** react-webcam
- **Machine Learning / Hand Tracking:** TensorFlow.js, TensorFlow Handpose model
- **Gesture Recognition:** fingerpose
- **Speech Synthesis:** Web Speech API
- **Deployment:** GitHub Pages

## 8. System Architecture
SignSpeak operates entirely on the client side:
1. Video frames are captured via `react-webcam`.
2. The TensorFlow.js Handpose model predicts 21 3D hand landmarks from the video feed.
3. The `fingerpose` library evaluates these landmarks against predefined finger curl and direction rules.
4. Custom geometric helpers refine ambiguous gestures (e.g., C vs. O).
5. The React application manages state (current letter, word, sentence) based on gesture stability over time.
6. The Web Speech API generates audio output for completed words.

## 9. Methodology
The project employs a rule-based recognition approach rather than a dataset-trained neural network classifier. Hand landmarks extracted by the Handpose model are analyzed for curl (e.g., NoCurl, HalfCurl, FullCurl) and direction (e.g., VerticalUp, HorizontalLeft). These states are matched against hardcoded gesture descriptions to determine the most likely sign.

## 10. Modules
- **Hand Detection Module:** Captures webcam input and runs the Handpose model.
- **Gesture Recognition Module:** Compares landmarks against gesture rules and applies geometric corrections.
- **Word Builder Module:** Manages the timing logic to accept stable letters and form words/sentences.
- **Speech Output Module:** Interfaces with the browser's Web Speech API to provide audio feedback.
- **User Interface:** Displays the webcam feed, detected letter, current word, full sentence, and interactive controls.

## 11. Implementation Details
The application uses React hooks (`useHandDetection`, `useWordBuilder`) to encapsulate complex logic. `gestureDescriptions.js` contains the curl and direction rules for the supported letters. `gestureDetector.js` processes the predictions and applies custom geometric logic (e.g., measuring the normalized gap between the thumb and index finger) to distinguish similar signs like "C" and "O".

## 12. How the Application Works
1. The user grants webcam permissions in the browser.
2. The Handpose model continuously tracks the user's hand.
3. When a hand forms a supported gesture and remains stable for approximately 1.2 seconds, the letter is added to the current word.
4. If no hand is detected for about 2 seconds, the word is finalized and appended to the full sentence, triggering the text-to-speech output.

## 13. Supported Gestures
The application recognizes the following static ASL signs:
**A, B, C, D, L, V, Y, I, O, W**

## 14. Timing and Sentence Formation
To prevent repeated or accidental letter entries, a gesture must be held steadily for ~1.2 seconds. A pause in signing (no hand detected for ~2 seconds) signals the completion of a word.

## 15. Testing
Testing was conducted manually across various lighting conditions, hand distances, and angles. Specific attention was given to differentiating similar signs (e.g., ensuring an open C does not trigger O, and a closed O does not trigger C) by implementing custom distance thresholds.

## 16. Limitations
- **Prototype Only:** This is a demonstration prototype, not a complete sign language translator.
- **Limited Vocabulary:** Supports only 10 selected static ASL alphabet gestures.
- **No Grammar Translation:** Does not support sentence-level ASL grammar.
- **Environmental Dependency:** Accuracy relies heavily on adequate lighting, a clean background, and clear hand visibility.
- **Pronunciation Variations:** Speech output depends on the voices available in the user's browser/OS.

## 17. Future Enhancements
- Expansion to the full A-Z alphabet with improved detection models.
- Migration from rule-based recognition to a dataset-trained classifier.
- Support for dynamic signs.
- Multi-hand recognition and Urdu/local language speech synthesis.
- Practice and training modes for users learning ASL.

## 18. Conclusion
SignSpeak successfully demonstrates that real-time, browser-based sign language recognition is possible without heavy backend infrastructure. While limited in scope to a subset of static alphabets, it establishes a solid foundation for future development in accessible communication tools.

## 19. Team Members
- Muhammad Hamza - Group Leader - 2K23-815
- Ahmad Fazeel - 2K23-850
- Ramish Ali - 2K23-811
- Abdul Munim - 2K23-836

## 20. References
- React
- Vite
- TensorFlow.js
- TensorFlow Handpose model
- Fingerpose
- Web Speech API
- GitHub Pages
