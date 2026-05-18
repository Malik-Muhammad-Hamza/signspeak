import React from "react";
import Webcam from "react-webcam";

const WebcamFeed = ({ webcamRef, canvasRef, onMediaError }) => {
  return (
    <div className="relative w-[640px] h-[480px] rounded-xl overflow-hidden border border-gray-700 bg-black shadow-lg">
      <Webcam
        ref={webcamRef}
        onUserMediaError={onMediaError}
        mirrored={true}
        audio={false}
        width={640}
        height={480}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "640px",
          height: "480px",
          objectFit: "cover",
        }}
      />
      <canvas
        ref={canvasRef}
        width={640}
        height={480}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "640px",
          height: "480px",
          zIndex: 10,
          transform: "scaleX(-1)", // Align with mirrored webcam
        }}
      />
    </div>
  );
};

export default WebcamFeed;
