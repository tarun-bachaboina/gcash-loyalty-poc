import { Button, Dialog, haptic, InlineError } from '@gcash/ui';
import jsQR from 'jsqr';
import { Camera, Loader2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

// Chrome/Edge on macOS, Android and ChromeOS ship a native QR detector; everything else uses jsQR on a canvas.
interface NativeDetector {
  detect(source: CanvasImageSource): Promise<{ rawValue: string }[]>;
}
declare global {
  interface Window {
    BarcodeDetector?: { new (opts: { formats: string[] }): NativeDetector; getSupportedFormats(): Promise<string[]> };
  }
}

async function nativeDetector(): Promise<NativeDetector | null> {
  try {
    if (!window.BarcodeDetector || !(await window.BarcodeDetector.getSupportedFormats()).includes('qr_code')) return null;
    return new window.BarcodeDetector({ formats: ['qr_code'] });
  } catch {
    return null;
  }
}

const SCAN_EVERY_MS = 150;
const MAX_WIDTH = 640;

function cameraError(err: unknown) {
  const name = err instanceof DOMException ? err.name : '';
  if (name === 'NotAllowedError' || name === 'SecurityError') return 'Camera access is blocked. Allow the camera for this site in the browser settings, or type the code instead.';
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return 'No camera found on this device. Use a barcode scanner or type the code instead.';
  if (name === 'NotReadableError') return 'The camera is in use by another app. Close it and try again.';
  return 'Could not start the camera. Use a barcode scanner or type the code instead.';
}

interface Props {
  open: boolean;
  onClose: () => void;
  /** Called once with the decoded QR text; the dialog stops the camera first. */
  onResult: (text: string) => void;
}

/** Reads a member or voucher QR with the device camera. */
export function CameraScanner({ open, onClose, onResult }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [state, setState] = useState<'starting' | 'scanning' | 'error'>('starting');
  const [error, setError] = useState<string>();
  const [attempt, setAttempt] = useState(0);
  const resultRef = useRef(onResult);
  resultRef.current = onResult;

  useEffect(() => {
    if (!open) return;
    let stream: MediaStream | undefined;
    let raf = 0;
    let stopped = false;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    setState('starting');
    setError(undefined);

    const stop = () => {
      stopped = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
    };

    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError('Camera scanning needs a secure connection (HTTPS or localhost). Use a barcode scanner or type the code instead.');
        setState('error');
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
      } catch (err) {
        if (!stopped) {
          setError(cameraError(err));
          setState('error');
        }
        return;
      }
      const video = videoRef.current;
      if (stopped || !video) return stop();
      video.srcObject = stream;
      await video.play().catch(() => undefined);
      setState('scanning');
      const native = await nativeDetector();

      let last = 0;
      let busy = false;
      const tick = async (now: number) => {
        if (stopped) return;
        raf = requestAnimationFrame(tick);
        if (busy || now - last < SCAN_EVERY_MS || video.readyState < 2 || !video.videoWidth) return;
        last = now;
        busy = true;
        try {
          let text: string | undefined;
          if (native) {
            text = (await native.detect(video))[0]?.rawValue;
          } else if (ctx) {
            const scale = Math.min(1, MAX_WIDTH / video.videoWidth);
            canvas.width = Math.round(video.videoWidth * scale);
            canvas.height = Math.round(video.videoHeight * scale);
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
            text = jsQR(img.data, img.width, img.height, { inversionAttempts: 'dontInvert' })?.data;
          }
          if (text?.trim() && !stopped) {
            stop();
            haptic(20);
            resultRef.current(text.trim());
          }
        } catch {
          /* a bad frame: keep scanning */
        } finally {
          busy = false;
        }
      };
      raf = requestAnimationFrame(tick);
    })();

    return stop;
  }, [open, attempt]);

  return (
    <Dialog open={open} onClose={onClose} title="Scan QR with camera" description="Hold the customer's member or voucher QR inside the frame.">
      <div className="relative aspect-[4/3] overflow-hidden rounded-card bg-space-900">
        <video ref={videoRef} muted playsInline className={`size-full object-cover ${state === 'scanning' ? '' : 'invisible'}`} aria-label="Camera preview" />
        {state === 'scanning' && (
          <div aria-hidden className="pointer-events-none absolute inset-0 grid place-items-center">
            <div className="size-[58%] max-h-[80%] rounded-card shadow-[0_0_0_9999px_rgb(4_20_45/0.45)] ring-2 ring-white/90" style={{ aspectRatio: '1' }} />
          </div>
        )}
        {state === 'starting' && (
          <p className="absolute inset-0 grid place-items-center text-sm font-semibold text-on-space-muted">
            <span className="inline-flex items-center gap-2">
              <Loader2 className="size-4 motion-safe:animate-spin" aria-hidden />
              Starting camera…
            </span>
          </p>
        )}
        {state === 'error' && (
          <div className="absolute inset-0 grid place-items-center p-6 text-on-space-muted">
            <Camera className="size-10" aria-hidden />
          </div>
        )}
      </div>
      <p role="status" aria-live="polite" className="mt-3 text-sm text-text-2">
        {state === 'scanning' ? 'Looking for a QR code…' : state === 'starting' ? 'Allow camera access if the browser asks.' : ''}
      </p>
      {error && (
        <div className="mt-2 space-y-3">
          <InlineError>{error}</InlineError>
          <Button variant="secondary" onClick={() => setAttempt((n) => n + 1)}>
            Try again
          </Button>
        </div>
      )}
    </Dialog>
  );
}
