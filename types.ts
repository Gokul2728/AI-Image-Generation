
export interface ImageState {
  originalUrl: string;
  editedUrl?: string;
  prompt?: string;
  isProcessing: boolean;
  showComparison?: boolean;
  error?: string;
}

export interface EditHistoryItem {
  id: string;
  url: string;
  prompt: string;
  timestamp: number;
}

export interface SuggestedPrompt {
  id: string;
  label: string;
  icon: string;
  prompt: string;
}
