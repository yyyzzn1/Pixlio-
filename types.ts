
export interface GeneratedMedia {
  id: string;
  type: 'image' | 'video' | 'audio';
  url: string; // Base64 data URL or remote URL
  prompt: string;
  seed?: number;
  timestamp: number;
  aspectRatio?: string; // Track aspect ratio
  // Video specific
  baseImage?: string; 
  veoHandle?: any; // Store the Veo video object for extension
  // Audio specific (for standalone or video accompaniment)
  audioData?: string;
  audioUrl?: string; // Linked audio for video
}

export interface AppState {
  generatedMedia: GeneratedMedia[];
  selectedMediaId: string | null;
  isLoading: boolean;
  loadingMessage: string;
}

export enum GenerationType {
  IMAGE = 'IMAGE',
  VIDEO = 'VIDEO',
  AUDIO = 'AUDIO'
}
