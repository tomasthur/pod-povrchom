import { useEffect, useRef, useState, useCallback } from "react";
import { Audio } from "expo-av";
import * as FileSystem from "expo-file-system/legacy";

type RecognizeResult = {
  choiceIndex: number | null;
  transcript: string;
};

type RecognizeFn = (args: {
  audioBase64: string;
  mimeType: string;
  numOptions: number;
}) => Promise<RecognizeResult>;

type UseAutoVoiceRecordingOptions = {
  active: boolean;
  numOptions: number;
  recognizeFn: RecognizeFn;
  onChoice: (index: number) => void;
  onError?: (transcript: string) => void;
  recordingDurationMs?: number;
};

type VoiceState = {
  isRecording: boolean;
  isProcessing: boolean;
  lastError: string | null;
};

export function useAutoVoiceRecording({
  active,
  numOptions,
  recognizeFn,
  onChoice,
  onError,
  recordingDurationMs = 4000,
}: UseAutoVoiceRecordingOptions) {
  const [state, setState] = useState<VoiceState>({
    isRecording: false,
    isProcessing: false,
    lastError: null,
  });

  // Stable refs for values used inside the async loop — avoids stale closures
  const numOptionsRef = useRef(numOptions);
  numOptionsRef.current = numOptions;

  const recognizeFnRef = useRef(recognizeFn);
  recognizeFnRef.current = recognizeFn;

  const onChoiceRef = useRef(onChoice);
  onChoiceRef.current = onChoice;

  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  const durationRef = useRef(recordingDurationMs);
  durationRef.current = recordingDurationMs;

  // Internal mutable refs — never in useEffect deps
  const recordingRef = useRef<Audio.Recording | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const cancelledRef = useRef(false);

  const killRecording = useCallback(async () => {
    const r = recordingRef.current;
    recordingRef.current = null;
    if (!r) return;
    try {
      await r.stopAndUnloadAsync();
    } catch {
      try { await r.unloadAsync(); } catch { /* */ }
    }
  }, []);

  const stopAndRecognize = useCallback(async () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    const r = recordingRef.current;
    if (!r) return;

    setState((s) => ({ ...s, isRecording: false, isProcessing: true, lastError: null }));

    try {
      await r.stopAndUnloadAsync();
      const uri = r.getURI();
      recordingRef.current = null;

      if (!uri) {
        setState((s) => ({ ...s, isProcessing: false, lastError: "Nahrávka zlyhala." }));
        return;
      }

      const audioBase64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      const result = await recognizeFnRef.current({
        audioBase64,
        mimeType: "audio/m4a",
        numOptions: numOptionsRef.current,
      });

      if (cancelledRef.current) return;

      if (result.choiceIndex !== null && result.choiceIndex >= 0 && result.choiceIndex < numOptionsRef.current) {
        setState((s) => ({ ...s, isProcessing: false, lastError: null }));
        onChoiceRef.current(result.choiceIndex);
      } else {
        const msg = result.transcript
          ? `Rozpoznané: "${result.transcript}"`
          : "Nerozpoznané";
        setState((s) => ({ ...s, isProcessing: false, lastError: msg }));
        onErrorRef.current?.(result.transcript);
      }
    } catch (err: any) {
      recordingRef.current = null;
      if (!cancelledRef.current) {
        setState((s) => ({ ...s, isProcessing: false, lastError: err?.message ?? "Chyba rozpoznávania" }));
      }
    } finally {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        staysActiveInBackground: false,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      }).catch(() => {});
    }
  }, []);

  useEffect(() => {
    if (!active || numOptions === 0) {
      // Cleanup when deactivated
      cancelledRef.current = true;
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      killRecording().then(() => {
        setState({ isRecording: false, isProcessing: false, lastError: null });
      });
      return;
    }

    cancelledRef.current = false;

    const runCycle = async () => {
      if (cancelledRef.current) return;

      // 1) Kill any existing recording
      await killRecording();
      if (cancelledRef.current) return;

      // 2) Request permission
      const perm = await Audio.requestPermissionsAsync();
      if (!perm.granted) {
        if (!cancelledRef.current) {
          setState((s) => ({ ...s, lastError: "Mikrofón je zablokovaný" }));
        }
        return;
      }
      if (cancelledRef.current) return;

      // 3) Configure audio mode for recording
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });
      if (cancelledRef.current) return;

      // 4) Create and start recording
      try {
        const recording = new Audio.Recording();
        await recording.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
        if (cancelledRef.current) {
          await recording.stopAndUnloadAsync().catch(() => {});
          return;
        }
        await recording.startAsync();
        recordingRef.current = recording;
        if (!cancelledRef.current) {
          setState((s) => ({ ...s, isRecording: true, lastError: null }));
        }
      } catch (err: any) {
        if (!cancelledRef.current) {
          setState((s) => ({ ...s, lastError: err?.message ?? "Nepodarilo sa nahrávať" }));
        }
        return;
      }

      if (cancelledRef.current) {
        await killRecording();
        return;
      }

      // 5) Schedule auto-stop after duration
      timeoutRef.current = setTimeout(async () => {
        timeoutRef.current = null;
        if (cancelledRef.current) return;

        await stopAndRecognize();

        // 6) If still active and not cancelled, retry
        if (!cancelledRef.current) {
          // Small delay before retrying to let UI settle
          await new Promise((r) => setTimeout(r, 1000));
          if (!cancelledRef.current) {
            runCycle();
          }
        }
      }, durationRef.current);
    };

    // Small initial delay to let expo-av settle after state transitions
    const initTimeout = setTimeout(() => {
      if (!cancelledRef.current) {
        runCycle();
      }
    }, 500);

    return () => {
      cancelledRef.current = true;
      clearTimeout(initTimeout);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      killRecording();
    };
  }, [active, numOptions, killRecording, stopAndRecognize]);

  return {
    isRecording: state.isRecording,
    isProcessing: state.isProcessing,
    lastError: state.lastError,
    stopAndRecognize,
  };
}
