export function supportsAudioRecording(): boolean {
  return typeof window !== 'undefined' && 'MediaRecorder' in window;
}

export async function createAudioRecorder(): Promise<never> {
  throw new Error('audioRecorder scaffold only');
}
