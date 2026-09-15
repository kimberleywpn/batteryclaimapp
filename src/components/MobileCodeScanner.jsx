import { useEffect, useRef, useState } from "react";
import { Alert, Button, Modal } from "antd";
import { Camera, ImageUp } from "lucide-react";

export default function MobileCodeScanner({ open, onClose, onScanned }) {
  const videoRef = useRef(null);
  const controlsRef = useRef(null);
  const readerRef = useRef(null);
  const completedRef = useRef(false);
  const [error, setError] = useState("");
  const [photoBusy, setPhotoBusy] = useState(false);

  function stopCamera() {
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
        const { BrowserMultiFormatReader } = await import("@zxing/browser");
        if (cancelled) return;
        const reader = new BrowserMultiFormatReader();
        readerRef.current = reader;
        controlsRef.current = await reader.decodeFromConstraints(
          { video: { facingMode: { ideal: "environment" } }, audio: false },
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
      const { BrowserMultiFormatReader } = await import("@zxing/browser");
      const reader = readerRef.current || new BrowserMultiFormatReader();
      const result = await reader.decodeFromImageUrl(url);
      acceptResult(result);
    } catch {
      setError("No QR code or barcode was found. Retake the photo closer, straight-on, and in good light.");
    } finally {
      URL.revokeObjectURL(url);
      setPhotoBusy(false);
    }
  }

  return (
    <Modal
      className="mobile-code-scanner"
      open={open}
      title="Scan Case Code"
      footer={null}
      onCancel={onClose}
      destroyOnHidden
    >
      <div className="scanner-viewport">
        <video ref={videoRef} muted playsInline aria-label="Live camera preview" />
        <span className="scanner-guide" aria-hidden="true" />
      </div>
      <p className="scanner-help"><Camera size={16} /> Point the camera at a QR code or battery barcode.</p>
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
