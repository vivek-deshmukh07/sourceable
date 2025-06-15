import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { formatCoordinates, formatApproxCoordinates } from '../utils/gps';
import { formatTimestamp } from '../utils/timestamp';
import { MediaMetadata, supabase } from '../utils/supabase';
import Map from '../components/Map';
import { addWatermark, addVideoWatermark } from '../utils/watermark';
import QRCode from 'qrcode';

const VerifyScreen = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [metadata, setMetadata] = useState<MediaMetadata | null>(null);
  const [error, setError] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [isProcessingWatermark, setIsProcessingWatermark] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const verificationUrl = `${window.location.origin}/verify/${id}`;

  const getMediaType = (url: string): 'image' | 'video' => {
    const extension = url.split('.').pop()?.toLowerCase();
    return extension === 'mp4' ? 'video' : 'image';
  };

  useEffect(() => {
    const fetchMetadata = async () => {
      console.log('Fetching metadata for ID:', id);
      try {
        const { data, error } = await supabase
          .from('media_metadata')
          .select('*')
          .eq('public_url', id)
          .single();

        console.log('Supabase response:', { data, error });

        if (error) throw error;
        setMetadata(data);
      } catch (err) {
        console.error('Failed to fetch metadata:', err);
        setError('Failed to load verification data');
      } finally {
        setIsLoading(false);
      }
    };

    if (id) {
      fetchMetadata();
    } else {
      console.error('No ID provided in URL');
      setError('Invalid verification URL');
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    const createWatermarkedPreview = async () => {
      if (!metadata) return;

      try {
        setIsProcessingWatermark(true);
        const watermarkOptions = {
          logoUrl: '/images/image.png',
          verificationUrl: verificationUrl,
          gpsPrecision: metadata.gps_precision,
          gpsRadiusMiles: metadata.gps_radius_miles,
          timestamp: formatTimestamp(metadata.timestamp_local),
          gpsLat: metadata.gps_lat,
          gpsLng: metadata.gps_lng,
        };

        const mediaType = getMediaType(metadata.media_url);
        if (mediaType === 'video') {
          // For videos, just use the original URL
          setPreviewUrl(metadata.media_url);
        } else {
          const watermarkedUrl = await addWatermark(metadata.media_url, watermarkOptions);
          setPreviewUrl(watermarkedUrl);
        }
      } catch (err) {
        console.error('Failed to create watermarked preview:', err);
        setError('Failed to create preview');
      } finally {
        setIsProcessingWatermark(false);
      }
    };

    if (metadata) {
      createWatermarkedPreview();
    }
  }, [metadata, verificationUrl]);

  useEffect(() => {
    const generateQRCode = async () => {
      try {
        const qrCode = await QRCode.toDataURL(verificationUrl, {
          width: 200,
          margin: 2,
          color: {
            dark: '#000000',
            light: '#ffffff',
          },
        });
        setQrCodeUrl(qrCode);
      } catch (err) {
        console.error('Failed to generate QR code:', err);
      }
    };

    generateQRCode();
  }, [verificationUrl]);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
  };

  const handleDownload = async () => {
    if (!metadata) return;

    try {
      const response = await fetch(metadata.media_url);
      const blob = await response.blob();
      const mediaUrl = URL.createObjectURL(blob);

      let watermarkedUrl: string;
      const watermarkOptions = {
        logoUrl: '/images/image.png',
        verificationUrl: verificationUrl,
        gpsPrecision: metadata.gps_precision,
        gpsRadiusMiles: metadata.gps_radius_miles,
        timestamp: formatTimestamp(metadata.timestamp_local),
        gpsLat: metadata.gps_lat,
        gpsLng: metadata.gps_lng,
      };

      const mediaType = getMediaType(metadata.media_url);
      if (mediaType === 'video') {
        watermarkedUrl = await addVideoWatermark(mediaUrl, watermarkOptions);
      } else {
        watermarkedUrl = await addWatermark(mediaUrl, watermarkOptions);
      }

      const a = document.createElement('a');
      a.href = watermarkedUrl;
      a.download = `sourceable-${metadata.public_url}.${mediaType === 'video' ? 'webm' : 'jpg'}`;
      document.body.appendChild(a);
      a.click();
      URL.revokeObjectURL(mediaUrl);
      document.body.removeChild(a);
    } catch (err) {
      console.error('Download failed:', err);
    }
  };

  const handleNewCapture = () => {
    navigate('/');
  };

  const renderLocationLabel = () => {
    if (metadata?.gps_precision === 'exact') {
      return formatCoordinates(metadata.gps_lat, metadata.gps_lng, 'exact');
    } else {
      return `Within ${metadata?.gps_radius_miles} mile radius`;
    }
  };

  const renderApproxCoordinates = () => {
    if (metadata?.gps_lat !== undefined && metadata?.gps_lng !== undefined) {
      return formatApproxCoordinates(metadata.gps_lat, metadata.gps_lng);
    }
    return '';
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (error || !metadata) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="bg-red-50 p-4 rounded-lg max-w-md w-full">
          <p className="text-red-600">{error || 'Verification data not found'}</p>
        </div>
      </div>
    );
  }

  console.log('Rendering with metadata:', metadata);

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-md mx-auto space-y-6">
        <div className="bg-white rounded-lg overflow-hidden shadow-sm relative">
          {metadata && getMediaType(metadata.media_url) === 'video' ? (
            <video
              src={metadata.media_url}
              controls
              className="w-full h-64 object-cover"
            />
          ) : (
            <>
              <img
                src={previewUrl || metadata.media_url}
                alt="Verified media"
                className="max-w-full max-h-[80vh] object-contain"
              />
              {isProcessingWatermark && (
                <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
                  <div className="text-white text-sm">Processing watermark...</div>
                </div>
              )}
            </>
          )}
        </div>

        <div className="bg-white p-4 rounded-lg shadow-sm space-y-4">
          <div>
            <h3 className="text-sm font-medium text-gray-500">Location</h3>
            <p className="mt-1 text-gray-900">
              {renderLocationLabel()}
            </p>
            <p className="mt-1 text-gray-500 text-sm italic">
              Approx. coordinates: {renderApproxCoordinates()}
            </p>
          </div>

          <div>
            <h3 className="text-sm font-medium text-gray-500">Local Time</h3>
            <p className="mt-1 text-gray-900">
              {formatTimestamp(metadata.timestamp_local)}
            </p>
          </div>

          <div>
            <h3 className="text-sm font-medium text-gray-500">UTC Time</h3>
            <p className="mt-1 text-gray-900">
              {formatTimestamp(metadata.timestamp_utc, 'utc')}
            </p>
          </div>

          <div>
            <h3 className="text-sm font-medium text-gray-500">Attribution</h3>
            <p className="mt-1 text-gray-900">
              Uploaded by {metadata.uploader_name || 'Anonymous'}
            </p>
          </div>

          {metadata.gps_lat && metadata.gps_lng && (
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-2">Location Map</h3>
              <div className="h-64 rounded-lg overflow-hidden">
                <Map
                  center={[metadata.gps_lat, metadata.gps_lng]}
                  zoom={13}
                  radiusMiles={metadata.gps_precision !== 'exact' ? metadata.gps_radius_miles : undefined}
                />
              </div>
            </div>
          )}
        </div>

        <div className="flex space-x-4">
          <button
            onClick={handleCopyLink}
            className="flex-1 btn btn-secondary"
          >
            Copy Link
          </button>
          <button
            onClick={handleDownload}
            className="flex-1 btn btn-primary"
          >
            Download Media
          </button>
        </div>

        {/* QR Code */}
        {qrCodeUrl && (
          <div className="bg-white p-4 rounded-lg shadow-sm text-center">
            <h3 className="text-sm font-medium text-gray-500 mb-2">
              Scan to View
            </h3>
            <img
              src={qrCodeUrl}
              alt="QR Code"
              className="w-48 h-48 mx-auto"
            />
          </div>
        )}

        {/* Capture New Media Button */}
        <button
          onClick={handleNewCapture}
          className="w-full btn btn-secondary"
        >
          Capture New Media
        </button>

        {/* Share Options */}
        <div className="bg-white p-4 rounded-lg shadow-sm">
          <h3 className="text-sm font-medium text-gray-500 mb-3">Share to</h3>
          <div className="grid grid-cols-5 gap-3">
            {/* WhatsApp */}
            <button
              onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(window.location.href)}`, '_blank')}
              className="flex flex-col items-center justify-center p-2 rounded-lg hover:bg-gray-50 transition-colors"
              title="Share on WhatsApp"
            >
              <svg className="w-6 h-6 text-green-600" fill="currentColor" viewBox="0 0 24 24">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
              <span className="text-xs mt-1">WhatsApp</span>
            </button>

            {/* Facebook */}
            <button
              onClick={() => window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(window.location.href)}`, '_blank')}
              className="flex flex-col items-center justify-center p-2 rounded-lg hover:bg-gray-50 transition-colors"
              title="Share on Facebook"
            >
              <svg className="w-6 h-6 text-blue-600" fill="currentColor" viewBox="0 0 24 24">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
              </svg>
              <span className="text-xs mt-1">Facebook</span>
            </button>

            {/* Twitter */}
            <button
              onClick={() => window.open(`https://twitter.com/intent/tweet?url=${encodeURIComponent(window.location.href)}`, '_blank')}
              className="flex flex-col items-center justify-center p-2 rounded-lg hover:bg-gray-50 transition-colors"
              title="Share on Twitter"
            >
              <svg className="w-6 h-6 text-blue-400" fill="currentColor" viewBox="0 0 24 24">
                <path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z"/>
              </svg>
              <span className="text-xs mt-1">Twitter</span>
            </button>

            {/* LinkedIn */}
            <button
              onClick={() => window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(window.location.href)}`, '_blank')}
              className="flex flex-col items-center justify-center p-2 rounded-lg hover:bg-gray-50 transition-colors"
              title="Share on LinkedIn"
            >
              <svg className="w-6 h-6 text-blue-700" fill="currentColor" viewBox="0 0 24 24">
                <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
              </svg>
              <span className="text-xs mt-1">LinkedIn</span>
            </button>

            {/* Telegram */}
            <button
              onClick={() => window.open(`https://t.me/share/url?url=${encodeURIComponent(window.location.href)}`, '_blank')}
              className="flex flex-col items-center justify-center p-2 rounded-lg hover:bg-gray-50 transition-colors"
              title="Share on Telegram"
            >
              <svg className="w-6 h-6 text-blue-500" fill="currentColor" viewBox="0 0 24 24">
                <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.306.048.42.024.12.048.24.072.36.096.24.024-.12.048-.24.072-.36.096z"/>
              </svg>
              <span className="text-xs mt-1">Telegram</span>
            </button>

            {/* Email */}
            <button
              onClick={() => window.open(`mailto:?subject=Check this out&body=${encodeURIComponent(window.location.href)}`, '_blank')}
              className="flex flex-col items-center justify-center p-2 rounded-lg hover:bg-gray-50 transition-colors"
              title="Share via Email"
            >
              <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
              </svg>
              <span className="text-xs mt-1">Email</span>
            </button>

            {/* SMS */}
            <button
              onClick={() => window.open(`sms:?body=${encodeURIComponent(window.location.href)}`, '_blank')}
              className="flex flex-col items-center justify-center p-2 rounded-lg hover:bg-gray-50 transition-colors"
              title="Share via SMS"
            >
              <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"/>
              </svg>
              <span className="text-xs mt-1">SMS</span>
            </button>

            {/* Pinterest */}
            <button
              onClick={() => window.open(`https://pinterest.com/pin/create/button/?url=${encodeURIComponent(window.location.href)}`, '_blank')}
              className="flex flex-col items-center justify-center p-2 rounded-lg hover:bg-gray-50 transition-colors"
              title="Share on Pinterest"
            >
              <svg className="w-6 h-6 text-red-600" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12.017 0C5.396 0 .029 5.367.029 11.987c0 5.079 3.158 9.417 7.618 11.162-.105-.949-.199-2.403.041-3.439.219-.937 1.406-5.957 1.406-5.957s-.359-.72-.359-1.781c0-1.663.967-2.911 2.168-2.911 1.024 0 1.518.769 1.518 1.688 0 1.029-.653 2.567-.992 3.992-.285 1.193.6 2.165 1.775 2.165 2.128 0 3.768-2.245 3.768-5.487 0-2.861-2.063-4.869-5.008-4.869-3.41 0-5.409 2.562-5.409 5.199 0 1.033.394 2.143.889 2.741.099.12.112.225.085.345-.09.375-.293 1.199-.334 1.363-.053.225-.172.271-.401.165-1.495-.69-2.433-2.878-2.433-4.646 0-3.776 2.748-7.252 7.92-7.252 4.158 0 7.392 2.967 7.392 6.923 0 4.135-2.607 7.462-6.233 7.462-1.214 0-2.354-.629-2.758-1.379l-.749 2.848c-.269 1.045-1.004 2.352-1.498 3.146 1.123.345 2.306.535 3.55.535 6.607 0 11.985-5.365 11.985-11.987C23.97 5.39 18.592.026 11.985.026L12.017 0z"/>
              </svg>
              <span className="text-xs mt-1">Pinterest</span>
            </button>

            {/* Reddit */}
            <button
              onClick={() => window.open(`https://reddit.com/submit?url=${encodeURIComponent(window.location.href)}`, '_blank')}
              className="flex flex-col items-center justify-center p-2 rounded-lg hover:bg-gray-50 transition-colors"
              title="Share on Reddit"
            >
              <svg className="w-6 h-6 text-orange-600" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.687-.562-1.249-1.25-1.249zm-5.466 3.99a.327.327 0 0 0-.231.094.33.33 0 0 0 0 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 0 0 .029-.463.33.33 0 0 0-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.196-2.512-.73a.326.326 0 0 0-.232-.095z"/>
              </svg>
              <span className="text-xs mt-1">Reddit</span>
            </button>

            {/* Instagram */}
            <button
              onClick={() => {
                navigator.clipboard.writeText(window.location.href);
                alert('Link copied! Paste it in your Instagram story or DM.');
              }}
              className="flex flex-col items-center justify-center p-2 rounded-lg hover:bg-gray-50 transition-colors"
              title="Share on Instagram"
            >
              <svg className="w-6 h-6 text-pink-600" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
              </svg>
              <span className="text-xs mt-1">Instagram</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VerifyScreen;
