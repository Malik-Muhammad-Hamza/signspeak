import Webcam from "react-webcam";

/**
 * WebcamFeed — responsive 4:3 webcam with aligned landmark canvas overlay.
 *
 * The container uses a padding-bottom trick (75% = 3/4 of width) to maintain
 * the 4:3 aspect ratio at any viewport width without layout shift.
 * Both video and canvas use width/height="100%" so they always match.
 * The canvas keeps its intrinsic 640×480 coordinate space so landmark
 * calculations done in useHandDetection remain pixel-accurate.
 */
const WebcamFeed = ({ webcamRef, canvasRef, onMediaError }) => {
  return (
    <div
      className="relative w-full rounded-xl overflow-hidden border border-gray-700 bg-black shadow-lg"
      style={{ paddingBottom: "75%" /* 4:3 aspect ratio */ }}
    >
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
          width: "100%",
          height: "100%",
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
          width: "100%",
          height: "100%",
          zIndex: 10,
          transform: "scaleX(-1)", // Mirror to align with mirrored webcam
        }}
      />
    </div>
  );
};

export default WebcamFeed;
