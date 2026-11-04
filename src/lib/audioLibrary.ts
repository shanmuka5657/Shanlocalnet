import { AudioTrackMetadata } from '../types/index.ts';

export const CURATED_AUDIO_TRACKS: AudioTrackMetadata[] = [
  {
    id: 'audio_rayalaseema_dappu',
    title: 'Rayalaseema Dappu Energy (Folk Beats)',
    artist: 'Kurnool Folk Ensemble',
    category: 'regional',
    durationSeconds: 30,
    coverUrl: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=200&q=80',
    audioUrl: 'https://cdn.freesound.org/previews/415/415510_5121236-lq.mp3',
    useCount: 3840
  },
  {
    id: 'audio_hyderabad_lofi',
    title: 'Hitec City Midnight Lo-Fi',
    artist: 'Deccan Beats Project',
    category: 'trending',
    durationSeconds: 45,
    coverUrl: 'https://images.unsplash.com/photo-1518609878373-06d740f60d8b?auto=format&fit=crop&w=200&q=80',
    audioUrl: 'https://cdn.freesound.org/previews/369/369515_6687700-lq.mp3',
    useCount: 5120
  },
  {
    id: 'audio_kurnool_sunset',
    title: 'Kurnool Fort Sunset Acoustic',
    artist: 'Arjun & Rayalaseema Strings',
    category: 'acoustic',
    durationSeconds: 35,
    coverUrl: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?auto=format&fit=crop&w=200&q=80',
    audioUrl: 'https://cdn.freesound.org/previews/573/573381_12534882-lq.mp3',
    useCount: 2290
  },
  {
    id: 'audio_telugu_mass_anthem',
    title: 'Tollywood Festive Dhol Anthem',
    artist: 'South Rhythm Kings',
    category: 'trending',
    durationSeconds: 30,
    coverUrl: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=200&q=80',
    audioUrl: 'https://cdn.freesound.org/previews/612/612610_11861866-lq.mp3',
    useCount: 8940
  },
  {
    id: 'audio_tirupati_morning',
    title: 'Sacred Hill Morning Flute',
    artist: 'Rayalaseema Meditations',
    category: 'ambient',
    durationSeconds: 60,
    coverUrl: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=200&q=80',
    audioUrl: 'https://cdn.freesound.org/previews/516/516801_11236109-lq.mp3',
    useCount: 1750
  },
  {
    id: 'audio_street_dance_groove',
    title: 'Viral Street Dance Phonk',
    artist: 'GlobalNet Club Mix',
    category: 'trending',
    durationSeconds: 28,
    coverUrl: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=200&q=80',
    audioUrl: 'https://cdn.freesound.org/previews/450/450616_9497060-lq.mp3',
    useCount: 6420
  }
];

export const getAudioTrackById = (id: string): AudioTrackMetadata | undefined => {
  return CURATED_AUDIO_TRACKS.find(t => t.id === id);
};
