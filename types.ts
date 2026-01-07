
export interface ImageState {
  originalUrl: string;
  editedUrl?: string;
  prompt?: string;
  isProcessing: boolean;
  error?: string;
}

export interface EditHistoryItem {
  id: string;
  url: string;
  prompt: string;
  timestamp: number;
}
