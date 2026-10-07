import { useEffect, useRef, useState } from "react";
import { Alert, Button, Modal } from "antd";
import { Camera, ImageUp } from "lucide-react";

const cameraConstraints = {
  video: {
    facingMode: { ideal: "environment" },
    width: { ideal: 1280, max: 1280 },
    height: { ideal: 720, max: 720 },
    frameRate: { ideal: 24, max: 30 },
  },
  audio: false,
};

export default function MobileCodeScanner({ open, onClose, onScanned }) {
  const videoRef = useRef(null);
  const controlsRef = useRef(null);
  const readerRef = useRef(null);
  const nativeTimerRef = useRef(null);
  const completedRef = useRef(false);
  const [error, setError] = useState("");
  const [photoBusy, setPhotoBusy] = useState(false);

  function stopCamera() {
    window.clearTimeout(nativeTimerRef.current);
    nativeTimerRef.current = null;
    controlsRef.current?.stop();
    controlsRef.current = null;
    if (videoRef.current?.srcObject) {
      videoRef.current.srcObject.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }
  }

  function acceptResult(result) {
    const value = result?.getText?.().trim();
    if (!value || completedRef.current) return;
    completedRef.current = true;
    stopCamera();
    onScanned(value);
    onClose();
  }

  useEffect(() => {
    if (!open) {
      stopCamera();
      return undefined;
    }
    completedRef.current = false;
    setError("");
    let cancelled = false;
    async function startCamera() {
      try {
        if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
          throw new Error("Live camera requires a secure HTTPS connection.");
        }
        const stream = await navigator.mediaDevices.getUserMedia(cameraConstraints);
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        videoRef.current.srcObject = stream;
        await videoRef.current.play();

        if ("BarcodeDetector" in window) {
          try {
            const detector = new window.BarcodeDetector({ formats: ["code_39"] });
            const detectFrame = async () => {
              if (cancelled || completedRef.current || !videoRef.current) return;
              try {
                const codes = await detector.detect(videoRef.current);
                if (codes[0]?.rawValue) acceptResult({ getText: () => codes[0].rawValue });
              } catch {
                // Keep scanning. Camera frames may not be ready during startup.
              }
              if (!cancelled && !completedRef.current) {
                nativeTimerRef.current = window.setTimeout(detectFrame, 100);
              }
            };
            detectFrame();
            return;
          } catch {
            // Some browsers expose BarcodeDetector but do not support Code 39.
          }
        }

        const { BarcodeFormat, BrowserMultiFormatReader } = await import("@zxing/browser");
        if (cancelled) return;
        const reader = new BrowserMultiFormatReader(undefined, { delayBetweenScanAttempts: 100 });
        reader.possibleFormats = [BarcodeFormat.CODE_39];
        readerRef.current = reader;
        controlsRef.current = await reader.decodeFromStream(
          stream,
          videoRef.current,
          (result) => acceptResult(result),
        );
      } catch (cameraError) {
        if (!cancelled) {
          setError(cameraError?.message || "The camera could not be started. Use a barcode photo instead.");
        }
      }
    }
    startCamera();
    return () => {
      cancelled = true;
      stopCamera();
    };
  }, [open]);

  async function scanPhoto(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setPhotoBusy(true);
    setError("");
    const url = URL.createObjectURL(file);
    try {
      const { BarcodeFormat, BrowserMultiFormatReader } = await import("@zxing/browser");
      const reader = readerRef.current || new BrowserMultiFormatReader();
      reader.possibleFormats = [BarcodeFormat.CODE_39];
      const result = await reader.decodeFromImageUrl(url);
      acceptResult(result);
    } catch {
      setError("No Code 39 barcode was found. Retake the photo closer, straight-on, and in good light.");
    } finally {
      URL.revokeObjectURL(url);
      setPhotoBusy(false);
    }
  }

  return (
    <Modal
      className="mobile-code-scanner"
      open={open}
      title="Scan Case Barcode"
      footer={null}
      onCancel={onClose}
      destroyOnHidden
    >
      <div className="scanner-viewport">
        <video ref={videoRef} muted playsInline aria-label="Live camera preview" />
        <span className="scanner-guide" aria-hidden="true" />
      </div>
      <p className="scanner-help"><Camera size={16} /> Point the camera at the Code 39 battery barcode.</p>
      {error && <Alert type="warning" showIcon message={error} />}
      <Button className="scanner-photo-button" icon={<ImageUp size={17} />} loading={photoBusy}>
        <label>
          Scan From Photo
          <input type="file" accept="image/*" capture="environment" onChange={scanPhoto} />
        </label>
      </Button>
    </Modal>
  );
}
