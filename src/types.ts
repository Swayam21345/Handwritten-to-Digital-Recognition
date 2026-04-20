export interface Prediction {
  char: string;
  confidence: number;
}

export interface RecognitionResult {
  id: string;
  text: string;
  predictions: Prediction[];
  timestamp: number;
  imageUrl: string;
  heatmapUrl?: string;
}

export interface HistoryItem {
  id: string;
  text: string;
  timestamp: number;
  imageUrl: string;
}
