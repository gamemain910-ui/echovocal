
export enum VoiceName {
  Kore = 'Kore',
  Puck = 'Puck',
  Charon = 'Charon',
  Fenrir = 'Fenrir',
  Zephyr = 'Zephyr',
  Custom = 'Kustom (Deskripsi)'
}

export interface GeneratedAudio {
  id: string;
  text: string;
  voice: VoiceName;
  timestamp: number;
  url: string;
  blob: Blob;
  config: TTSConfig;
}

export interface TTSConfig {
  voice: VoiceName;
  emotion: string;
  speed: number;
  pitch: number;
  voiceDescription: string;
  referenceAudio?: {
    data: string; // base64
    mimeType: string;
  };
}
