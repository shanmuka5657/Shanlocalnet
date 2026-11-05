import React, { useState, useRef, useEffect, useCallback } from 'react';
import { VideoProject, VideoOverlay } from './types.ts';
import { CameraRecorder } from './CameraRecorder.tsx';
import { CustomEmojiDrawer } from './CustomEmojiDrawer.tsx';
import { ImageOverlayPicker } from './ImageOverlayPicker.tsx';
import { TextOverlayEditor } from './TextOverlayEditor.tsx';
import { PriceTagEditor } from './PriceTagEditor.tsx';
import { MerchantPresetsModal } from './MerchantPresetsModal.tsx';
import { FilterAudioControls } from './FilterAudioControls.tsx';
import { PosterGeneratorModal } from './PosterGeneratorModal.tsx';
import { StudioCanvas } from './StudioCanvas.tsx';
import { StudioTimeline } from './StudioTimeline.tsx';
import { VideoExportEngine, ExportProgress } from './VideoExportEngine.ts';
import { AudioTrackPickerModal } from '../AudioTrackPickerModal.tsx';
import { useLocation } from '../../context/LocationContext.tsx';
import { useAuth } from '../../context/AuthContext.tsx';
import { Post, AudioTrackMetadata } from '../../types/index.ts';
import { saveStoredUserPost } from '../../lib/engagementStorage.ts';
import {
  X,
  Camera,
  Upload,
  Type,
  Smile,
  Image as ImageIcon,
  Tag,
  Store,
  Sliders,
  Music2,
  Check,
  Undo2,
  Redo2,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  Layers,
  MapPin,
  Globe,
  Film,
  RotateCcw,
  AlertCircle
} from 'lucide-react';

interface ShortCreationStudioProps {
  isOpen: boolean;
  onClose: () => void;
  onPostPublished: (post: Post) => void;
}

const DRAFT_STORAGE_KEY = 'localnet_short_draft';

export const ShortCreationStudio: React.FC<ShortCreationStudioProps> = ({
  isOpen,
  onClose,
  onPostPublished
}) => {
  const { viewerLocation } = useLocation();
  const { user } = useAuth();

  // Studio Workflow Step: 1 = Entry / Picker, 2 = Studio Editor, 3 = Publish Details
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);

  // Core Project State
  const [project, setProject] = useState<VideoProject | null>(null);
  const [hasSavedDraft, setHasSavedDraft] = useState<boolean>(() => {
    try {
      return !!localStorage.getItem(DRAFT_STORAGE_KEY);
    } catch {
      return false;
    }
  });

  // Playback & Scrubbing
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const videoElementRef = useRef<HTMLVideoElement | null>(null);

  // Overlay Management
  const [selectedOverlayId, setSelectedOverlayId] = useState<string | null>(null);
  const [undoStack, setUndoStack] = useState<VideoOverlay[][]>([]);
  const [redoStack, setRedoStack] = useState<VideoOverlay[][]>([]);

  // Sub-modal states
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isEmojiDrawerOpen, setIsEmojiDrawerOpen] = useState(false);
  const [isImagePickerOpen, setIsImagePickerOpen] = useState(false);
  const [isTextEditorOpen, setIsTextEditorOpen] = useState(false);
  const [isPriceEditorOpen, setIsPriceEditorOpen] = useState(false);
  const [isMerchantPresetsOpen, setIsMerchantPresetsOpen] = useState(false);
  const [isFilterAudioOpen, setIsFilterAudioOpen] = useState(false);
  const [isPosterModalOpen, setIsPosterModalOpen] = useState(false);
  const [isAudioTrackModalOpen, setIsAudioTrackModalOpen] = useState(false);

  // Publishing State
  const [caption, setCaption] = useState('');
  const [tagsInput, setTagsInput] = useState('shorts, localnet, viral');
  const [scope, setScope] = useState<'worldwide' | '40km' | '10km'>('worldwide');
  const [exportProgress, setExportProgress] = useState<ExportProgress | null>(null);
  const [publishError, setPublishError] = useState<string | null>(null);

  const galleryInputRef = useRef<HTMLInputElement>(null);

  // Auto-save draft
  useEffect(() => {
    if (project && currentStep === 2) {
      try {
        const serializable = {
          ...project,
          sourceFile: undefined // Do not serialize File object
        };
        localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(serializable));
        setHasSavedDraft(true);
      } catch {}
    }
  }, [project, currentStep]);

  if (!isOpen) return null;

  // Initialize a new project from a selected video file or URL
  const initProject = (file: File | null, url: string, duration: number, sourceType: 'camera' | 'gallery') => {
    const newProj: VideoProject = {
      id: `proj_${Date.now()}`,
      sourceType,
      sourceUrl: url,
      sourceFile: file || undefined,
      sourceFilename: file?.name || 'short_video.mp4',
      duration,
      width: 1080,
      height: 1920,
      aspectRatio: '9:16',
      overlays: [],
      trimStart: 0,
      trimEnd: duration,
      activeFilter: 'normal',
      brightness: 1.0,
      contrast: 1.0,
      saturation: 1.0,
      playbackSpeed: 1.0,
      originalAudioVolume: 1.0,
      isOriginalAudioMuted: false,
      posterTimestamp: 0.5,
      updatedAt: Date.now()
    };

    setProject(newProj);
    setCurrentStep(2);
    setCurrentTime(0);
    setIsPlaying(false);
  };

  // Resume saved draft
  const handleResumeDraft = () => {
    try {
      const saved = localStorage.getItem(DRAFT_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        setProject(parsed);
        setCurrentStep(2);
      }
    } catch {
      setHasSavedDraft(false);
    }
  };

  // Gallery Picker Handler
  const handleGallerySelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const objectUrl = URL.createObjectURL(file);
    const tempVideo = document.createElement('video');
    tempVideo.src = objectUrl;
    tempVideo.onloadedmetadata = () => {
      const dur = tempVideo.duration || 15;
      initProject(file, objectUrl, dur, 'gallery');
    };
  };

  // Camera Recording Confirmed
  const handleCameraRecorded = (videoFile: File, previewUrl: string, duration: number) => {
    initProject(videoFile, previewUrl, duration, 'camera');
  };

  // Overlay Undo / Redo helpers
  const pushOverlayHistory = (newOverlays: VideoOverlay[]) => {
    if (!project) return;
    setUndoStack(prev => [...prev, project.overlays]);
    setRedoStack([]);
    setProject({ ...project, overlays: newOverlays });
  };

  const handleUndo = () => {
    if (undoStack.length === 0 || !project) return;
    const previous = undoStack[undoStack.length - 1];
    setUndoStack(prev => prev.slice(0, -1));
    setRedoStack(prev => [...prev, project.overlays]);
    setProject({ ...project, overlays: previous });
  };

  const handleRedo = () => {
    if (redoStack.length === 0 || !project) return;
    const next = redoStack[redoStack.length - 1];
    setRedoStack(prev => prev.slice(0, -1));
    setUndoStack(prev => [...prev, project.overlays]);
    setProject({ ...project, overlays: next });
  };

  // Add Overlay to Timeline
  const handleAddOverlay = (overlayData: Omit<VideoOverlay, 'id'>) => {
    if (!project) return;
    const newOverlay: VideoOverlay = {
      ...overlayData,
      id: `ovl_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`
    };
    pushOverlayHistory([...project.overlays, newOverlay]);
    setSelectedOverlayId(newOverlay.id);
  };

  // Update existing Overlay
  const handleUpdateOverlay = (id: string, updates: Partial<VideoOverlay>) => {
    if (!project) return;
    const updated = project.overlays.map(o => (o.id === id ? { ...o, ...updates } : o));
    setProject({ ...project, overlays: updated });
  };

  // Delete Overlay (Leaves original video completely intact!)
  const handleDeleteOverlay = (id: string) => {
    if (!project) return;
    const filtered = project.overlays.filter(o => o.id !== id);
    pushOverlayHistory(filtered);
    if (selectedOverlayId === id) {
      setSelectedOverlayId(null);
    }
  };

  // Duplicate Overlay
  const handleDuplicateOverlay = (id: string) => {
    if (!project) return;
    const target = project.overlays.find(o => o.id === id);
    if (!target) return;

    const copy: VideoOverlay = {
      ...target,
      id: `ovl_${Date.now()}`,
      position: { x: target.position.x + 5, y: target.position.y + 5 }
    };
    pushOverlayHistory([...project.overlays, copy]);
    setSelectedOverlayId(copy.id);
  };

  // Play / Pause Toggle
  const togglePlay = () => {
    const vid = videoElementRef.current;
    if (!vid) return;
    if (vid.paused) {
      vid.play().then(() => setIsPlaying(true)).catch(() => {});
    } else {
      vid.pause();
      setIsPlaying(false);
    }
  };

  // Fast On-Device Render & Direct S3 Upload
  const handlePublish = async () => {
    if (!project) return;
    setPublishError(null);

    try {
      // 1. Client-Side Video & Poster Render (100% Free on Device)
      const { file: finalVideoFile, posterDataUrl } = await VideoExportEngine.exportCompositeVideo(
        project,
        progress => setExportProgress(progress)
      );

      setExportProgress({ stage: 'compressing', progressPercent: 70 });

      // 2. Direct S3 Upload via Presigned URL
      let s3PublicUrl = project.sourceUrl;
      let mediaAssetId = `asset_${Date.now()}`;
      const rawMime = finalVideoFile.type || 'video/mp4';
      const cleanMime = rawMime.split(';')[0].trim().toLowerCase() || 'video/mp4';

      try {
        const presignRes = await fetch('/api/media/presign-upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            filename: finalVideoFile.name || `short_${Date.now()}.mp4`,
            mimeType: cleanMime,
            sizeBytes: finalVideoFile.size || 1024 * 1024,
            category: 'videos_original'
          })
        });

        if (presignRes.ok) {
          const { uploadUrl, publicUrl, mediaAssetId: assetId } = await presignRes.json();
          if (uploadUrl) {
            setExportProgress({ stage: 'compressing', progressPercent: 85 });
            await fetch(uploadUrl, {
              method: 'PUT',
              headers: { 'Content-Type': cleanMime },
              body: finalVideoFile
            });
            s3PublicUrl = publicUrl;
            mediaAssetId = assetId;
          }
        }
      } catch (err) {
        console.warn('Presigned S3 upload skipped, publishing with device stream URL:', err);
      }

      setExportProgress({ stage: 'compressing', progressPercent: 95 });

      // 3. Create Feed Post Object (Full Schema Compatible)
      const poster = posterDataUrl || project.posterDataUrl || undefined;
      const title = caption ? caption.slice(0, 40) : 'Local Short';
      const description = caption || 'My new short on LocalNet #shorts';

      const newPost: Post = {
        id: `reel_${Date.now()}`,
        creatorId: user?.id || 'current_user_1',
        creatorName: user?.name || 'Local Creator',
        creatorHandle: user?.handle || '@creator',
        creatorAvatar: user?.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=256',
        creatorVerified: true,
        contentType: 'reel',
        type: 'reel' as any,
        userId: user?.id || 'current_user_1',
        author: {
          id: user?.id || 'current_user_1',
          name: user?.name || 'Local Creator',
          handle: user?.handle || '@creator',
          avatar: user?.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=256',
          city: viewerLocation.cityName || 'Kurnool',
          state: viewerLocation.stateName || 'Andhra Pradesh',
          country: 'India',
          verified: true
        } as any,
        classification: 'organic',
        title,
        description,
        caption: description as any,
        mediaAssetId,
        mediaUrl: s3PublicUrl,
        mediaThumbnail: poster,
        thumbnailUrl: poster as any,
        mediaGradient: 'from-amber-600 via-rose-600 to-indigo-900',
        aspectRatio: '9:16',
        videoDurationSeconds: project.duration || 15,
        publishingLocation: {
          latitude: viewerLocation.coords.latitude,
          longitude: viewerLocation.coords.longitude,
          cityName: viewerLocation.cityName,
          state: viewerLocation.stateName || 'Andhra Pradesh',
          country: 'India',
          isVerified: viewerLocation.isVerified,
          publishedAt: new Date().toISOString()
        },
        audienceDistribution: {
          engine: 'ORGANIC_ENTERTAINMENT',
          scope,
          maxRadiusKm: scope === 'worldwide' ? null : scope === '40km' ? 40 : 10
        },
        tags: tagsInput.split(',').map(t => t.trim()).filter(Boolean),
        stats: {
          likes: 1,
          comments: 0,
          shares: 0,
          saves: 0,
          views: 1
        },
        likesCount: 1 as any,
        commentsCount: 0 as any,
        sharesCount: 0 as any,
        savesCount: 0 as any,
        hasLiked: false,
        hasSaved: false,
        moderation: { status: 'approved' },
        createdAt: new Date().toISOString()
      };

      // 4. Persist to Backend API for Laptop & Cross-Device Sync
      try {
        const createRes = await fetch('/api/posts/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: newPost.title,
            description: newPost.description,
            mediaAssetId: newPost.mediaAssetId,
            mediaUrl: newPost.mediaUrl,
            mediaThumbnail: newPost.mediaThumbnail,
            contentType: 'reel',
            classification: 'organic',
            scope: newPost.audienceDistribution.scope,
            radiusKm: newPost.audienceDistribution.maxRadiusKm,
            aspectRatio: '9:16',
            videoDurationSeconds: newPost.videoDurationSeconds,
            publishingLocation: newPost.publishingLocation,
            tags: newPost.tags
          })
        });
        if (createRes.ok) {
          const createData = await createRes.json();
          if (createData.post?.id) {
            newPost.id = createData.post.id;
          }
        }
      } catch (err) {
        console.warn('Backend post creation sync skipped, saved locally:', err);
      }

      // 5. Save to Local Feed Storage & Notify Parent
      saveStoredUserPost(newPost);
      onPostPublished(newPost);

      // Clean draft
      try {
        localStorage.removeItem(DRAFT_STORAGE_KEY);
      } catch {}

      setExportProgress({ stage: 'completed', progressPercent: 100 });
      setTimeout(() => {
        onClose();
      }, 500);
    } catch (err: any) {
      console.error('Publishing error:', err);
      setPublishError(err.message || 'Failed to export and publish video');
      setExportProgress(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950 flex flex-col justify-between overflow-hidden animate-in fade-in select-none">
      {/* ========================================================================= */}
      {/* STEP 1: ENTRY SCREEN (Record Video vs Upload from Gallery)                */}
      {/* ========================================================================= */}
      {currentStep === 1 && (
        <div className="flex-1 flex flex-col justify-between p-4 sm:p-6 max-w-lg mx-auto w-full">
          {/* Header */}
          <div className="flex items-center justify-between pt-2">
            <div className="flex items-center gap-2">
              <Sparkles className="w-6 h-6 text-amber-400" />
              <h2 className="text-xl font-black text-white">Short Creation Studio</h2>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-full bg-slate-900 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Action Cards */}
          <div className="flex flex-col gap-4 my-auto">
            <p className="text-sm text-slate-400 text-center mb-2">
              Create viral 9:16 vertical shorts with emojis, pictures, price tags & music for free.
            </p>

            {/* 1. Record Video with In-App Camera */}
            <div
              onClick={() => setIsCameraOpen(true)}
              className="group p-6 rounded-2xl bg-gradient-to-r from-red-600/20 via-amber-600/10 to-slate-900 border border-red-500/30 hover:border-amber-400 cursor-pointer transition-all shadow-xl flex items-center gap-4"
            >
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-red-500 to-amber-500 flex items-center justify-center text-white shadow-lg group-hover:scale-105 transition-transform">
                <Camera className="w-8 h-8" />
              </div>
              <div className="flex-1">
                <h3 className="text-base font-bold text-white group-hover:text-amber-300 transition-colors">
                  Record Video
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  15s, 30s or 60s clips with hands-free timer & front/back camera
                </p>
              </div>
            </div>

            {/* 2. Upload from Phone Gallery */}
            <div
              onClick={() => galleryInputRef.current?.click()}
              className="group p-6 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-amber-400 cursor-pointer transition-all shadow-xl flex items-center gap-4"
            >
              <div className="w-16 h-16 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shadow-lg group-hover:scale-105 transition-transform">
                <Upload className="w-8 h-8" />
              </div>
              <div className="flex-1">
                <h3 className="text-base font-bold text-white group-hover:text-amber-300 transition-colors">
                  Upload from Gallery
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Choose any existing video from your phone or device
                </p>
              </div>
              <input
                ref={galleryInputRef}
                type="file"
                accept="video/*"
                onChange={handleGallerySelect}
                className="hidden"
              />
            </div>

            {/* Resume Saved Draft (If Available) */}
            {hasSavedDraft && (
              <button
                type="button"
                onClick={handleResumeDraft}
                className="w-full py-3 bg-slate-900 hover:bg-slate-800 border border-amber-500/40 rounded-xl text-xs font-bold text-amber-300 flex items-center justify-center gap-2 transition-colors"
              >
                <RotateCcw className="w-4 h-4" />
                Resume Previously Saved Draft
              </button>
            )}
          </div>

          <div className="text-center text-[11px] text-slate-500">
            Powered by LocalNet Client Hardware Engine (100% Free Processing)
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* STEP 2: PROFESSIONAL 9:16 STUDIO EDITOR                                  */}
      {/* ========================================================================= */}
      {currentStep === 2 && project && (
        <div className="flex-1 flex flex-col justify-between overflow-hidden">
          {/* Top Studio Toolbar */}
          <div className="flex items-center justify-between px-3 py-2 bg-slate-950/90 border-b border-slate-800 z-30">
            <button
              onClick={() => setCurrentStep(1)}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-900 flex items-center gap-1 text-xs"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>

            {/* Quick Action Tools */}
            <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-1">
              {/* Text */}
              <button
                onClick={() => setIsTextEditorOpen(true)}
                className="px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center gap-1 border border-slate-800"
                title="Add Text"
              >
                <Type className="w-3.5 h-3.5 text-cyan-400" />
                <span>Text</span>
              </button>

              {/* Custom Emoji / Stickers */}
              <button
                onClick={() => setIsEmojiDrawerOpen(true)}
                className="px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center gap-1 border border-slate-800"
                title="Draw or Upload Emoji"
              >
                <Smile className="w-3.5 h-3.5 text-amber-400" />
                <span>Emoji</span>
              </button>

              {/* Picture Overlay */}
              <button
                onClick={() => setIsImagePickerOpen(true)}
                className="px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center gap-1 border border-slate-800"
                title="Insert Picture Inside Video"
              >
                <ImageIcon className="w-3.5 h-3.5 text-emerald-400" />
                <span>Picture</span>
              </button>

              {/* Price Tag */}
              <button
                onClick={() => setIsPriceEditorOpen(true)}
                className="px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center gap-1 border border-slate-800"
                title="Product Price Tag"
              >
                <Tag className="w-3.5 h-3.5 text-yellow-400" />
                <span>Price</span>
              </button>

              {/* Merchant Presets */}
              <button
                onClick={() => setIsMerchantPresetsOpen(true)}
                className="px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center gap-1 border border-slate-800"
                title="Merchant Selling Badges"
              >
                <Store className="w-3.5 h-3.5 text-rose-400" />
                <span>Merchant</span>
              </button>

              {/* Cover Frame */}
              <button
                onClick={() => setIsPosterModalOpen(true)}
                className="px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center gap-1 border border-slate-800"
                title="Select Cover Thumbnail"
              >
                <Camera className="w-3.5 h-3.5 text-purple-400" />
                <span>Cover</span>
              </button>

              {/* Filters & Speed */}
              <button
                onClick={() => setIsFilterAudioOpen(true)}
                className="px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center gap-1 border border-slate-800"
                title="Video Filters & Speed"
              >
                <Sliders className="w-3.5 h-3.5 text-amber-400" />
                <span>FX</span>
              </button>
            </div>

            {/* Next / Publish Step Button */}
            <button
              onClick={() => setCurrentStep(3)}
              className="px-3.5 py-1.5 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 text-slate-950 font-black rounded-xl text-xs flex items-center gap-1 shadow-lg"
            >
              <span>Next</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Center 9:16 Live Canvas */}
          <div className="flex-1 flex items-center justify-center p-2 overflow-hidden bg-slate-950">
            <StudioCanvas
              videoUrl={project.sourceUrl}
              currentTime={currentTime}
              duration={project.duration}
              isPlaying={isPlaying}
              onTimeUpdate={setCurrentTime}
              onTogglePlay={togglePlay}
              overlays={project.overlays}
              selectedOverlayId={selectedOverlayId}
              onSelectOverlay={setSelectedOverlayId}
              onUpdateOverlay={handleUpdateOverlay}
              onDeleteOverlay={handleDeleteOverlay}
              activeFilterId={project.activeFilter}
              brightness={project.brightness}
              contrast={project.contrast}
              saturation={project.saturation}
              playbackSpeed={project.playbackSpeed}
              originalAudioVolume={project.originalAudioVolume}
              isOriginalAudioMuted={project.isOriginalAudioMuted}
              videoRef={videoElementRef}
            />
          </div>

          {/* Bottom Timeline with Independent Layer Tracks */}
          <StudioTimeline
            duration={project.duration}
            currentTime={currentTime}
            onSeek={(t) => {
              setCurrentTime(t);
              if (videoElementRef.current) {
                videoElementRef.current.currentTime = t;
              }
            }}
            isPlaying={isPlaying}
            onTogglePlay={togglePlay}
            trimStart={project.trimStart}
            trimEnd={project.trimEnd}
            onUpdateTrim={(start, end) => setProject({ ...project, trimStart: start, trimEnd: end })}
            overlays={project.overlays}
            selectedOverlayId={selectedOverlayId}
            onSelectOverlay={setSelectedOverlayId}
            onUpdateOverlay={handleUpdateOverlay}
            onDeleteOverlay={handleDeleteOverlay}
            onDuplicateOverlay={handleDuplicateOverlay}
          />
        </div>
      )}

      {/* ========================================================================= */}
      {/* STEP 3: PUBLISH DETAILS & DIRECT S3 UPLOAD                                */}
      {/* ========================================================================= */}
      {currentStep === 3 && project && (
        <div className="flex-1 flex flex-col justify-between p-4 sm:p-6 max-w-lg mx-auto w-full overflow-y-auto">
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <button
              onClick={() => setCurrentStep(2)}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-900 flex items-center gap-1 text-xs"
            >
              <ArrowLeft className="w-4 h-4" />
              Edit Video
            </button>
            <h3 className="text-base font-bold text-white">Publish Short</h3>
            <div className="w-8" />
          </div>

          {/* Publishing Form */}
          <div className="flex flex-col gap-4 my-4">
            {/* Cover Preview & Caption */}
            <div className="flex gap-3">
              <div
                onClick={() => setIsPosterModalOpen(true)}
                className="relative w-24 aspect-[9/16] rounded-xl bg-slate-900 border border-slate-800 hover:border-amber-400 cursor-pointer overflow-hidden shadow-lg shrink-0 flex items-center justify-center"
              >
                {project.posterDataUrl ? (
                  <img src={project.posterDataUrl} alt="Cover" className="w-full h-full object-cover" />
                ) : (
                  <Camera className="w-6 h-6 text-slate-500" />
                )}
                <div className="absolute inset-x-0 bottom-0 bg-black/60 text-[9px] text-white text-center py-0.5">
                  Change Cover
                </div>
              </div>

              <div className="flex-1 flex flex-col gap-2">
                <label className="text-xs font-semibold text-slate-400">Caption:</label>
                <textarea
                  value={caption}
                  onChange={e => setCaption(e.target.value)}
                  placeholder="Write a catchy caption about your short or local offer..."
                  rows={3}
                  className="w-full bg-slate-900 border border-slate-800 focus:border-amber-500 rounded-xl p-3 text-white text-xs outline-none resize-none"
                />
              </div>
            </div>

            {/* Hashtags */}
            <div>
              <label className="text-xs font-semibold text-slate-400 mb-1 block">Hashtags (Comma separated):</label>
              <input
                type="text"
                value={tagsInput}
                onChange={e => setTagsInput(e.target.value)}
                placeholder="shorts, biryani, offer, shopping"
                className="w-full bg-slate-900 border border-slate-800 focus:border-amber-500 rounded-xl px-3 py-2 text-white text-xs outline-none"
              />
            </div>

            {/* Audience Scope */}
            <div>
              <label className="text-xs font-semibold text-slate-400 mb-1 block">Distribution Scope:</label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setScope('worldwide')}
                  className={`p-2 rounded-xl text-xs font-bold border transition-colors flex flex-col items-center gap-1 ${
                    scope === 'worldwide'
                      ? 'bg-amber-500 text-slate-950 border-amber-400 shadow'
                      : 'bg-slate-900 border-slate-800 text-slate-300'
                  }`}
                >
                  <Globe className="w-4 h-4" />
                  Worldwide
                </button>
                <button
                  type="button"
                  onClick={() => setScope('40km')}
                  className={`p-2 rounded-xl text-xs font-bold border transition-colors flex flex-col items-center gap-1 ${
                    scope === '40km'
                      ? 'bg-amber-500 text-slate-950 border-amber-400 shadow'
                      : 'bg-slate-900 border-slate-800 text-slate-300'
                  }`}
                >
                  <MapPin className="w-4 h-4" />
                  Around Me (40km)
                </button>
                <button
                  type="button"
                  onClick={() => setScope('10km')}
                  className={`p-2 rounded-xl text-xs font-bold border transition-colors flex flex-col items-center gap-1 ${
                    scope === '10km'
                      ? 'bg-amber-500 text-slate-950 border-amber-400 shadow'
                      : 'bg-slate-900 border-slate-800 text-slate-300'
                  }`}
                >
                  <Store className="w-4 h-4" />
                  Hyperlocal (10km)
                </button>
              </div>
            </div>

            {/* Export & Upload Progress Bar */}
            {exportProgress && (
              <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 flex flex-col gap-2 animate-in fade-in">
                <div className="flex justify-between items-center text-xs font-bold">
                  <span className="text-amber-400 capitalize">
                    {exportProgress.stage === 'rendering' ? 'Rendering Overlays on Device...' : 'Uploading Direct to S3...'}
                  </span>
                  <span className="text-white font-mono">{exportProgress.progressPercent}%</span>
                </div>
                <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    style={{ width: `${exportProgress.progressPercent}%` }}
                    className="h-full bg-gradient-to-r from-amber-500 to-yellow-500 transition-all duration-200"
                  />
                </div>
              </div>
            )}

            {publishError && (
              <div className="p-3 bg-red-950/60 border border-red-500/40 rounded-xl text-xs text-red-300 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{publishError}</span>
              </div>
            )}
          </div>

          {/* Publish Action Button */}
          <button
            type="button"
            disabled={!!exportProgress}
            onClick={handlePublish}
            className="w-full py-3.5 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 text-slate-950 font-black rounded-xl text-sm shadow-xl flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <Check className="w-5 h-5" />
            {exportProgress ? 'Publishing Short...' : 'Publish to LocalNet Feed'}
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUB-MODALS & TOOLS                                                        */}
      {/* ========================================================================= */}
      {/* 1. Camera Recorder */}
      <CameraRecorder
        isOpen={isCameraOpen}
        onClose={() => setIsCameraOpen(false)}
        onVideoRecorded={handleCameraRecorded}
      />

      {/* 2. Custom Emoji & Sticker Drawer */}
      <CustomEmojiDrawer
        isOpen={isEmojiDrawerOpen}
        onClose={() => setIsEmojiDrawerOpen(false)}
        onSelectSticker={(dataUrl, isDrawn) => {
          handleAddOverlay({
            type: isDrawn ? 'emoji' : 'sticker',
            label: isDrawn ? 'Custom Drawing' : 'Custom Sticker',
            assetUrl: dataUrl,
            startTime: Number(currentTime.toFixed(1)),
            endTime: Number(Math.min(project?.duration || 15, currentTime + 6).toFixed(1)),
            position: { x: 50, y: 50 },
            size: { width: 35, height: 35 },
            rotation: 0,
            opacity: 1.0,
            zIndex: 15
          });
        }}
      />

      {/* 3. Picture Overlay Picker */}
      {project && (
        <ImageOverlayPicker
          isOpen={isImagePickerOpen}
          onClose={() => setIsImagePickerOpen(false)}
          currentTime={currentTime}
          videoDuration={project.duration}
          onAddImageOverlay={handleAddOverlay}
        />
      )}

      {/* 4. Text Overlay Editor */}
      {project && (
        <TextOverlayEditor
          isOpen={isTextEditorOpen}
          onClose={() => setIsTextEditorOpen(false)}
          currentTime={currentTime}
          videoDuration={project.duration}
          onAddTextOverlay={handleAddOverlay}
        />
      )}

      {/* 5. Price Tag Editor */}
      {project && (
        <PriceTagEditor
          isOpen={isPriceEditorOpen}
          onClose={() => setIsPriceEditorOpen(false)}
          currentTime={currentTime}
          videoDuration={project.duration}
          onAddPriceTag={handleAddOverlay}
        />
      )}

      {/* 6. Merchant Presets Modal */}
      {project && (
        <MerchantPresetsModal
          isOpen={isMerchantPresetsOpen}
          onClose={() => setIsMerchantPresetsOpen(false)}
          currentTime={currentTime}
          videoDuration={project.duration}
          onAddMerchantOverlay={handleAddOverlay}
        />
      )}

      {/* 7. Filter, Speed & Audio Controls */}
      {project && (
        <FilterAudioControls
          isOpen={isFilterAudioOpen}
          onClose={() => setIsFilterAudioOpen(false)}
          activeFilter={project.activeFilter}
          onSelectFilter={f => setProject({ ...project, activeFilter: f })}
          playbackSpeed={project.playbackSpeed}
          onChangeSpeed={s => setProject({ ...project, playbackSpeed: s })}
          originalAudioVolume={project.originalAudioVolume}
          onChangeOriginalAudioVolume={v => setProject({ ...project, originalAudioVolume: v })}
          isOriginalAudioMuted={project.isOriginalAudioMuted}
          onToggleMuteOriginalAudio={() => setProject({ ...project, isOriginalAudioMuted: !project.isOriginalAudioMuted })}
          backgroundMusicTitle={project.backgroundMusicTitle}
          onOpenMusicPicker={() => setIsAudioTrackModalOpen(true)}
          onRemoveMusic={() => setProject({ ...project, backgroundMusicUrl: undefined, backgroundMusicTitle: undefined })}
          brightness={project.brightness}
          onChangeBrightness={b => setProject({ ...project, brightness: b })}
          contrast={project.contrast}
          onChangeContrast={c => setProject({ ...project, contrast: c })}
          saturation={project.saturation}
          onChangeSaturation={s => setProject({ ...project, saturation: s })}
        />
      )}

      {/* 8. Poster Frame Generator */}
      {project && (
        <PosterGeneratorModal
          isOpen={isPosterModalOpen}
          onClose={() => setIsPosterModalOpen(false)}
          videoUrl={project.sourceUrl}
          videoDuration={project.duration}
          initialPosterUrl={project.posterDataUrl}
          initialTimestamp={project.posterTimestamp}
          onConfirmPoster={(posterDataUrl, timestamp) => {
            setProject({ ...project, posterDataUrl, posterTimestamp: timestamp });
          }}
        />
      )}

      {/* 9. Background Music Picker */}
      <AudioTrackPickerModal
        isOpen={isAudioTrackModalOpen}
        onClose={() => setIsAudioTrackModalOpen(false)}
        selectedTrack={null}
        onSelectTrack={(track) => {
          if (track && project) {
            setProject({
              ...project,
              backgroundMusicUrl: track.url,
              backgroundMusicTitle: `${track.title} - ${track.artist}`
            });
          }
          setIsAudioTrackModalOpen(false);
        }}
      />
    </div>
  );
};

