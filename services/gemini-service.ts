
import { GoogleGenAI, Modality } from "@google/genai";
import { VoiceName, TTSConfig } from "../types";
import { decodeBase64, decodePCMToAudioBuffer, audioBufferToWavBlob } from "../utils/audio-utils";

export class GeminiTTSService {
  private apiKey: string;

  constructor() {
    // Default ke env var, tapi izinkan override manual
    this.apiKey = process.env.API_KEY || "";
  }

  setApiKey(key: string) {
    this.apiKey = key;
  }

  getApiKey(): string {
    return this.apiKey;
  }

  async generateSpeech(text: string, config: TTSConfig): Promise<{ blob: Blob; url: string }> {
    if (!this.apiKey) {
      throw new Error("API Key belum diatur. Silakan masukkan API Key Google Gemini Anda di menu pengaturan.");
    }

    if (!text.trim()) throw new Error("Teks kosong");

    // Gunakan key yang tersimpan di class instance
    const ai = new GoogleGenAI({ apiKey: this.apiKey });

    const isCustom = config.voice === VoiceName.Custom;
    const hasReference = !!config.referenceAudio;
    
    // Tentukan model
    const modelName = hasReference 
      ? "gemini-2.5-flash-native-audio-preview-12-2025" 
      : "gemini-2.5-flash-preview-tts";

    const baseVoice = isCustom ? "Kore" : config.voice;

    const speedText = config.speed === 1 ? "" : config.speed > 1 ? "fast-paced" : "slow-paced";
    const pitchText = config.pitch === 0 ? "" : config.pitch > 0 ? "high-pitched" : "deep/low-pitched";
    const customDesc = config.voiceDescription.trim();
    
    let instruction = "";
    const parts: any[] = [];

    if (hasReference && config.referenceAudio) {
      parts.push({
        inlineData: {
          data: config.referenceAudio.data,
          mimeType: config.referenceAudio.mimeType
        }
      });
      instruction = `MIMICRY MODE: Listen to the provided audio reference carefully. 
      Analyze the speaker's timbre, pitch, and prosody. 
      Generate speech for the provided text by strictly mimicking the voice in the audio reference. 
      Apply these modifiers if possible: ${config.emotion}, ${speedText}, ${pitchText}. Additional context: ${customDesc}`;
    } else if (isCustom) {
      instruction = `Adopt this vocal profile: [${customDesc}, ${config.emotion}, ${speedText}, ${pitchText}].`;
    } else {
      instruction = `Speak in a ${config.emotion} tone with ${speedText} ${pitchText} modifiers. ${customDesc}`;
    }

    parts.push({ text: `${instruction}\n\nTEXT TO SPEAK: ${text}` });

    try {
      const response = await ai.models.generateContent({
        model: modelName,
        contents: [{ parts }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: baseVoice as any },
            },
          },
        },
      });

      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      
      if (!base64Audio) {
        throw new Error("Gagal menerima data audio. Respons API kosong.");
      }

      const pcmData = decodeBase64(base64Audio);
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      const audioBuffer = await decodePCMToAudioBuffer(pcmData, audioCtx, 24000, 1);
      
      const wavBlob = audioBufferToWavBlob(audioBuffer);
      const url = URL.createObjectURL(wavBlob);
      
      return { blob: wavBlob, url };
    } catch (error: any) {
      console.error("TTS Generation Error:", error);
      
      const errMsg = error?.message || "";
      
      if (errMsg.includes("404") || errMsg.includes("NOT_FOUND")) {
        throw new Error("Model tidak ditemukan atau akses ditolak (404). Coba ganti API Key dengan akun yang memiliki akses ke model Gemini 2.5 Preview.");
      }
      if (errMsg.includes("429") || errMsg.includes("Quota")) {
        throw new Error("Kuota API Key habis (429). Silakan ganti API Key melalui tombol di pojok kanan atas.");
      }
      if (errMsg.includes("API key")) {
        throw new Error("API Key tidak valid. Periksa pengaturan kunci Anda.");
      }
      if (errMsg.includes("modality")) {
        throw new Error("Kombinasi input tidak didukung oleh model ini.");
      }

      throw error;
    }
  }
}

export const ttsService = new GeminiTTSService();
