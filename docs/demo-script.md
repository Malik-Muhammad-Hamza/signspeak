# SignSpeak Demo Script

## 90-Second Presentation Script
"Hello everyone, we are presenting SignSpeak, a real-time, browser-based sign language interpreter prototype. Communication barriers often exist for those who rely on sign language, and many existing tools require expensive hardware or heavy backend processing.

SignSpeak runs entirely in the web browser using a standard webcam. It uses TensorFlow.js and the Handpose model to detect hand landmarks, and a rule-based system to recognize selected static ASL alphabet gestures. For this prototype, we support 16 specific letters: A, B, C, D, E, F, G, H, I, L, M, O, V, W, Y, Z.

When a user holds a supported sign steadily for about a second, the app adds it to the current word. When the user drops their hand, the app completes the word and speaks it out loud using the browser's built-in Web Speech API. There are no external paid APIs, and no backend servers—everything is processed locally on your device for privacy and speed. 

Let's look at a live demonstration."

## Step-by-Step Live Demo Flow
1. **Open Deployed Link:** Navigate to the GitHub Pages live link: `https://malik-muhammad-hamza.github.io/signspeak/`
2. **Camera Permission:** Click "Allow" when the browser requests camera access.
3. **Show Interface:** Point out the webcam feed, the Model Status indicator, and the active recognition panel.
4. **How to Use:** Click the "How to Use" button to show the supported gestures list and briefly explain the UI guide.
5. **Demonstrate Gestures:** 
   - Make a "C" (keep it open). Show how the progress bar fills up and adds 'C'.
   - Drop hand briefly.
   - Make an "O" (close the thumb and index finger). Show it adding 'O'.
   - Make a "W".
   - Make a "L".
   - Make an "M" (closed fist, thumb tucked in). Show it adding 'M'.
   - Make an "H" (index and middle extended sideways). Show it adding 'H'.
6. **Sentence Formation:** Drop the hand for 2 seconds. The app will complete the word and add it to the sentence.
7. **Controls:** Click "Speak" to speak the current sentence. Click "Delete" and "Clear" to demonstrate text management.
8. **Limitations:** Honestly explain that it is a prototype supporting 10 letters, and that lighting and angles affect accuracy.

## Backup Plan
If the camera fails, detection is too slow, or the lighting is poor:
- Use the **Keyboard Demo mode** (if available) to simulate gesture inputs and demonstrate the word builder and speech output.
- Alternatively, show a pre-recorded backup video of the app working in ideal lighting conditions.
- *Explanation:* "Browser-based machine learning depends heavily on hardware performance, camera quality, and room lighting. In an ideal environment, the detection is much smoother, as shown in our backup testing."

## Common Judge Questions and Short Answers

**Q: Does it support full sign language?**
A: No. It is a prototype for selected static ASL alphabet signs.

**Q: Does it need internet?**
A: The deployed page needs internet to load initially. The recognition itself runs entirely in the browser after the required assets and models are downloaded.

**Q: Does it use external APIs?**
A: No external paid APIs are used. It uses browser-based TensorFlow.js for vision and the built-in Web Speech API for audio.

**Q: Why only selected letters?**
A: Some ASL letters are visually similar or involve dynamic movement (like J). To ensure a reliable demonstration, this prototype focuses on 16 distinct static gestures. Z is included as a simplified static pose; real ASL Z uses motion which this system cannot yet detect. G is a side-facing gesture, F uses a thumb-index loop, and E is a compact closed handshape — all require careful hand positioning.

**Q: Why can pronunciation vary?**
A: Speech output uses the browser or operating system's native speech synthesis voice, so the pronunciation depends on the available voice engine on that specific device.
