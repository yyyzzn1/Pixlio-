
import { GoogleGenAI, Modality } from "@google/genai";

// Helper to get API key (simulating the environment requirement)
const getApiKey = (): string => {
  const key = process.env.API_KEY;
  if (!key) {
    throw new Error("API Key not found");
  }
  return key;
};

// Helper to ensure Veo key selection
export const checkVeoKeySelection = async (): Promise<boolean> => {
  // @ts-ignore
  if (window.aistudio && window.aistudio.hasSelectedApiKey) {
    // @ts-ignore
    const hasKey = await window.aistudio.hasSelectedApiKey();
    if (!hasKey) {
       // @ts-ignore
       await window.aistudio.openSelectKey();
       return false; // Might need user to retry
    }
    return true;
  }
  return true; // Fallback if not running in the specific environment
};

/**
 * Generate a single image
 */
const generateSingleImage = async (
  prompt: string, 
  seed?: number, 
  baseImage?: string,
  aspectRatio: string = "1:1"
): Promise<{ url: string; seed: number }> => {
  const ai = new GoogleGenAI({ apiKey: getApiKey() });
  
  // Use a random seed if none provided
  const actualSeed = seed !== undefined ? seed : Math.floor(Math.random() * 2147483647);

  const model = "gemini-2.5-flash-image";
  
  const parts: any[] = [];
  
  if (baseImage) {
    // If editing, include the base image
    const base64Data = baseImage.split(',')[1];
    parts.push({
      inlineData: {
        data: base64Data,
        mimeType: 'image/png'
      }
    });
  }
  
  parts.push({ text: prompt });

  const response = await ai.models.generateContent({
    model: model,
    contents: {
      parts: parts
    },
    config: {
      seed: actualSeed,
      imageConfig: {
        aspectRatio: aspectRatio
      }
    }
  });

  // Extract Image
  for (const part of response.candidates?.[0]?.content?.parts || []) {
    if (part.inlineData) {
      return {
        url: `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`,
        seed: actualSeed
      };
    }
  }

  throw new Error("No image generated.");
};

/**
 * Generate 2 image variations in parallel
 */
export const generateImagesParallel = async (
    prompt: string,
    baseSeed?: number,
    aspectRatio: string = "1:1"
): Promise<Array<{ url: string; seed: number }>> => {
    // If seed is locked (provided), we vary the second one slightly (seed + 1)
    // so we get consistent style but different results if supported, 
    // or two distinct generations if random.
    
    const seed1 = baseSeed !== undefined ? baseSeed : Math.floor(Math.random() * 2000000000);
    const seed2 = baseSeed !== undefined ? baseSeed + 1 : Math.floor(Math.random() * 2000000000);

    const promises = [
        generateSingleImage(prompt, seed1, undefined, aspectRatio),
        generateSingleImage(prompt, seed2, undefined, aspectRatio)
    ];

    return Promise.all(promises);
};

// Export single for editing usage
export const generateImage = generateSingleImage;

/**
 * Generate Video using Veo
 */
export const generateVideo = async (
  prompt: string,
  baseImageUrl: string,
  aspectRatio: string = '16:9'
): Promise<{ url: string; videoMetadata: any; aspectRatio: string }> => {
  // Check for paid key for Veo
  await checkVeoKeySelection();

  const ai = new GoogleGenAI({ apiKey: getApiKey() });

  const base64Data = baseImageUrl.split(',')[1];
  const mimeType = baseImageUrl.substring(baseImageUrl.indexOf(':') + 1, baseImageUrl.indexOf(';'));

  // Ensure aspect ratio is supported. Veo supports 16:9 or 9:16. 
  let validAspectRatio = '16:9';
  if (aspectRatio === '9:16') validAspectRatio = '9:16';
  
  // Force adding motion keywords to ensure the image moves
  const motionEnhancedPrompt = `${prompt}, cinematic movement, high motion, 4k video, detailed animation`;

  // NOTE: Using 'veo-3.1-generate-preview' (Standard) ensures better prompt adherence and extension capability.
  let operation = await ai.models.generateVideos({
    model: 'veo-3.1-generate-preview', 
    prompt: motionEnhancedPrompt, 
    image: {
      imageBytes: base64Data,
      mimeType: mimeType,
    },
    config: {
      numberOfVideos: 1,
      resolution: '720p', // Must be 720p to allow future extension
      aspectRatio: validAspectRatio 
    }
  });

  // Polling loop
  while (!operation.done) {
    await new Promise(resolve => setTimeout(resolve, 5000));
    operation = await ai.operations.getVideosOperation({ operation: operation });
    
    if (operation.error) {
        throw new Error(`Video Generation Error: ${operation.error.message || 'Unknown error'}`);
    }
  }

  const generatedVideo = operation.response?.generatedVideos?.[0];
  const videoUri = generatedVideo?.video?.uri;
  
  if (!videoUri) throw new Error("Video generation failed or returned no URI");

  // Fetch the actual video bytes
  const videoResponse = await fetch(`${videoUri}&key=${getApiKey()}`);
  const blob = await videoResponse.blob();
  
  return {
      url: URL.createObjectURL(blob),
      videoMetadata: generatedVideo?.video, // Return the video object for future extension
      aspectRatio: validAspectRatio
  };
};

/**
 * Extend an existing video
 */
export const extendVideo = async (
    prompt: string,
    previousVideoMetadata: any,
    previousAspectRatio: string
): Promise<{ url: string; videoMetadata: any; aspectRatio: string }> => {
    await checkVeoKeySelection();
    const ai = new GoogleGenAI({ apiKey: getApiKey() });

    if (!previousVideoMetadata) {
        throw new Error("Cannot extend: Missing previous video data. The original video might not be compatible.");
    }

    // STRICT REQUIREMENT: Resolution must be 720p for extension.
    // STRICT REQUIREMENT: Aspect Ratio must match the previous video.
    const validAspectRatio = previousAspectRatio === '9:16' ? '9:16' : '16:9';

    // Extension must use the standard generate-preview model
    let operation = await ai.models.generateVideos({
        model: 'veo-3.1-generate-preview',
        prompt: prompt || "Continue the action", 
        video: previousVideoMetadata,
        config: {
            numberOfVideos: 1,
            resolution: '720p', 
            aspectRatio: validAspectRatio
        }
    });

    while (!operation.done) {
        await new Promise(resolve => setTimeout(resolve, 5000));
        operation = await ai.operations.getVideosOperation({ operation: operation });

        if (operation.error) {
            throw new Error(`Video Extension Error: ${operation.error.message || 'Unknown error'}`);
        }
    }

    const generatedVideo = operation.response?.generatedVideos?.[0];
    const videoUri = generatedVideo?.video?.uri;
    
    if (!videoUri) throw new Error("Video extension failed");

    const videoResponse = await fetch(`${videoUri}&key=${getApiKey()}`);
    const blob = await videoResponse.blob();

    return {
        url: URL.createObjectURL(blob),
        videoMetadata: generatedVideo?.video,
        aspectRatio: validAspectRatio
    };
}

/**
 * Generate Sound Effects / Ambient Audio
 */
export const generateSoundEffect = async (prompt: string): Promise<string> => {
    const ai = new GoogleGenAI({ apiKey: getApiKey() });
    
    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-native-audio-preview-09-2025",
        contents: [{ parts: [{ text: `Generate a high quality sound effect: ${prompt}` }] }],
        config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: { voiceName: 'Kore' }, 
                },
            },
        },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) throw new Error("No audio generated");

    return base64Audio;
};

// Simple WAV header generator
export const pcmToWav = (pcmBase64: string): string => {
    const pcmData = atob(pcmBase64);
    const numChannels = 1;
    const sampleRate = 24000;
    const bitsPerSample = 16;
    const byteRate = sampleRate * numChannels * bitsPerSample / 8;
    const blockAlign = numChannels * bitsPerSample / 8;
    const dataSize = pcmData.length;
    const chunkSize = 36 + dataSize;

    const buffer = new ArrayBuffer(44 + dataSize);
    const view = new DataView(buffer);

    const writeString = (view: DataView, offset: number, string: string) => {
        for (let i = 0; i < string.length; i++) {
            view.setUint8(offset + i, string.charCodeAt(i));
        }
    };

    writeString(view, 0, 'RIFF');
    view.setUint32(4, chunkSize, true);
    writeString(view, 8, 'WAVE');
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitsPerSample, true);
    writeString(view, 36, 'data');
    view.setUint32(40, dataSize, true);

    const pcmBytes = new Uint8Array(pcmData.length);
    for(let i=0; i< pcmData.length; i++) {
        pcmBytes[i] = pcmData.charCodeAt(i);
    }
    
    new Uint8Array(buffer, 44).set(pcmBytes);

    const blob = new Blob([buffer], { type: 'audio/wav' });
    return URL.createObjectURL(blob);
}
