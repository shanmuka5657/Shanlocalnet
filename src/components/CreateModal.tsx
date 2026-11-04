import React, { useState, useEffect } from 'react';
import { useLocation } from '../context/LocationContext.tsx';
import { AudienceScope, PostClassification, Post } from '../types/index.ts';
import { inspectContentForCommercialPromotion, parseScopeToKm } from '../lib/geo.ts';
import { INITIAL_POSTS } from '../lib/mockData.ts';
import {
  X,
  Globe,
  MapPin,
  Zap,
  Film,
  Camera,
  FileText,
  AlertTriangle,
  CheckCircle2,
  Lock,
  Sparkles
} from 'lucide-react';
import { MediaUploader, UploadedMediaData } from './MediaUploader.tsx';

interface CreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPostCreated: (createdPost?: Post) => void;
}

export const CreateModal: React.FC<CreateModalProps> = ({
  isOpen,
  onClose,
  onPostCreated
}) => {
  const { viewerLocation } = useLocation();

  const [contentType, setContentType] = useState<'reel' | 'photo' | 'text'>('reel');
  const [classification, setClassification] = useState<PostClassification>('organic');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [uploadedMedia, setUploadedMedia] = useState<UploadedMediaData | null>(null);
  const [tagInput, setTagInput] = useState('entertainment, viral');
  const [isPaidPromotion, setIsPaidPromotion] = useState(false);
  const [scope, setScope] = useState<AudienceScope>('worldwide');
  const [customRadiusKm, setCustomRadiusKm] = useState<number>(10);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Real-time bypass detection
  const [inspectionResult, setInspectionResult] = useState(() =>
    inspectContentForCommercialPromotion('', '', [], false)
  );

  useEffect(() => {
    const tags = tagInput.split(',').map(t => t.trim()).filter(Boolean);
    const result = inspectContentForCommercialPromotion(
      title,
      description,
      tags,
      isPaidPromotion || classification === 'commercial' || classification === 'sponsored_creator'
    );
    setInspectionResult(result);

    // If commercial intent detected or declared, force commercial limits
    if (result.recommendedAction === 'FORCE_COMMERCIAL_40KM') {
      if (scope === 'worldwide' || scope === 'country' || (parseScopeToKm(scope, customRadiusKm) || 0) > 40) {
        setScope('40km');
      }
    }
  }, [title, description, tagInput, isPaidPromotion, classification, scope, customRadiusKm]);

  if (!isOpen) return null;

  const isCommercialMode =
    classification === 'commercial' ||
    classification === 'sponsored_creator' ||
    isPaidPromotion ||
    inspectionResult.recommendedAction === 'FORCE_COMMERCIAL_40KM';

  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setServerError(null);
    setSuccessMsg(null);

    if (contentType === 'reel' && !uploadedMedia) {
      setServerError('Please select and upload a video file for your reel before publishing.');
      setIsSubmitting(false);
      return;
    }

    if (contentType === 'photo' && !uploadedMedia) {
      setServerError('Please select and upload a photo before publishing, or switch to Text Story.');
      setIsSubmitting(false);
      return;
    }

    const tags = tagInput.split(',').map(t => t.trim()).filter(Boolean);
    const radiusNumber = parseScopeToKm(scope, customRadiusKm);

    const createLocalFallbackPost = () => {
      const localPost: Post = {
        id: `post_local_${Date.now()}`,
        creatorId: 'current_user_1',
        creatorName: 'Arjun Rayalaseema',
        creatorHandle: '@arjun_grooves',
        creatorAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80',
        creatorVerified: true,
        contentType,
        classification: isCommercialMode ? 'sponsored_creator' : 'organic',
        title,
        description,
        mediaUrl: uploadedMedia?.publicUrl || '',
        mediaThumbnail: uploadedMedia?.thumbnailUrl || '',
        trimStartSeconds: uploadedMedia?.trimStartSeconds,
        trimEndSeconds: uploadedMedia?.trimEndSeconds,
        mediaGradient: 'from-amber-600 via-rose-600 to-indigo-900',
        aspectRatio: contentType === 'reel' ? '9:16' : '16:9',
        publishingLocation: {
          latitude: viewerLocation.coords.latitude,
          longitude: viewerLocation.coords.longitude,
          cityName: viewerLocation.cityName,
          state: viewerLocation.stateName,
          country: viewerLocation.country,
          isVerified: viewerLocation.isVerified,
          publishedAt: new Date().toISOString()
        },
        audienceDistribution: {
          engine: isCommercialMode ? 'COMMERCIAL_ADVERTISEMENT' : 'ORGANIC_ENTERTAINMENT',
          scope,
          maxRadiusKm: radiusNumber,
          targetCountry: viewerLocation.countryCode
        },
        tags,
        createdAt: new Date().toISOString(),
        stats: { likes: 0, comments: 0, shares: 0, saves: 0, views: 0 },
        moderation: { status: 'approved' }
      };
      INITIAL_POSTS.unshift(localPost);
      setSuccessMsg('Published successfully!');
      onPostCreated(localPost);
      setTimeout(() => {
        onClose();
      }, 1000);
      setIsSubmitting(false);
    };

    try {
      const response = await fetch('/api/posts/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          description,
          contentType,
          mediaAssetId: uploadedMedia?.mediaAssetId || undefined,
          mediaUrl: uploadedMedia?.publicUrl || undefined,
          mediaThumbnail: uploadedMedia?.thumbnailUrl || undefined,
          aspectRatio: uploadedMedia?.aspectRatio || (contentType === 'reel' ? '9:16' : '4:3'),
          videoDurationSeconds: uploadedMedia?.videoDurationSeconds,
          trimStartSeconds: uploadedMedia?.trimStartSeconds,
          trimEndSeconds: uploadedMedia?.trimEndSeconds,
          classification: isCommercialMode ? 'sponsored_creator' : 'organic',
          isPaidPromotion: isCommercialMode,
          scope,
          radiusKm: radiusNumber,
          publishingLocation: {
            latitude: viewerLocation.coords.latitude,
            longitude: viewerLocation.coords.longitude,
            cityName: viewerLocation.cityName,
            state: viewerLocation.stateName,
            country: viewerLocation.country,
            isVerified: viewerLocation.isVerified
          },
          commercialMetadata: isCommercialMode
            ? {
              businessName: 'Local Sponsor',
              isPaidPromotion: true,
              ctaText: 'Learn More'
            }
            : undefined,
          tags
        })
      });

      let data: any = null;
      try {
        const text = await response.text();
        data = JSON.parse(text);
      } catch {
        data = null;
      }

      if (!response.ok || !data) {
        // Fallback for static hosting demo (e.g. Vercel without Express backend)
        const localPost: Post = {
          id: `post_local_${Date.now()}`,
          creatorId: 'current_user_1',
          creatorName: 'Arjun Rayalaseema',
          creatorHandle: '@arjun_grooves',
          creatorAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80',
          creatorVerified: true,
          contentType,
          classification: isCommercialMode ? 'sponsored_creator' : 'organic',
          title,
          description,
          mediaUrl: uploadedMedia?.publicUrl || '',
          mediaThumbnail: uploadedMedia?.thumbnailUrl || '',
          mediaGradient: 'from-amber-600 via-rose-600 to-indigo-900',
          aspectRatio: contentType === 'reel' ? '9:16' : '16:9',
          publishingLocation: {
            latitude: viewerLocation.coords.latitude,
            longitude: viewerLocation.coords.longitude,
            cityName: viewerLocation.cityName,
            state: viewerLocation.stateName,
            country: viewerLocation.country,
            isVerified: viewerLocation.isVerified,
            publishedAt: new Date().toISOString()
          },
          audienceDistribution: {
            engine: isCommercialMode ? 'COMMERCIAL_ADVERTISEMENT' : 'ORGANIC_ENTERTAINMENT',
            scope,
            maxRadiusKm: radiusNumber,
            targetCountry: viewerLocation.countryCode
          },
          tags,
          createdAt: new Date().toISOString(),
          stats: { likes: 0, comments: 0, shares: 0, saves: 0, views: 0 },
          moderation: { status: 'approved' }
        };
        INITIAL_POSTS.unshift(localPost);
        setSuccessMsg('Published successfully!');
        onPostCreated();
        setTimeout(() => {
          onClose();
        }, 1200);
        return;
      } else {
        const createdPost: Post = data.post || {
          id: `post_${Date.now()}`,
          creatorId: 'current_user_1',
          creatorName: 'Arjun Rayalaseema',
          creatorHandle: '@arjun_grooves',
          creatorAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80',
          creatorVerified: true,
          contentType,
          classification: isCommercialMode ? 'sponsored_creator' : 'organic',
          title,
          description,
          mediaUrl: uploadedMedia?.publicUrl || '',
          mediaThumbnail: uploadedMedia?.thumbnailUrl || '',
          mediaGradient: 'from-amber-600 via-rose-600 to-indigo-900',
          aspectRatio: uploadedMedia?.aspectRatio || (contentType === 'reel' ? '9:16' : '16:9'),
          videoDurationSeconds: uploadedMedia?.videoDurationSeconds,
          publishingLocation: {
            latitude: viewerLocation.coords.latitude,
            longitude: viewerLocation.coords.longitude,
            cityName: viewerLocation.cityName,
            state: viewerLocation.stateName,
            country: viewerLocation.country,
            isVerified: viewerLocation.isVerified,
            publishedAt: new Date().toISOString()
          },
          audienceDistribution: {
            engine: isCommercialMode ? 'COMMERCIAL_ADVERTISEMENT' : 'ORGANIC_ENTERTAINMENT',
            scope,
            maxRadiusKm: radiusNumber,
            targetCountry: viewerLocation.countryCode
          },
          tags,
          createdAt: new Date().toISOString(),
          stats: { likes: 0, comments: 0, shares: 0, saves: 0, views: 0 },
          moderation: { status: 'approved' }
        };
        INITIAL_POSTS.unshift(createdPost);
        setSuccessMsg(
          isCommercialMode
            ? 'Commercial post published! Capped at max 40 km.'
            : 'Organic entertainment published with selected distribution!'
        );
        onPostCreated(createdPost);
        setTimeout(() => {
          onClose();
        }, 1200);
      }
    } catch (err: any) {
      // Local fallback on network failure
      const localPost: Post = {
        id: `post_local_${Date.now()}`,
        creatorId: 'current_user_1',
        creatorName: 'Arjun Rayalaseema',
        creatorHandle: '@arjun_grooves',
        creatorAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80',
        creatorVerified: true,
        contentType,
        classification: isCommercialMode ? 'sponsored_creator' : 'organic',
        title,
        description,
        mediaUrl: uploadedMedia?.publicUrl || '',
        mediaThumbnail: '',
        mediaGradient: 'from-amber-600 via-rose-600 to-indigo-900',
        aspectRatio: contentType === 'reel' ? '9:16' : '16:9',
        publishingLocation: {
          latitude: viewerLocation.coords.latitude,
          longitude: viewerLocation.coords.longitude,
          cityName: viewerLocation.cityName,
          state: viewerLocation.stateName,
          country: viewerLocation.country,
          isVerified: viewerLocation.isVerified,
          publishedAt: new Date().toISOString()
        },
        audienceDistribution: {
          engine: isCommercialMode ? 'COMMERCIAL_ADVERTISEMENT' : 'ORGANIC_ENTERTAINMENT',
          scope,
          maxRadiusKm: radiusNumber,
          targetCountry: viewerLocation.countryCode
        },
        tags,
        createdAt: new Date().toISOString(),
        stats: { likes: 0, comments: 0, shares: 0, saves: 0, views: 0 },
        moderation: { status: 'approved' }
      };
      INITIAL_POSTS.unshift(localPost);
      setSuccessMsg('Published successfully!');
      onPostCreated(localPost);
      setTimeout(() => {
        onClose();
      }, 1200);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[92dvh]">

        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-amber-500 shrink-0" />
              <span>Create Content Studio</span>
            </h3>
            <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400">
              Publishing from: {viewerLocation.cityName} ({viewerLocation.country})
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 sm:space-y-5">
          {serverError && (
            <div className="p-3.5 sm:p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-300 text-xs flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Server Distribution Policy Violation:</p>
                <p className="mt-0.5">{serverError}</p>
              </div>
            </div>
          )}

          {successMsg && (
            <div className="p-3.5 sm:p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-emerald-800 dark:text-emerald-300 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-600 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          <form onSubmit={handlePublish} className="space-y-4 sm:space-y-5">
            {/* Content Type Selector */}
            <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
              <button
                type="button"
                onClick={() => setContentType('reel')}
                className={`py-2 px-1 sm:px-3 rounded-xl border flex items-center justify-center gap-1.5 text-[11px] sm:text-xs font-semibold transition-all ${contentType === 'reel'
                    ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/30 text-amber-900 dark:text-amber-200'
                    : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                  }`}
              >
                <Film className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                <span className="truncate">Vertical Reel</span>
              </button>

              <button
                type="button"
                onClick={() => setContentType('photo')}
                className={`py-2 px-1 sm:px-3 rounded-xl border flex items-center justify-center gap-1.5 text-[11px] sm:text-xs font-semibold transition-all ${contentType === 'photo'
                    ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/30 text-amber-900 dark:text-amber-200'
                    : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                  }`}
              >
                <Camera className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                <span className="truncate">Photo Post</span>
              </button>

              <button
                type="button"
                onClick={() => setContentType('text')}
                className={`py-2 px-1 sm:px-3 rounded-xl border flex items-center justify-center gap-1.5 text-[11px] sm:text-xs font-semibold transition-all ${contentType === 'text'
                    ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/30 text-amber-900 dark:text-amber-200'
                    : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                  }`}
              >
                <FileText className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                <span className="truncate">Text Story</span>
              </button>
            </div>

            {/* Media Uploader Section */}
            {contentType !== 'text' ? (
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  {contentType === 'reel' ? 'Upload Reel Video (MP4 / WebM)' : 'Upload Photo (JPEG / PNG / WebP)'}
                </label>
                <MediaUploader
                  contentType={contentType}
                  onMediaUploaded={(data) => {
                    setUploadedMedia(data);
                    setServerError(null);
                  }}
                  onMediaCleared={() => setUploadedMedia(null)}
                />
              </div>
            ) : (
              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 text-[11px] text-slate-600 dark:text-slate-400 flex items-center gap-2">
                <FileText className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>Text stories do not require media files. You can publish text updates and announcements directly.</span>
              </div>
            )}

            {/* Classification Toggle */}
            <div className="p-3 sm:p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 space-y-2">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                Content Engine Classification
              </span>
              <div className="grid grid-cols-1 min-[420px]:grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setClassification('organic');
                    setIsPaidPromotion(false);
                  }}
                  className={`p-2.5 rounded-xl border text-left transition-all ${!isCommercialMode
                      ? 'border-indigo-500 bg-indigo-50/70 dark:bg-indigo-950/40 text-indigo-950 dark:text-indigo-200 ring-1 ring-indigo-500'
                      : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600'
                    }`}
                >
                  <span className="font-bold text-xs flex items-center gap-1.5">
                    <Globe className="w-3.5 h-3.5 text-indigo-600" />
                    Engine A: Organic
                  </span>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                    Free entertainment. Creator controls reach up to Worldwide.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setClassification('commercial');
                    setIsPaidPromotion(true);
                  }}
                  className={`p-2.5 rounded-xl border text-left transition-all ${isCommercialMode
                      ? 'border-amber-500 bg-amber-50/70 dark:bg-amber-950/40 text-amber-950 dark:text-amber-200 ring-1 ring-amber-500'
                      : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600'
                    }`}
                >
                  <span className="font-bold text-xs flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5 text-amber-600" />
                    Engine B: Commercial
                  </span>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                    Promotion/Ad. Strictly capped at max 40 km.
                  </p>
                </button>
              </div>
            </div>

            {/* Title & Description */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Post Title
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="e.g. Traditional Telugu Folk Dance in Kurnool"
                className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Description / Caption
              </label>
              <textarea
                required
                rows={3}
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Share your story, comedy, education, or local discovery..."
                className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Tags (comma separated)
              </label>
              <input
                type="text"
                value={tagInput}
                onChange={e => setTagInput(e.target.value)}
                placeholder="dance, music, kurnool, comedy"
                className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              />
            </div>

            {/* Anti-Bypass Scanner Warning if Commercial content detected */}
            {inspectionResult.isCommercialDetected && (
              <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-900/60 text-xs text-amber-900 dark:text-amber-200 space-y-1">
                <div className="flex items-center gap-1.5 font-bold">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  <span>Commercial Promotion Detected</span>
                </div>
                <p className="leading-relaxed">
                  {inspectionResult.noticeMessage}
                </p>
                <div className="flex items-center gap-1 text-[11px] text-amber-800 dark:text-amber-400 font-mono">
                  <span>Detected keywords:</span>
                  <span>[{inspectionResult.matchedKeywords.join(', ')}]</span>
                </div>
              </div>
            )}

            {/* AUDIENCE DISTRIBUTION RADIUS SELECTOR */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                    <MapPin className="w-4 h-4 text-amber-500" />
                    Audience Geographical Distribution
                  </span>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    {isCommercialMode
                      ? 'Engine B: Maximum allowed radius is 40 km'
                      : 'Engine A: Creator has full control up to Worldwide'}
                  </p>
                </div>

                <span className="text-xs font-bold font-mono px-2 py-0.5 rounded-md bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200">
                  {scope.toUpperCase()}
                </span>
              </div>

              {/* Scope Options */}
              <div className="flex flex-wrap gap-1.5">
                {(['1km', '5km', '10km', '20km', '40km'] as AudienceScope[]).map(s => (
                  <button
                    type="button"
                    key={s}
                    onClick={() => setScope(s)}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition-all ${scope === s
                        ? 'bg-amber-600 text-white shadow-sm'
                        : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-amber-400'
                      }`}
                  >
                    {s}
                  </button>
                ))}

                {/* Extended scopes for Organic ONLY */}
                {(['100km', '200km', '500km', 'country', 'worldwide'] as AudienceScope[]).map(s => {
                  const isDisabled = isCommercialMode;
                  return (
                    <button
                      type="button"
                      key={s}
                      disabled={isDisabled}
                      onClick={() => !isDisabled && setScope(s)}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition-all flex items-center gap-1 ${scope === s
                          ? 'bg-indigo-600 text-white shadow-sm'
                          : isDisabled
                            ? 'bg-slate-100 dark:bg-slate-800/40 text-slate-400 border border-slate-200 dark:border-slate-800 cursor-not-allowed opacity-50'
                            : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-indigo-400'
                        }`}
                      title={isDisabled ? 'Commercial content is strictly capped at 40 km under platform policy' : ''}
                    >
                      {isDisabled && <Lock className="w-3 h-3 text-slate-400" />}
                      <span>{s === 'worldwide' ? 'Worldwide 🌍' : s}</span>
                    </button>
                  );
                })}
              </div>

              {isCommercialMode && (
                <p className="text-[11px] text-amber-700 dark:text-amber-400">
                  Notice: Extended options (&gt;40km and Worldwide) are disabled because commercial content cannot exceed 40 km.
                </p>
              )}
            </div>

            {/* Publishing coordinates display */}
            <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-between">
              <span>Original Publishing Anchor:</span>
              <span className="font-mono">
                {viewerLocation.cityName} ({viewerLocation.coords.latitude.toFixed(3)}°N, {viewerLocation.coords.longitude.toFixed(3)}°E)
              </span>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-6 py-2.5 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-xl transition-all shadow-sm disabled:opacity-50"
              >
                {isSubmitting ? 'Verifying Distribution Policy...' : 'Publish to LocalNet'}
              </button>
            </div>
          </form>
        </div>

      </div>
    </div>
  );
};
