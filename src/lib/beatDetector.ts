/**
 * LocalNet Audio Beat Sync Engine
 * Real-time Web Audio API frequency & energy peak detection
 * Auto-detects tempo (BPM), musical onsets, and drop points for vertical reel editing.
 */

export interface BeatAnalysisResult {
  bpm: number;
  beats: number[]; // Timestamps in seconds of every detected rhythm beat
  drops: number[]; // Major accented measure markers (every 4 or 8 beats)
  isFallback?: boolean;
}

/**
 * Creates algorithmic rhythm beats as a graceful fallback when external audio has CORS restrictions.
 */
export function generateSyntheticBeats(duration: number, targetBpm: number = 124): BeatAnalysisResult {
  const safeDuration = Math.max(1, duration);
  const secondsPerBeat = 60 / targetBpm;
  const beats: number[] = [];
  const drops: number[] = [];

  let t = 0.25; // initial lead-in
  let beatCount = 0;
  while (t < safeDuration) {
    beats.push(Number(t.toFixed(3)));
    if (beatCount % 4 === 0) {
      drops.push(Number(t.toFixed(3)));
    }
    t += secondsPerBeat;
    beatCount++;
  }

  return {
    bpm: targetBpm,
    beats,
    drops,
    isFallback: true
  };
}

/**
 * Snaps a given timestamp to the nearest detected beat marker within a tolerance window.
 */
export function snapTimeToNearestBeat(
  time: number,
  beats: number[],
  toleranceSeconds: number = 0.2
): { snappedTime: number; isSnapped: boolean } {
  if (!beats || beats.length === 0) {
    return { snappedTime: time, isSnapped: false };
  }

  let closestBeat = beats[0];
  let minDiff = Math.abs(time - closestBeat);

  for (let i = 1; i < beats.length; i++) {
    const diff = Math.abs(time - beats[i]);
    if (diff < minDiff) {
      minDiff = diff;
      closestBeat = beats[i];
    }
  }

  if (minDiff <= toleranceSeconds) {
    return { snappedTime: closestBeat, isSnapped: true };
  }

  return { snappedTime: time, isSnapped: false };
}

/**
 * Analyzes an AudioBuffer using an energy threshold peak-detection algorithm.
 */
function analyzeAudioBuffer(audioBuffer: AudioBuffer): BeatAnalysisResult {
  const sampleRate = audioBuffer.sampleRate;
  const channelData = audioBuffer.getChannelData(0); // Primary left/mono channel
  const duration = audioBuffer.duration;

  // Window size of ~20ms (e.g. 1024 samples at 44.1kHz)
  const windowSize = 1024;
  const hopSize = 512;
  const numWindows = Math.floor((channelData.length - windowSize) / hopSize);

  if (numWindows <= 0) {
    return generateSyntheticBeats(duration, 120);
  }

  // 1. Compute frame energy with emphasis on transients
  const energies = new Float32Array(numWindows);
  for (let i = 0; i < numWindows; i++) {
    const offset = i * hopSize;
    let sum = 0;
    for (let j = 0; j < windowSize; j++) {
      const val = channelData[offset + j];
      sum += val * val;
    }
    energies[i] = Math.sqrt(sum / windowSize);
  }

  // 2. Compute local moving average to detect onsets above background volume
  const localWindow = Math.floor(sampleRate / hopSize * 0.4); // 0.4s local window
  const peaks: number[] = [];
  const minIntervalSamples = Math.floor(sampleRate / hopSize * 0.28); // minimum 0.28s between beats (~214 max BPM)
  let lastPeakIndex = -minIntervalSamples;

  for (let i = localWindow; i < numWindows - localWindow; i++) {
    // Local mean
    let localSum = 0;
    for (let k = i - localWindow; k <= i + localWindow; k++) {
      localSum += energies[k];
    }
    const localMean = localSum / (localWindow * 2 + 1);

    // Dynamic sensitivity multiplier
    const threshold = localMean * 1.38;

    if (
      energies[i] > threshold &&
      energies[i] > energies[i - 1] &&
      energies[i] >= energies[i + 1] &&
      i - lastPeakIndex >= minIntervalSamples
    ) {
      const timestamp = (i * hopSize) / sampleRate;
      peaks.push(Number(timestamp.toFixed(3)));
      lastPeakIndex = i;
    }
  }

  if (peaks.length < 4) {
    return generateSyntheticBeats(duration, 124);
  }

  // 3. Estimate BPM from median peak intervals
  const intervals: number[] = [];
  for (let i = 1; i < peaks.length; i++) {
    intervals.push(peaks[i] - peaks[i - 1]);
  }
  intervals.sort((a, b) => a - b);
  const medianInterval = intervals[Math.floor(intervals.length / 2)];
  let estimatedBpm = Math.round(60 / medianInterval);

  // Normalize BPM to realistic 70 - 165 range
  while (estimatedBpm < 70) estimatedBpm *= 2;
  while (estimatedBpm > 165) estimatedBpm = Math.round(estimatedBpm / 2);

  // 4. Identify measure drops (every 4th detected beat)
  const drops: number[] = [];
  for (let i = 0; i < peaks.length; i += 4) {
    drops.push(peaks[i]);
  }

  return {
    bpm: estimatedBpm,
    beats: peaks,
    drops,
    isFallback: false
  };
}

/**
 * Extracts and analyzes audio beats from a local File (video or audio) with 0 CORS issues.
 */
export async function detectBeatsFromFile(file: File): Promise<BeatAnalysisResult> {
  const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioContextClass) {
    return generateSyntheticBeats(30, 120);
  }

  const audioCtx = new AudioContextClass();
  try {
    const arrayBuffer = await file.arrayBuffer();
    const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
    return analyzeAudioBuffer(audioBuffer);
  } catch {
    return generateSyntheticBeats(30, 124);
  } finally {
    try {
      await audioCtx.close();
    } catch {}
  }
}

/**
 * Analyzes audio beats from a media URL (CDN background track or video URL).
 */
export async function detectBeatsFromUrl(url: string, fallbackDuration = 30): Promise<BeatAnalysisResult> {
  const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioContextClass) {
    return generateSyntheticBeats(fallbackDuration, 120);
  }

  try {
    const response = await fetch(url, { mode: 'cors' });
    if (!response.ok) {
      throw new Error(`Fetch failed: ${response.status}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    const audioCtx = new AudioContextClass();
    try {
      const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
      return analyzeAudioBuffer(audioBuffer);
    } finally {
      try {
        await audioCtx.close();
      } catch {}
    }
  } catch {
    // If CORS is blocked on third-party sound preview URL, fallback gracefully to mathematical rhythm grid
    return generateSyntheticBeats(fallbackDuration, 124);
  }
}

