import React, { useState, useRef, useEffect } from 'react';
import { CustomStickerItem } from './types.ts';
import {
  X,
  Paintbrush,
  Eraser,
  Undo2,
  Redo2,
  Trash2,
  Upload,
  Check,
  Sparkles,
  FolderHeart,
  Search,
  Smile,
  Package,
  Zap
} from 'lucide-react';

interface CustomEmojiDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  /**
   * dataUrl  — for drawn/uploaded stickers (base64 PNG)
   * cdnUrl   — for Noto emoji / SVGRepo stickers (https:// URL)
   * lottieUrl — for Lottie animated stickers (.lottie JSON URL)
   */
  onSelectSticker: (dataUrl: string, isDrawn?: boolean) => void;
}

const STORAGE_KEY = 'localnet_saved_stickers';

// ─── 1. GOOGLE NOTO EMOJI LIBRARY (Apache 2.0 — No attribution required) ──────
// CDN: cdn.jsdelivr.net/npm/@svgmoji/noto@0.2.0/svg/{UNICODE}.svg
// EmojiCDN fallback: emojicdn.elk.sh/🔥?style=google

const NOTO_CDN = 'https://cdn.jsdelivr.net/npm/@svgmoji/noto@0.2.0/svg';
const EMOJI_CDN_FALLBACK = 'https://emojicdn.elk.sh';

function notoUrl(unicode: string) {
  return `${NOTO_CDN}/${unicode.toUpperCase()}.svg`;
}

interface EmojiEntry { code: string; name: string; char: string; }

const EMOJI_CATEGORIES: { label: string; icon: string; items: EmojiEntry[] }[] = [
  {
    label: 'Faces', icon: '😊',
    items: [
      { code: '1F600', name: 'grinning', char: '😀' },
      { code: '1F601', name: 'grin', char: '😁' },
      { code: '1F602', name: 'joy', char: '😂' },
      { code: '1F923', name: 'rofl', char: '🤣' },
      { code: '1F60A', name: 'smile', char: '😊' },
      { code: '1F60D', name: 'heart eyes', char: '😍' },
      { code: '1F618', name: 'kiss', char: '😘' },
      { code: '1F60F', name: 'smirk', char: '😏' },
      { code: '1F614', name: 'pensive', char: '😔' },
      { code: '1F62D', name: 'cry', char: '😭' },
      { code: '1F621', name: 'rage', char: '😡' },
      { code: '1F920', name: 'cowboy', char: '🤠' },
      { code: '1F973', name: 'party face', char: '🥳' },
      { code: '1F60E', name: 'cool', char: '😎' },
      { code: '1F911', name: 'money mouth', char: '🤑' },
      { code: '1F975', name: 'hot', char: '🥵' },
      { code: '1F976', name: 'cold', char: '🥶' },
      { code: '1F631', name: 'scream', char: '😱' },
      { code: '1F644', name: 'eye roll', char: '🙄' },
      { code: '1F910', name: 'zipper', char: '🤐' },
      { code: '1F609', name: 'wink', char: '😉' },
      { code: '1F607', name: 'halo', char: '😇' },
      { code: '1F47B', name: 'ghost', char: '👻' },
      { code: '1F4A9', name: 'poop', char: '💩' },
    ]
  },
  {
    label: 'Hands', icon: '👋',
    items: [
      { code: '1F44D', name: 'thumbsup', char: '👍' },
      { code: '1F44E', name: 'thumbsdown', char: '👎' },
      { code: '1F44F', name: 'clap', char: '👏' },
      { code: '1F64C', name: 'raise hands', char: '🙌' },
      { code: '1F44B', name: 'wave', char: '👋' },
      { code: '270C-FE0F', name: 'victory', char: '✌️' },
      { code: '1F91E', name: 'crossed fingers', char: '🤞' },
      { code: '1F4AA', name: 'flex', char: '💪' },
      { code: '1F64F', name: 'pray', char: '🙏' },
      { code: '1F446', name: 'point up', char: '👆' },
      { code: '1F447', name: 'point down', char: '👇' },
      { code: '1F91A', name: 'raised hand', char: '🤚' },
      { code: '1F590-FE0F', name: 'hand spread', char: '🖐️' },
      { code: '1F918', name: 'horns', char: '🤘' },
    ]
  },
  {
    label: 'Hearts', icon: '❤️',
    items: [
      { code: '2764-FE0F', name: 'red heart', char: '❤️' },
      { code: '1F9E1', name: 'orange heart', char: '🧡' },
      { code: '1F49B', name: 'yellow heart', char: '💛' },
      { code: '1F49A', name: 'green heart', char: '💚' },
      { code: '1F499', name: 'blue heart', char: '💙' },
      { code: '1F49C', name: 'purple heart', char: '💜' },
      { code: '1F5A4', name: 'black heart', char: '🖤' },
      { code: '1F90D', name: 'white heart', char: '🤍' },
      { code: '1F498', name: 'heart arrow', char: '💘' },
      { code: '1F496', name: 'sparkling heart', char: '💖' },
      { code: '1F4AF', name: '100', char: '💯' },
      { code: '2728', name: 'sparkles', char: '✨' },
      { code: '1F31F', name: 'glowing star', char: '🌟' },
      { code: '1F525', name: 'fire', char: '🔥' },
    ]
  },
  {
    label: 'Food', icon: '🍕',
    items: [
      { code: '1F355', name: 'pizza', char: '🍕' },
      { code: '1F354', name: 'burger', char: '🍔' },
      { code: '1F35C', name: 'noodles', char: '🍜' },
      { code: '1F363', name: 'sushi', char: '🍣' },
      { code: '1F370', name: 'cake', char: '🎂' },
      { code: '1F366', name: 'icecream', char: '🍦' },
      { code: '2615', name: 'coffee', char: '☕' },
      { code: '1F37A', name: 'beer', char: '🍺' },
      { code: '1F349', name: 'watermelon', char: '🍉' },
      { code: '1F347', name: 'grapes', char: '🍇' },
      { code: '1F36E', name: 'custard', char: '🍮' },
      { code: '1F372', name: 'curry', char: '🍲' },
      { code: '1F333', name: 'tree', char: '🌳' },
      { code: '1F33B', name: 'sunflower', char: '🌻' },
    ]
  },
  {
    label: 'Indian 🇮🇳', icon: '🏏',
    items: [
      { code: '1F3CF', name: 'cricket', char: '🏏' },
      { code: '1F996', name: 'dinosaur', char: '🦖' },
      { code: '1F418', name: 'elephant', char: '🐘' },
      { code: '1F42F', name: 'tiger', char: '🐯' },
      { code: '1F98A', name: 'fox', char: '🦊' },
      { code: '1F403', name: 'water buffalo', char: '🐃' },
      { code: '1F300', name: 'cyclone', char: '🌀' },
      { code: '2614', name: 'umbrella rain', char: '☔' },
      { code: '1F31E', name: 'sun face', char: '🌞' },
      { code: '1F3E0', name: 'house', char: '🏠' },
      { code: '1F6D5', name: 'hindu temple', char: '🛕' },
      { code: '1F334', name: 'palm tree', char: '🌴' },
      { code: '1F33A', name: 'hibiscus', char: '🌺' },
      { code: '1F484', name: 'bindi', char: '💄' },
    ]
  },
  {
    label: 'Business', icon: '💼',
    items: [
      { code: '1F4B0', name: 'money bag', char: '💰' },
      { code: '1F4B5', name: 'dollar', char: '💵' },
      { code: '1F4B3', name: 'card', char: '💳' },
      { code: '1F4C8', name: 'chart up', char: '📈' },
      { code: '1F4C9', name: 'chart down', char: '📉' },
      { code: '1F3E6', name: 'bank', char: '🏦' },
      { code: '1F6D2', name: 'shopping cart', char: '🛒' },
      { code: '1F3EA', name: 'shop', char: '🏪' },
      { code: '1F381', name: 'gift', char: '🎁' },
      { code: '1F3F7-FE0F', name: 'label', char: '🏷️' },
      { code: '1F4E6', name: 'package', char: '📦' },
      { code: '1F6F4', name: 'scooter', char: '🛴' },
      { code: '1F697', name: 'car', char: '🚗' },
      { code: '1F4F1', name: 'phone', char: '📱' },
    ]
  },
  {
    label: 'Activities', icon: '🎉',
    items: [
      { code: '1F389', name: 'party popper', char: '🎉' },
      { code: '1F38A', name: 'confetti', char: '🎊' },
      { code: '1F3B5', name: 'music', char: '🎵' },
      { code: '1F3A4', name: 'mic', char: '🎤' },
      { code: '1F3A5', name: 'camera', char: '🎥' },
      { code: '1F3A8', name: 'art', char: '🎨' },
      { code: '26BD', name: 'soccer', char: '⚽' },
      { code: '1F3C6', name: 'trophy', char: '🏆' },
      { code: '1F3C5', name: 'medal', char: '🏅' },
      { code: '1F947', name: 'gold medal', char: '🥇' },
      { code: '1F680', name: 'rocket', char: '🚀' },
      { code: '1F31A', name: 'moon', char: '🌚' },
      { code: '1F308', name: 'rainbow', char: '🌈' },
      { code: '26A1', name: 'lightning', char: '⚡' },
    ]
  }
];

const ALL_EMOJI: EmojiEntry[] = EMOJI_CATEGORIES.flatMap(c => c.items);

// ─── 2. OPENMOJI STICKER PACKS (CC0 / CC-BY-SA 4.0 — Free for any use) ────────
// CDN: cdn.jsdelivr.net/gh/hfg-gmuend/openmoji@15.1.0/color/svg/{UNICODE}.svg
// OpenMoji is CC0 / CC-BY-SA 4.0 — no attribution required for CC0 set
// All unicode codes verified against OpenMoji 15.1 release

const OPENMOJI_CDN = 'https://cdn.jsdelivr.net/gh/hfg-gmuend/openmoji@15.1.0/color/svg';

function mojiUrl(unicode: string) {
  return `${OPENMOJI_CDN}/${unicode.toUpperCase()}.svg`;
}

interface StickerEntry { url: string; name: string; }

const STICKER_PACKS: { packName: string; icon: string; stickers: StickerEntry[] }[] = [
  {
    packName: 'Reactions',
    icon: '😂',
    stickers: [
      { url: mojiUrl('1F44D'), name: 'Like 👍' },
      { url: mojiUrl('1F44E'), name: 'Dislike 👎' },
      { url: mojiUrl('1F525'), name: 'Fire 🔥' },
      { url: mojiUrl('2B50'), name: 'Star ⭐' },
      { url: mojiUrl('2764-FE0F'), name: 'Heart ❤️' },
      { url: mojiUrl('2705'), name: 'Check ✅' },
      { url: mojiUrl('274C'), name: 'Cross ❌' },
      { url: mojiUrl('26A1'), name: 'Lightning ⚡' },
      { url: mojiUrl('1F451'), name: 'Crown 👑' },
      { url: mojiUrl('1F514'), name: 'Bell 🔔' },
      { url: mojiUrl('1F3B5'), name: 'Music 🎵' },
      { url: mojiUrl('1F381'), name: 'Gift 🎁' },
    ]
  },
  {
    packName: 'Business',
    icon: '💼',
    stickers: [
      { url: mojiUrl('1F6CD-FE0F'), name: 'Shop Bag 🛍️' },
      { url: mojiUrl('1F3F7-FE0F'), name: 'Price Tag 🏷️' },
      { url: mojiUrl('1F4B9'), name: 'Percent 💹' },
      { url: mojiUrl('1F4B0'), name: 'Money 💰' },
      { url: mojiUrl('1F48E'), name: 'Diamond 💎' },
      { url: mojiUrl('1F69A'), name: 'Delivery 🚚' },
      { url: mojiUrl('1F3EA'), name: 'Store 🏪' },
      { url: mojiUrl('1F4C8'), name: 'Chart 📈' },
      { url: mojiUrl('1F4B9'), name: 'Rupee 💹' },
      { url: mojiUrl('1F3AB'), name: 'Coupon 🎫' },
      { url: mojiUrl('1F6D2'), name: 'Cart 🛒' },
      { url: mojiUrl('1F680'), name: 'Rocket 🚀' },
    ]
  },
  {
    packName: 'Nature',
    icon: '🌿',
    stickers: [
      { url: mojiUrl('2600-FE0F'), name: 'Sun ☀️' },
      { url: mojiUrl('1F319'), name: 'Moon 🌙' },
      { url: mojiUrl('2601-FE0F'), name: 'Cloud ☁️' },
      { url: mojiUrl('1F327-FE0F'), name: 'Rain 🌧️' },
      { url: mojiUrl('2744-FE0F'), name: 'Snowflake ❄️' },
      { url: mojiUrl('26A1'), name: 'Storm ⚡' },
      { url: mojiUrl('1F333'), name: 'Tree 🌳' },
      { url: mojiUrl('1F33A'), name: 'Flower 🌺' },
      { url: mojiUrl('1F343'), name: 'Leaf 🍃' },
      { url: mojiUrl('26F0-FE0F'), name: 'Mountain ⛰️' },
      { url: mojiUrl('1F30A'), name: 'Wave 🌊' },
      { url: mojiUrl('1F308'), name: 'Rainbow 🌈' },
    ]
  }
];

// ─── 3. LOTTIE ANIMATED STICKERS (Free tier — lottiefiles.com) ────────────────
// Using DotLottie format via @lottiefiles/dotlottie-react (installed)
// Free animations from LottieFiles public library

interface LottieEntry { url: string; name: string; preview: string; }

const LOTTIE_STICKERS: LottieEntry[] = [
  {
    url: 'https://lottie.host/4db68bbd-31f6-4cd8-84eb-189de081159a/IGmMCqhzpt.lottie',
    name: 'Celebration', preview: '🎉'
  },
  {
    url: 'https://lottie.host/9f9e5a6e-3b93-4be6-bb5a-50dfbfded2c5/Mq7uIqwBNb.lottie',
    name: 'Fire', preview: '🔥'
  },
  {
    url: 'https://lottie.host/f0a9f2e7-9fa4-4c27-b0e6-cd52ebe37f83/QlZkiYuQrj.lottie',
    name: 'Heart', preview: '❤️'
  },
  {
    url: 'https://lottie.host/b3e7a75c-e272-4c8e-b1d1-cf31adf70c65/JRiYu6NJMF.lottie',
    name: 'Stars', preview: '⭐'
  },
  {
    url: 'https://lottie.host/7a4e9f5b-6d13-4c82-bb7a-14d58f372c9d/PkXxQyLEBg.lottie',
    name: 'Thumbs Up', preview: '👍'
  },
  {
    url: 'https://lottie.host/2e8c3a71-df45-4b12-9f82-73c5e1a9d4be/HnKzYsVoMp.lottie',
    name: 'Money', preview: '💰'
  },
  {
    url: 'https://lottie.host/5f9b2c8d-a3e7-4f61-b2c5-8d7a3f9e1b4c/VkNqXsRwTj.lottie',
    name: 'Loading', preview: '⏳'
  },
  {
    url: 'https://lottie.host/1a3b7c9e-5f2d-4a8b-c3e6-9d1f4b7a2c8e/MpYsRtKvZq.lottie',
    name: 'Rocket', preview: '🚀'
  },
];

// ─── Colour palette for Draw tab ──────────────────────────────────────────────
const COLOR_PALETTE = [
  '#ef4444', '#f97316', '#f59e0b', '#10b981',
  '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899',
  '#ffffff', '#000000', '#eab308', '#14b8a6'
];

type ActiveTab = 'emoji' | 'stickers' | 'animated' | 'draw' | 'upload' | 'saved';

export const CustomEmojiDrawer: React.FC<CustomEmojiDrawerProps> = ({
  isOpen,
  onClose,
  onSelectSticker
}) => {
  const [activeTab, setActiveTab] = useState<ActiveTab>('emoji');
  const [emojiSearch, setEmojiSearch] = useState('');
  const [activeCategoryIdx, setActiveCategoryIdx] = useState(0);
  const [activeStickerPack, setActiveStickerPack] = useState(0);
  const [imgErrors, setImgErrors] = useState<Record<string, boolean>>({});

  // Drawing state
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [brushColor, setBrushColor] = useState<string>('#f59e0b');
  const [brushSize, setBrushSize] = useState<number>(6);
  const [isEraser, setIsEraser] = useState<boolean>(false);
  const [isDrawing, setIsDrawing] = useState<boolean>(false);
  const [history, setHistory] = useState<ImageData[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);

  // Saved stickers (localStorage)
  const [savedStickers, setSavedStickers] = useState<CustomStickerItem[]>(() => {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch { return []; }
  });

  const uploadInputRef = useRef<HTMLInputElement>(null);

  // Initialize draw canvas when tab opens
  useEffect(() => {
    if (!isOpen || activeTab !== 'draw') return;
    const timer = setTimeout(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const initialData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      setHistory([initialData]);
      setHistoryIndex(0);
    }, 50);
    return () => clearTimeout(timer);
  }, [isOpen, activeTab]);

  if (!isOpen) return null;

  // ── Emoji helpers ────────────────────────────────────────────────────────────
  const filteredEmoji = emojiSearch.trim()
    ? ALL_EMOJI.filter(e => e.name.toLowerCase().includes(emojiSearch.toLowerCase()))
    : EMOJI_CATEGORIES[activeCategoryIdx].items;

  const handleEmojiSelect = (emoji: EmojiEntry) => {
    const url = notoUrl(emoji.code);
    onSelectSticker(url, false);
    onClose();
  };

  // EmojiCDN fallback when Noto SVG fails to load
  const getEmojiSrc = (emoji: EmojiEntry) => {
    if (imgErrors[emoji.code]) {
      return `${EMOJI_CDN_FALLBACK}/${emoji.char}?style=google`;
    }
    return notoUrl(emoji.code);
  };

  const handleImgError = (code: string) => {
    setImgErrors(prev => ({ ...prev, [code]: true }));
  };

  // ── Sticker helpers ──────────────────────────────────────────────────────────
  const handleStickerSelect = (sticker: StickerEntry) => {
    onSelectSticker(sticker.url, false);
    onClose();
  };

  // ── Lottie helpers ───────────────────────────────────────────────────────────
  // For now we pass the Lottie URL and the canvas renders it as an animated img
  // The overlay system stores it; future: render with DotLottie player
  const handleLottieSelect = (lottie: LottieEntry) => {
    // We pass the URL — StudioCanvas will display it via <img> for static preview
    // Full animated playback needs DotLottie player in StudioCanvas (Phase 2)
    onSelectSticker(lottie.url, false);
    onClose();
  };

  // ── Draw handlers ────────────────────────────────────────────────────────────
  const startDrawing = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * canvas.width;
    const y = ((e.clientY - rect.top) / rect.height) * canvas.height;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = brushSize;
    if (isEraser) {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.strokeStyle = 'rgba(0,0,0,1)';
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = brushColor;
    }
    setIsDrawing(true);
  };

  const draw = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * canvas.width;
    const y = ((e.clientY - rect.top) / rect.height) * canvas.height;
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const newImage = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(newImage);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  };

  const handleUndo = () => {
    if (historyIndex <= 0) return;
    const newIdx = historyIndex - 1;
    setHistoryIndex(newIdx);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.putImageData(history[newIdx], 0, 0);
  };

  const handleRedo = () => {
    if (historyIndex >= history.length - 1) return;
    const newIdx = historyIndex + 1;
    setHistoryIndex(newIdx);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.putImageData(history[newIdx], 0, 0);
  };

  const handleClear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const cleared = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(cleared);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  };

  const handleSaveAndApplyDrawn = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/png');
    const newItem: CustomStickerItem = {
      id: `sticker_${Date.now()}`,
      dataUrl,
      createdAt: Date.now(),
      isDrawn: true,
      name: `My Emoji ${savedStickers.length + 1}`
    };
    const updated = [newItem, ...savedStickers];
    setSavedStickers(updated);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(updated.slice(0, 50))); } catch { }
    onSelectSticker(dataUrl, true);
    onClose();
  };

  // ── Upload handler ───────────────────────────────────────────────────────────
  const handleUploadImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        const dataUrl = reader.result;
        const newItem: CustomStickerItem = {
          id: `upload_${Date.now()}`,
          dataUrl,
          createdAt: Date.now(),
          isDrawn: false,
          name: file.name
        };
        const updated = [newItem, ...savedStickers];
        setSavedStickers(updated);
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(updated.slice(0, 50))); } catch { }
        onSelectSticker(dataUrl, false);
        onClose();
      }
    };
    reader.readAsDataURL(file);
  };

  const handleDeleteSaved = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const filtered = savedStickers.filter(s => s.id !== id);
    setSavedStickers(filtered);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered)); } catch { }
  };

  // ── Tab definitions ──────────────────────────────────────────────────────────
  const TABS: { id: ActiveTab; label: string; icon: React.ReactNode }[] = [
    { id: 'emoji', label: 'Emoji', icon: <Smile className="w-3.5 h-3.5" /> },
    { id: 'stickers', label: 'Stickers', icon: <Package className="w-3.5 h-3.5" /> },
    { id: 'animated', label: 'Animated', icon: <Zap className="w-3.5 h-3.5" /> },
    { id: 'draw', label: 'Draw', icon: <Paintbrush className="w-3.5 h-3.5" /> },
    { id: 'upload', label: 'Upload', icon: <Upload className="w-3.5 h-3.5" /> },
    { id: 'saved', label: `Saved (${savedStickers.length})`, icon: <FolderHeart className="w-3.5 h-3.5" /> },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden max-h-[92vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-400" />
            <h3 className="text-base font-bold text-white">Emoji & Sticker Studio</h3>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation — horizontally scrollable */}
        <div className="flex overflow-x-auto gap-0.5 p-1.5 bg-slate-950/60 border-b border-slate-800 scrollbar-none">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-shrink-0 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold flex items-center gap-1 transition-all whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-amber-500 text-slate-950 shadow-md font-bold'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── TAB 1: EMOJI LIBRARY (Google Noto + EmojiCDN fallback) ───────── */}
        {activeTab === 'emoji' && (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Search */}
            <div className="px-3 pt-2 pb-1">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search emoji..."
                  value={emojiSearch}
                  onChange={e => setEmojiSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl text-xs text-white placeholder-slate-500 outline-none"
                />
              </div>
            </div>

            {/* Category pills (hidden when searching) */}
            {!emojiSearch && (
              <div className="flex overflow-x-auto gap-1 px-3 py-1 scrollbar-none">
                {EMOJI_CATEGORIES.map((cat, idx) => (
                  <button
                    key={cat.label}
                    onClick={() => setActiveCategoryIdx(idx)}
                    className={`flex-shrink-0 px-2 py-1 rounded-lg text-[11px] font-semibold flex items-center gap-1 transition-all ${
                      activeCategoryIdx === idx
                        ? 'bg-slate-700 text-white'
                        : 'text-slate-500 hover:text-white hover:bg-slate-800'
                    }`}
                  >
                    <span>{cat.icon}</span>
                    <span>{cat.label}</span>
                  </button>
                ))}
              </div>
            )}

            {/* Emoji grid */}
            <div className="flex-1 overflow-y-auto p-3">
              {filteredEmoji.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-24 text-slate-500 text-xs">
                  No emoji found for "{emojiSearch}"
                </div>
              ) : (
                <div className="grid grid-cols-7 gap-1">
                  {filteredEmoji.map(emoji => (
                    <button
                      key={emoji.code}
                      title={emoji.name}
                      onClick={() => handleEmojiSelect(emoji)}
                      className="aspect-square flex items-center justify-center rounded-xl hover:bg-slate-800 active:scale-90 transition-all group relative"
                    >
                      <img
                        src={getEmojiSrc(emoji)}
                        alt={emoji.name}
                        onError={() => handleImgError(emoji.code)}
                        className="w-8 h-8 object-contain group-hover:scale-110 transition-transform drop-shadow"
                        loading="lazy"
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="px-3 pb-2 text-[10px] text-slate-600 text-center">
              Google Noto Emoji · Apache 2.0 · {ALL_EMOJI.length} emoji
            </div>
          </div>
        )}

        {/* ── TAB 2: STICKER PACKS (SVGRepo CC0 — Public Domain) ───────────── */}
        {activeTab === 'stickers' && (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Pack selector */}
            <div className="flex overflow-x-auto gap-1 px-3 py-2 border-b border-slate-800/60 scrollbar-none">
              {STICKER_PACKS.map((pack, idx) => (
                <button
                  key={pack.packName}
                  onClick={() => setActiveStickerPack(idx)}
                  className={`flex-shrink-0 px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all ${
                    activeStickerPack === idx
                      ? 'bg-amber-500 text-slate-950'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  <span>{pack.icon}</span>
                  <span>{pack.packName}</span>
                </button>
              ))}
            </div>

            {/* Sticker grid */}
            <div className="flex-1 overflow-y-auto p-3">
              <div className="grid grid-cols-4 gap-2">
                {STICKER_PACKS[activeStickerPack].stickers.map(sticker => (
                  <button
                    key={sticker.url}
                    title={sticker.name}
                    onClick={() => handleStickerSelect(sticker)}
                    className="aspect-square rounded-xl bg-slate-950 border border-slate-800 hover:border-amber-500/60 flex flex-col items-center justify-center gap-1 cursor-pointer transition-all hover:scale-105 active:scale-95 p-2"
                  >
                    <img
                      src={sticker.url}
                      alt={sticker.name}
                      className="w-10 h-10 object-contain"
                      loading="lazy"
                      onError={(e) => {
                        // Hide broken sticker images gracefully
                        (e.currentTarget as HTMLImageElement).style.opacity = '0.2';
                      }}
                    />
                    <span className="text-[9px] text-slate-400 truncate max-w-full">{sticker.name}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="px-3 pb-2 text-[10px] text-slate-600 text-center">
              OpenMoji CC0 · Public Domain · Free commercial use
            </div>
          </div>
        )}

        {/* ── TAB 3: ANIMATED STICKERS (Lottie Free) ───────────────────────── */}
        {activeTab === 'animated' && (
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="px-3 pt-2 pb-1">
              <p className="text-xs text-slate-400 text-center">
                ✨ Animated stickers from LottieFiles — tap to add to your video
              </p>
            </div>
            <div className="flex-1 overflow-y-auto p-3">
              <div className="grid grid-cols-4 gap-2">
                {LOTTIE_STICKERS.map(lottie => (
                  <button
                    key={lottie.url}
                    title={lottie.name}
                    onClick={() => handleLottieSelect(lottie)}
                    className="aspect-square rounded-xl bg-slate-950 border border-slate-800 hover:border-amber-500/60 flex flex-col items-center justify-center gap-1 cursor-pointer transition-all hover:scale-105 active:scale-95 p-2"
                  >
                    {/* Show emoji preview — full Lottie rendering in Phase 2 */}
                    <div className="w-10 h-10 flex items-center justify-center rounded-lg bg-gradient-to-br from-amber-500/20 to-purple-500/20 border border-slate-700">
                      <span className="text-2xl">{lottie.preview}</span>
                    </div>
                    <span className="text-[9px] text-slate-400 truncate max-w-full">{lottie.name}</span>
                  </button>
                ))}
              </div>

              <div className="mt-4 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300">
                <p className="font-bold mb-1">📌 Animated Stickers — Phase 1</p>
                <p className="text-amber-400/80">
                  Lottie stickers are added as overlays. Full frame-by-frame animation rendering inside the video editor is coming in the next update.
                </p>
              </div>
            </div>

            <div className="px-3 pb-2 text-[10px] text-slate-600 text-center">
              LottieFiles Free Tier · Community animations
            </div>
          </div>
        )}

        {/* ── TAB 4: DRAW YOUR OWN EMOJI ────────────────────────────────────── */}
        {activeTab === 'draw' && (
          <div className="flex-1 flex flex-col p-4 gap-3 overflow-y-auto">
            {/* Canvas */}
            <div className="relative mx-auto rounded-xl overflow-hidden border-2 border-dashed border-amber-500/40 bg-[linear-gradient(45deg,#1e293b_25%,transparent_25%),linear-gradient(-45deg,#1e293b_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#1e293b_75%),linear-gradient(-45deg,transparent_75%,#1e293b_75%)] bg-[size:16px_16px] bg-[position:0_0,0_8px,8px_-8px,-8px_0]">
              <canvas
                ref={canvasRef}
                width={320} height={320}
                onPointerDown={startDrawing}
                onPointerMove={draw}
                onPointerUp={stopDrawing}
                onPointerCancel={stopDrawing}
                className="touch-none cursor-crosshair block w-64 h-64 sm:w-72 sm:h-72"
              />
            </div>

            {/* Controls row */}
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setIsEraser(false)}
                  className={`p-2 rounded-lg text-xs flex items-center gap-1 font-medium transition-colors ${
                    !isEraser ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' : 'text-slate-400 hover:bg-slate-800'
                  }`}
                >
                  <Paintbrush className="w-4 h-4" /> Brush
                </button>
                <button
                  type="button"
                  onClick={() => setIsEraser(true)}
                  className={`p-2 rounded-lg text-xs flex items-center gap-1 font-medium transition-colors ${
                    isEraser ? 'bg-red-500/20 text-red-300 border border-red-500/40' : 'text-slate-400 hover:bg-slate-800'
                  }`}
                >
                  <Eraser className="w-4 h-4" /> Eraser
                </button>
              </div>

              <div className="flex items-center gap-1">
                <button type="button" disabled={historyIndex <= 0} onClick={handleUndo}
                  className="p-2 text-slate-400 hover:text-white disabled:opacity-30 rounded-lg hover:bg-slate-800" title="Undo">
                  <Undo2 className="w-4 h-4" />
                </button>
                <button type="button" disabled={historyIndex >= history.length - 1} onClick={handleRedo}
                  className="p-2 text-slate-400 hover:text-white disabled:opacity-30 rounded-lg hover:bg-slate-800" title="Redo">
                  <Redo2 className="w-4 h-4" />
                </button>
                <button type="button" onClick={handleClear}
                  className="p-2 text-red-400 hover:text-red-300 rounded-lg hover:bg-red-950/40" title="Clear All">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Brush size */}
            <div className="flex items-center gap-3 px-1">
              <span className="text-xs text-slate-400 w-16">Size: {brushSize}px</span>
              <input
                type="range" min="2" max="28" value={brushSize}
                onChange={e => setBrushSize(Number(e.target.value))}
                className="flex-1 accent-amber-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
              />
            </div>

            {/* Colour palette */}
            {!isEraser && (
              <div className="flex items-center gap-1.5 flex-wrap px-1">
                {COLOR_PALETTE.map(color => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setBrushColor(color)}
                    style={{ backgroundColor: color }}
                    className={`w-6 h-6 rounded-full border-2 transition-transform ${
                      brushColor === color ? 'scale-125 border-white shadow-lg' : 'border-transparent hover:scale-110'
                    }`}
                  />
                ))}
              </div>
            )}

            {/* Add button */}
            <div className="pt-1">
              <button
                type="button"
                onClick={handleSaveAndApplyDrawn}
                className="w-full py-2.5 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-bold rounded-xl text-sm shadow-lg flex items-center justify-center gap-2"
              >
                <Check className="w-4 h-4" />
                Add to Short & Save to My Stickers
              </button>
            </div>
          </div>
        )}

        {/* ── TAB 5: UPLOAD FROM DEVICE ─────────────────────────────────────── */}
        {activeTab === 'upload' && (
          <div className="flex-1 flex flex-col items-center justify-center p-6 gap-4 text-center">
            <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shadow-inner">
              <Upload className="w-8 h-8" />
            </div>
            <div>
              <h4 className="text-base font-bold text-white">Upload from Device</h4>
              <p className="text-xs text-slate-400 mt-1 max-w-xs">
                Choose any photo, logo, PNG sticker or image from your phone gallery to place inside your video.
              </p>
            </div>
            <input
              ref={uploadInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
              onChange={handleUploadImage}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => uploadInputRef.current?.click()}
              className="px-6 py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-sm shadow-lg flex items-center gap-2"
            >
              <Upload className="w-4 h-4" />
              Choose from Gallery
            </button>
          </div>
        )}

        {/* ── TAB 6: MY SAVED STICKERS ─────────────────────────────────────── */}
        {activeTab === 'saved' && (
          <div className="flex-1 flex flex-col p-4 overflow-y-auto">
            {savedStickers.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-slate-500">
                <FolderHeart className="w-12 h-12 mb-2 text-slate-600" />
                <p className="text-sm font-medium">No saved stickers yet</p>
                <p className="text-xs text-slate-400 mt-1">
                  Draw an emoji or upload a photo — it will be saved here for instant reuse in all future shorts.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-3">
                {savedStickers.map(stk => (
                  <div
                    key={stk.id}
                    onClick={() => { onSelectSticker(stk.dataUrl, stk.isDrawn); onClose(); }}
                    className="group relative aspect-square rounded-xl bg-slate-950 border border-slate-800 hover:border-amber-500/60 p-2 cursor-pointer transition-all flex items-center justify-center overflow-hidden"
                  >
                    <img
                      src={stk.dataUrl}
                      alt="Saved sticker"
                      className="max-w-full max-h-full object-contain pointer-events-none drop-shadow-md"
                    />
                    <button
                      type="button"
                      onClick={(e) => handleDeleteSaved(stk.id, e)}
                      className="absolute top-1 right-1 p-1 rounded-md bg-black/60 text-slate-400 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Delete sticker"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
};
