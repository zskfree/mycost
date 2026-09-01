export interface AudioRecordingSession {
  stop: () => Promise<File>;
  cancel: () => void;
  mimeType: string;
}

export function supportsAudioRecording(): boolean {
  return typeof window !== 'undefined' && 'MediaRecorder' in window && Boolean(navigator.mediaDevices?.getUserMedia);
}

export async function startAudioRecording(): Promise<AudioRecordingSession> {
  if (!supportsAudioRecording()) {
    throw new Error('当前浏览器不支持录音');
  }

  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const mimeType = pickMimeType();
  const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
  const chunks: BlobPart[] = [];

  recorder.ondataavailable = (event) => {
    if (event.data.size > 0) {
      chunks.push(event.data);
    }
  };

  recorder.start();

  return {
    mimeType: recorder.mimeType,
    stop: () =>
      new Promise<File>((resolve) => {
        recorder.onstop = () => {
          stopStream(stream);
          const blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' });
          const extension = inferExtension(blob.type);
          resolve(new File([blob], `mycost_voice.${extension}`, { type: blob.type }));
        };
        recorder.stop();
      }),
    cancel: () => {
      if (recorder.state !== 'inactive') {
        recorder.stop();
      }
      stopStream(stream);
    },
  };
}

function pickMimeType(): string {
  const candidates = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm', 'audio/wav'];
  return candidates.find((candidate) => MediaRecorder.isTypeSupported(candidate)) ?? '';
}

function inferExtension(mimeType: string): string {
  if (mimeType.includes('mp4')) return 'm4a';
  if (mimeType.includes('wav')) return 'wav';
  return 'webm';
}

function stopStream(stream: MediaStream): void {
  for (const track of stream.getTracks()) {
    track.stop();
  }
}
