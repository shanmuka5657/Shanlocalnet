import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Camera,
  RefreshCw,
  Zap,
  Play,
  Square,
  Pause,
  RotateCcw,
  Check,
  X,
  AlertCircle,
  Clock,
  Grid3X3
} from 'lucide-react';

interface CameraRecorderProps {
  isOpen: boolean;
  onClose: () => void;
  onVideoRecorded: (videoFile: File, previewUrl: string, duration: number) => void;
}

export const CameraRecorder: React.FC<CameraRecorderProps> = ({
  isOpen,
  onClose,
  onVideoRecorded
}) => {
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const [maxDurationSec, setMaxDurationSec] = useState<number>(30); // 15, 30, 60
  const [recordingState, setRecordingState] = useState<'idle' | 'recording' | 'paused' | 'review'>('idle');
  const [elapsedSec, setElapsedSec] = useState<number>(0);
  const [hasTorch, setHasTorch] = useState<boolean>(false);
  const [isTorchOn, setIsTorchOn] = useState<boolean>(false);
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [showGrid, setShowGrid] = useState<boolean>(false);

  const videoElementRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<any>(null);
  const countdownIntervalRef = useRef<any>(null);

  // Review state
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordedPreviewUrl, setRecordedPreviewUrl] = useState<string | null>(null);

  // Initialize camera stream
  const startCamera = useCallback(async () => {
    try {
      setPermissionError(null);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }

      const constraints: MediaStreamConstraints = {
        video: {
          facingMode,
          width: { ideal: 1080 },
          height: { ideal: 1920 }
        },
        audio: true
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoElementRef.current) {
        videoElementRef.current.srcObject = stream;
        videoElementRef.current.play().catch(() => { });
      }

      // Check for torch/flashlight capability
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        const capabilities = (videoTrack.getCapabilities && videoTrack.getCapabilities()) as any;
        if (capabilities && capabilities.torch) {
          setHasTorch(true);
        } else {
          setHasTorch(false);
        }
      }
    } catch (err: any) {
      console.error('Camera access error:', err);
      setPermissionError('Camera or microphone access denied. Please grant permission in your browser or device settings.');
    }
  }, [facingMode]);

  useEffect(() => {
    if (isOpen) {
      startCamera();
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [isOpen, startCamera]);

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    setCountdown(null);
  };

  const toggleTorch = async () => {
    if (!streamRef.current) return;
    const videoTrack = streamRef.current.getVideoTracks()[0];
    if (videoTrack && hasTorch) {
      try {
        const newTorchState = !isTorchOn;
        await (videoTrack as any).applyConstraints({
          advanced: [{ torch: newTorchState }]
        });
        setIsTorchOn(newTorchState);
      } catch (e) {
        console.warn('Torch toggle failed:', e);
      }
    }
  };

  const flipCamera = () => {
    setFacingMode(prev => (prev === 'user' ? 'environment' : 'user'));
  };

  const startRecording = () => {
    if (!streamRef.current) return;

    chunksRef.current = [];
    const mimeTypes = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4'];
    let supportedMime = mimeTypes.find(m => MediaRecorder.isTypeSupported(m)) || '';

    try {
      const options = supportedMime ? { mimeType: supportedMime } : undefined;
      const recorder = new MediaRecorder(streamRef.current, options);

      recorder.ondataavailable = e => {
        if (e.data && e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: supportedMime || 'video/webm' });
        setRecordedBlob(blob);
        const url = URL.createObjectURL(blob);
        setRecordedPreviewUrl(url);
        setRecordingState('review');
        stopCamera();
      };

      mediaRecorderRef.current = recorder;
      recorder.start(250); // Collect every 250ms
      setRecordingState('recording');
      setElapsedSec(0);

      const startTime = Date.now();
      timerIntervalRef.current = setInterval(() => {
        const elapsed = (Date.now() - startTime) / 1000;
        setElapsedSec(elapsed);

        if (elapsed >= maxDurationSec) {
          stopRecording();
        }
      }, 100);
    } catch (e: any) {
      console.error('Failed to start MediaRecorder:', e);
      setPermissionError('Failed to initialize in-app video recorder on this device.');
    }
  };

  const pauseRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.pause();
      setRecordingState('paused');
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    }
  };

  const resumeRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'paused') {
      mediaRecorderRef.current.resume();
      setRecordingState('recording');

      const resumeTime = Date.now() - elapsedSec * 1000;
      timerIntervalRef.current = setInterval(() => {
        const elapsed = (Date.now() - resumeTime) / 1000;
        setElapsedSec(elapsed);

        if (elapsed >= maxDurationSec) {
          stopRecording();
        }
      }, 100);
    }
  };

  const stopRecording = () => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  };

  const handleRetake = () => {
    if (recordedPreviewUrl) {
      URL.revokeObjectURL(recordedPreviewUrl);
      setRecordedPreviewUrl(null);
    }
    setRecordedBlob(null);
    setRecordingState('idle');
    setElapsedSec(0);
    startCamera();
  };

  const handleConfirmRecordedVideo = () => {
    if (!recordedBlob || !recordedPreviewUrl) return;

    const file = new File([recordedBlob], `short_${Date.now()}.webm`, {
      type: recordedBlob.type || 'video/webm'
    });

    onVideoRecorded(file, recordedPreviewUrl, Math.max(1, elapsedSec));
    onClose();
  };

  const handleRecordButtonPress = () => {
    if (countdown !== null) return;
    setCountdown(3);
    let count = 3;
    countdownIntervalRef.current = setInterval(() => {
      count -= 1;
      if (count <= 0) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
        setCountdown(null);
        startRecording();
      } else {
        setCountdown(count);
      }
    }, 1000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col justify-between overflow-hidden animate-in fade-in select-none">
      {/* Top Controls Overlay */}
      <div className="relative z-20 flex items-center justify-between p-4 bg-gradient-to-b from-black/80 to-transparent">
        <button
          onClick={onClose}
          className="p-2 rounded-full bg-black/40 text-white backdrop-blur-md hover:bg-black/60 transition-colors"
        >
          <X className="w-6 h-6" />
        </button>

        {/* Duration selector pill */}
        {recordingState === 'idle' && (
          <div className="flex items-center gap-1 bg-black/50 backdrop-blur-md p-1 rounded-full border border-white/10">
            {[15, 30, 60].map(d => (
              <button
                key={d}
                onClick={() => setMaxDurationSec(d)}
                className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${maxDurationSec === d
                    ? 'bg-amber-500 text-slate-950 shadow'
                    : 'text-white/70 hover:text-white'
                  }`}
              >
                {d}s
              </button>
            ))}
          </div>
        )}

        {/* Right side controls (Flip & Torch) */}
        <div className="flex items-center gap-2">
          {hasTorch && recordingState !== 'review' && (
            <button
              onClick={toggleTorch}
              className={`p-2 rounded-full backdrop-blur-md transition-colors ${isTorchOn ? 'bg-amber-500 text-slate-950' : 'bg-black/40 text-white'
                }`}
            >
              <Zap className="w-5 h-5" />
            </button>
          )}

          {recordingState !== 'review' && (
            <>
              <button
                onClick={() => setShowGrid(prev => !prev)}
                className={`p-2 rounded-full backdrop-blur-md transition-colors ${showGrid ? 'bg-white/20 text-white' : 'bg-black/40 text-white/60 hover:text-white'}`}
                title="Toggle Rule-of-Thirds Grid"
              >
                <Grid3X3 className="w-5 h-5" />
              </button>
              <button
                onClick={flipCamera}
                className="p-2 rounded-full bg-black/40 text-white backdrop-blur-md hover:bg-black/60 transition-colors"
                title="Flip Camera"
              >
                <RefreshCw className="w-5 h-5" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Center Viewport */}
      <div className="absolute inset-0 z-0 flex items-center justify-center bg-black">

        {/* Rule-of-Thirds Grid Overlay */}
        {showGrid && recordingState !== 'review' && (
          <div className="absolute inset-0 z-10 pointer-events-none">
            <div className="absolute top-1/3 left-0 right-0 h-px bg-white/25" />
            <div className="absolute top-2/3 left-0 right-0 h-px bg-white/25" />
            <div className="absolute left-1/3 top-0 bottom-0 w-px bg-white/25" />
            <div className="absolute left-2/3 top-0 bottom-0 w-px bg-white/25" />
            <div className="absolute w-2 h-2 rounded-full bg-white/50" style={{ top: 'calc(33.33% - 4px)', left: 'calc(33.33% - 4px)' }} />
            <div className="absolute w-2 h-2 rounded-full bg-white/50" style={{ top: 'calc(33.33% - 4px)', left: 'calc(66.67% - 4px)' }} />
            <div className="absolute w-2 h-2 rounded-full bg-white/50" style={{ top: 'calc(66.67% - 4px)', left: 'calc(33.33% - 4px)' }} />
            <div className="absolute w-2 h-2 rounded-full bg-white/50" style={{ top: 'calc(66.67% - 4px)', left: 'calc(66.67% - 4px)' }} />
          </div>
        )}

        {/* Countdown Overlay */}
        {countdown !== null && (
          <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none">
            <span
              key={countdown}
              className="text-white font-black drop-shadow-2xl select-none"
              style={{ fontSize: '160px', lineHeight: 1, textShadow: '0 0 40px rgba(251,191,36,0.8)' }}
            >
              {countdown}
            </span>
          </div>
        )}

        {permissionError ? (
          <div className="p-6 text-center max-w-sm flex flex-col items-center gap-3">
            <AlertCircle className="w-12 h-12 text-red-400" />
            <h4 className="text-white font-bold text-base">Camera Access Required</h4>
            <p className="text-xs text-slate-400">{permissionError}</p>
            <button
              onClick={startCamera}
              className="mt-2 px-5 py-2.5 bg-amber-500 text-slate-950 font-bold rounded-xl text-xs"
            >
              Retry Permission
            </button>
          </div>
        ) : recordingState === 'review' && recordedPreviewUrl ? (
          <video
            src={recordedPreviewUrl}
            autoPlay
            loop
            playsInline
            className="w-full h-full object-cover"
          />
        ) : (
          <video
            ref={videoElementRef}
            playsInline
            muted
            className={`w-full h-full object-cover ${facingMode === 'user' ? 'scale-x-[-1]' : ''}`}
          />
        )}
      </div>

      {/* Progress Bar (During recording) */}
      {(recordingState === 'recording' || recordingState === 'paused') && (
        <div className="relative z-20 w-full px-4 mb-2">
          <div className="w-full h-1.5 bg-white/20 rounded-full overflow-hidden">
            <div
              style={{ width: `${Math.min(100, (elapsedSec / maxDurationSec) * 100)}%` }}
              className="h-full bg-red-500 transition-all duration-100 ease-linear"
            />
          </div>
          <div className="flex justify-between items-center text-[11px] text-white/90 font-mono mt-1 font-bold">
            <span>{elapsedSec.toFixed(1)}s</span>
            <span>{maxDurationSec}s Max</span>
          </div>
        </div>
      )}

      {/* Bottom Controls */}
      <div className="relative z-20 p-6 flex items-center justify-center gap-6 bg-gradient-to-t from-black/90 via-black/40 to-transparent">
        {recordingState === 'idle' && (
          <button
            onClick={handleRecordButtonPress}
            className="w-20 h-20 rounded-full border-4 border-white p-1 flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-2xl"
            title="Tap to record (3s countdown)"
          >
            <div className="w-full h-full rounded-full bg-red-500 hover:bg-red-400" />
          </button>
        )}

        {(recordingState === 'recording' || recordingState === 'paused') && (
          <div className="flex items-center gap-6">
            {recordingState === 'recording' ? (
              <button
                onClick={pauseRecording}
                className="p-4 rounded-full bg-black/60 text-white backdrop-blur-md hover:bg-black/80"
                title="Pause"
              >
                <Pause className="w-6 h-6" />
              </button>
            ) : (
              <button
                onClick={resumeRecording}
                className="p-4 rounded-full bg-amber-500 text-slate-950 shadow-lg hover:bg-amber-400"
                title="Resume"
              >
                <Play className="w-6 h-6 fill-current" />
              </button>
            )}

            {/* Stop / Finish button */}
            <button
              onClick={stopRecording}
              className="w-18 h-18 p-4 rounded-full bg-red-600 text-white shadow-xl hover:bg-red-500"
              title="Finish Recording"
            >
              <Square className="w-8 h-8 fill-current" />
            </button>
          </div>
        )}

        {recordingState === 'review' && (
          <div className="flex items-center justify-around w-full max-w-xs">
            <button
              onClick={handleRetake}
              className="flex flex-col items-center gap-1 text-white hover:text-amber-400 text-xs font-semibold"
            >
              <div className="w-12 h-12 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center">
                <RotateCcw className="w-5 h-5" />
              </div>
              Retake
            </button>

            <button
              onClick={handleConfirmRecordedVideo}
              className="flex flex-col items-center gap-1 text-slate-950 font-bold text-xs"
            >
              <div className="w-16 h-16 rounded-full bg-gradient-to-r from-amber-500 to-yellow-500 shadow-2xl flex items-center justify-center hover:scale-105 transition-transform">
                <Check className="w-8 h-8 text-slate-950" />
              </div>
              Edit in Studio
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

