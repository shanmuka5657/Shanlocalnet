/**
 * LocalNet Short Creation Studio — Core Type Definitions
 * Professional Multi-Layer Video Architecture
 */

export type OverlayType =
  | 'text'
  | 'image'
  | 'emoji'
  | 'sticker'
  | 'gif'
  | 'price'
  | 'merchant'
  | 'coupon'
  | 'product';

export interface OverlayPosition {
  x: number; // percentage 0 - 100
  y: number; // percentage 0 - 100
}

export interface OverlaySize {
  width: number; // percentage 0 - 100 or px
  height: number;
}

export interface OverlayStyle {
  color?: string;
  backgroundColor?: string;
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: string | number;
  textAlign?: 'left' | 'center' | 'right';
  borderRadius?: number;
  borderColor?: string;
  borderWidth?: number;
  boxShadow?: string;
  textShadow?: string;
}

export interface VideoOverlay {
  id: string;
  type: OverlayType;
  label?: string;

  // Media or text content
  assetUrl?: string;
  content?: string;

  // Timeline timing (in seconds)
  startTime: number;
  endTime: number;

  // Spatial coordinates
  position: OverlayPosition;
  size: OverlaySize;
  rotation: number; // degrees -180 to 180
  opacity: number; // 0.0 to 1.0
  zIndex: number;

  style?: OverlayStyle;

  animation?: {
    entrance?: 'fade' | 'pop' | 'slide-up' | 'bounce';
    exit?: 'fade' | 'slide-down' | 'shrink';
    loop?: 'pulse' | 'glow' | 'none';
  };

  metadata?: {
    originalPrice?: number;
    discountPrice?: number;
    discountPercent?: number;
    productName?: string;
    storeName?: string;
    storeAddress?: string;
    directionsUrl?: string;
    couponCode?: string;
    couponDiscount?: string;
    productId?: string;
    isCustomDrawn?: boolean;
    [key: string]: any;
  };
}

export interface FilterPreset {
  id: string;
  name: string;
  cssFilter: string;
  previewColor: string;
}

export interface CustomStickerItem {
  id: string;
  dataUrl: string;
  createdAt: number;
  isDrawn?: boolean;
  name?: string;
}

export interface VideoProject {
  id: string;
  sourceType: 'camera' | 'gallery';
  sourceUrl: string;
  sourceFile?: File;
  sourceFilename?: string;
  duration: number;
  width: number;
  height: number;
  aspectRatio: string;

  // Multi-layer overlays
  overlays: VideoOverlay[];

  // Trimming
  trimStart: number;
  trimEnd: number;

  // Video adjustments
  activeFilter: string;
  brightness: number; // 0.5 to 1.5 (default 1.0)
  contrast: number; // 0.5 to 1.5 (default 1.0)
  saturation: number; // 0.0 to 2.0 (default 1.0)
  playbackSpeed: number; // 0.5, 1.0, 2.0

  // Audio adjustments
  originalAudioVolume: number; // 0.0 to 1.0
  isOriginalAudioMuted: boolean;
  backgroundMusicUrl?: string;
  backgroundMusicTitle?: string;
  backgroundMusicVolume: number; // 0.0 to 1.0

  // Poster & Publish
  posterTimestamp: number;
  posterDataUrl?: string;
  caption?: string;
  tags?: string[];
  scope?: string;
  updatedAt: number;
}

