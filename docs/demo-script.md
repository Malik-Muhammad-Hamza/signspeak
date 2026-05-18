# SignSpeak Demo Presentation Script

**Estimated Duration:** 90 - 120 seconds

---

### (Slide 1: Title & Introduction - 15 seconds)
**Speaker (Muhammad Hamza):** 
"Hello everyone. We are students from the Department of Computer Information Technology at Government College of Technology Bahawalpur. I am Muhammad Hamza, the group leader, presenting alongside my teammates Ahmad Fazeel, Ramish Ali, and Abdul Munim. Today, we are proud to present our project: **SignSpeak**."

### (Slide 2: Problem & Solution - 20 seconds)
**Speaker:** 
"A major communication barrier exists between the Deaf and Hard of Hearing community and those who do not understand sign language. Our solution is SignSpeak: a browser-based, real-time sign language interpreter. It aims to instantly translate hand gestures into spoken words. The best part? It runs entirely in your web browser with no external APIs or complex backend servers required."

### (Slide 3: Tech Stack & How It Works - 20 seconds)
**Speaker:** 
"Under the hood, we built this prototype using React and Vite. For the machine learning aspect, we use TensorFlow.js with the Handpose model to track 21 3D points on the user's hand in real-time. A library called Fingerpose maps those points to recognize selected ASL alphabet gestures. Finally, we use the browser's native Web Speech API to read the translated words aloud."

### (Slide 4: Live Demo - 30 seconds)
**Speaker:** 
"Let’s look at a live demo.
1. First, the application accesses the webcam. You can see the system status indicates the model is loaded and ready.
2. Next, I will show a few selected ASL letters to the camera. Notice how the green progress bar fills up to confirm that my gesture is stable.
3. The letters string together automatically in the 'Current Word' panel. 
4. When I drop my hand for two seconds, the system knows the word is finished, adds it to the sentence, and automatically speaks it out loud."
*(Perform live demo steps while speaking)*

### (Slide 5: Limitations & Future Improvements - 20 seconds)
**Speaker:** 
"As this is a prototype, there are a few limitations. Because we are using a standard 2D webcam, fingers blocking each other from the camera's view can sometimes cause detection instability. Also, it currently maps static alphabet shapes. In the future, we plan to migrate to more advanced 3D tracking like MediaPipe and implement neural networks to recognize full, dynamic ASL words instead of just spelling."

### (Slide 6: Conclusion - 10 seconds)
**Speaker:** 
"SignSpeak is an exploration into how AI and web technologies can make everyday communication more accessible for everyone. Thank you for your time, and we are now open to any questions." 
