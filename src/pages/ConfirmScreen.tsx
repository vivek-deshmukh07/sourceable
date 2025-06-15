import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatCoordinates, GpsPrecision } from '../utils/gps';
import { formatTimestamp } from '../utils/timestamp';
import { uploadMedia } from '../utils/supabase';

interface CaptureData {
  media: string;
  mediaType: 'image' | 'video';
  location: {
    latitude: number;
    longitude: number;
    accuracy: number;
  };
  timestamps: {
    local: string;
    utc: string;
  };
  facingMode: 'environment' | 'user';
  rotationAngle: number;
}

const ConfirmScreen = () => {
  const navigate = useNavigate();
  const [captureData, setCaptureData] = useState<CaptureData | null>(null);
  const [uploaderName, setUploaderName] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string>('');
  const [gpsPrecision, setGpsPrecision] = useState<GpsPrecision>('exact');
  const [gpsRadius, setGpsRadius] = useState<number>(5);

  useEffect(() => {
    const storedData = sessionStorage.getItem('captureData');
    if (!storedData) {
      navigate('/');
      return;
    }
    setCaptureData(JSON.parse(storedData));
  }, [navigate]);

  useEffect(() => {
    if (gpsPrecision === '5mile') setGpsRadius(5);
    else if (gpsPrecision === '10mile') setGpsRadius(10);
    else if (gpsPrecision === '20mile') setGpsRadius(20);
    else setGpsRadius(0);
  }, [gpsPrecision]);

  const handleConfirm = async () => {
    if (!captureData) return;

    setIsUploading(true);
    setError('');

    try {
      const response = await fetch(captureData.media);
      const blob = await response.blob();
      const file = new File(
        [blob],
        `media.${captureData.mediaType === 'video' ? 'webm' : 'jpg'}`,
        { type: captureData.mediaType === 'video' ? 'video/webm' : 'image/jpeg' }
      );

      const result = await uploadMedia(file, {
        timestamp_local: captureData.timestamps.local,
        timestamp_utc: captureData.timestamps.utc,
        gps_lat: captureData.location.latitude,
        gps_lng: captureData.location.longitude,
        uploader_name: isAnonymous ? undefined : uploaderName,
        gps_precision: gpsPrecision,
        gps_radius_miles: gpsRadius,
      });

      sessionStorage.setItem('uploadResult', JSON.stringify(result));
      navigate(`/verify/${result.public_url}`);
    } catch (error) {
      setError(`Failed to upload media: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsUploading(false);
    }
  };

  if (!captureData) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-md mx-auto space-y-6">
        {/* Preview */}
        <div className="bg-white rounded-lg overflow-hidden shadow-sm">
          {captureData.mediaType === 'video' ? (
            <video
              src={captureData.media}
              controls
              className="w-full h-64 object-cover"
              style={{
                transform: `rotate(${-captureData.rotationAngle || 0}deg) ${
                  captureData.facingMode === 'user' ? ' scaleX(-1)' : ''
                }`,
                transition: 'transform 0.3s ease'
              }}
            />
          ) : (
            <img
              src={captureData.media}
              alt="Captured media"
              className="w-full h-64 object-cover"
              style={{
                transform: `rotate(${-captureData.rotationAngle || 0}deg) ${
                  captureData.facingMode === 'user' ? ' scaleX(-1)' : ''
                }`,
                transition: 'transform 0.3s ease'
              }}
            />
          )}
        </div>

        {/* Metadata */}
        <div className="bg-white p-4 rounded-lg shadow-sm space-y-4">
          <div>
            <h3 className="text-sm font-medium text-gray-500">Location</h3>
            <p className="mt-1 text-gray-900">
              {formatCoordinates(captureData.location.latitude, captureData.location.longitude, gpsPrecision)}
            </p>
            <div className="mt-2">
              <label className="text-sm text-gray-500">Location Precision</label>
              <div className="mt-2 space-y-2">
                <label className="flex items-center p-3 rounded-lg border border-gray-200 hover:bg-gray-50 cursor-pointer transition-colors">
                  <input
                    type="radio"
                    value="exact"
                    checked={gpsPrecision === 'exact'}
                    onChange={(e) => setGpsPrecision(e.target.value as GpsPrecision)}
                    className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300"
                  />
                  <span className="ml-3 text-sm text-gray-900">Exact Location</span>
                </label>
                <label className="flex items-center p-3 rounded-lg border border-gray-200 hover:bg-gray-50 cursor-pointer transition-colors">
                  <input
                    type="radio"
                    value="5mile"
                    checked={gpsPrecision === '5mile'}
                    onChange={(e) => setGpsPrecision(e.target.value as GpsPrecision)}
                    className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300"
                  />
                  <span className="ml-3 text-sm text-gray-900">5-mile Radius</span>
                </label>
                <label className="flex items-center p-3 rounded-lg border border-gray-200 hover:bg-gray-50 cursor-pointer transition-colors">
                  <input
                    type="radio"
                    value="10mile"
                    checked={gpsPrecision === '10mile'}
                    onChange={(e) => setGpsPrecision(e.target.value as GpsPrecision)}
                    className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300"
                  />
                  <span className="ml-3 text-sm text-gray-900">10-mile Radius</span>
                </label>
                <label className="flex items-center p-3 rounded-lg border border-gray-200 hover:bg-gray-50 cursor-pointer transition-colors">
                  <input
                    type="radio"
                    value="20mile"
                    checked={gpsPrecision === '20mile'}
                    onChange={(e) => setGpsPrecision(e.target.value as GpsPrecision)}
                    className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300"
                  />
                  <span className="ml-3 text-sm text-gray-900">20-mile Radius</span>
                </label>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-medium text-gray-500">Local Time</h3>
            <p className="mt-1 text-gray-900">
              {formatTimestamp(captureData.timestamps.local)}
            </p>
          </div>

          <div>
            <h3 className="text-sm font-medium text-gray-500">UTC Time</h3>
            <p className="mt-1 text-gray-900">
              {formatTimestamp(captureData.timestamps.utc, 'utc')}
            </p>
          </div>

          {/* Uploader Name */}
          <div>
            <h3 className="text-sm font-medium text-gray-500">Attribution</h3>
            <div className="mt-2 space-y-2">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="anonymous"
                  checked={isAnonymous}
                  onChange={(e) => setIsAnonymous(e.target.checked)}
                  className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                />
                <label htmlFor="anonymous" className="ml-2 block text-sm text-gray-900">
                  Stay anonymous
                </label>
              </div>

              {!isAnonymous && (
                <input
                  type="text"
                  value={uploaderName}
                  onChange={(e) => setUploaderName(e.target.value)}
                  placeholder="Enter your name"
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                />
              )}
            </div>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 p-4 rounded-lg">
            <p className="text-red-600">{error}</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex space-x-4">
          <button
            onClick={() => navigate('/capture')}
            className="flex-1 btn btn-secondary"
            disabled={isUploading}
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            className="flex-1 btn btn-primary"
            disabled={isUploading || (!isAnonymous && !uploaderName)}
          >
            {isUploading ? 'Uploading...' : 'Confirm & Upload'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmScreen;
