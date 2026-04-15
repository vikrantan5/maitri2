
import { Platform } from 'react-native';
import ENV from '../config/env';

// Cloudinary config
const CLOUDINARY_CLOUD_NAME = ENV.CLOUDINARY_CLOUD_NAME || 'dbs5egjdh';
const CLOUDINARY_API_KEY = ENV.CLOUDINARY_API_KEY || '362385782258242';
const CLOUDINARY_API_SECRET = ENV.CLOUDINARY_API_SECRET || 'cRUaZya5wnbEupFmUKiIm3Gdpv8';

// Backend URL for server-side uploads
const BACKEND_URL = ENV.BACKEND_URL || '';

/**
 * Simple SHA-1 hash implementation for React Native (no crypto module).
 * Used to generate Cloudinary upload signatures client-side.
 */
const sha1 = (message) => {
  const rotateLeft = (n, s) => (n << s) | (n >>> (32 - s));

  const cvtHex = (val) => {
    let str = '';
    for (let i = 7; i >= 0; i--) {
      const v = (val >>> (i * 4)) & 0x0f;
      str += v.toString(16);
    }
    return str;
  };

  let blockstart;
  const W = new Array(80);
  let H0 = 0x67452301;
  let H1 = 0xEFCDAB89;
  let H2 = 0x98BADCFE;
  let H3 = 0x10325476;
  let H4 = 0xC3D2E1F0;

  // UTF-8 encode
  const msgUtf8 = unescape(encodeURIComponent(message));
  const msgLength = msgUtf8.length;
  const wordArray = [];

  for (let i = 0; i < msgLength - 3; i += 4) {
    wordArray.push(
      (msgUtf8.charCodeAt(i) << 24) |
      (msgUtf8.charCodeAt(i + 1) << 16) |
      (msgUtf8.charCodeAt(i + 2) << 8) |
      msgUtf8.charCodeAt(i + 3)
    );
  }

  const remaining = msgLength % 4;
  if (remaining === 0) {
    wordArray.push(0x080000000);
  } else if (remaining === 1) {
    wordArray.push((msgUtf8.charCodeAt(msgLength - 1) << 24) | 0x0800000);
  } else if (remaining === 2) {
    wordArray.push(
      (msgUtf8.charCodeAt(msgLength - 2) << 24) |
      (msgUtf8.charCodeAt(msgLength - 1) << 16) |
      0x08000
    );
  } else if (remaining === 3) {
    wordArray.push(
      (msgUtf8.charCodeAt(msgLength - 3) << 24) |
      (msgUtf8.charCodeAt(msgLength - 2) << 16) |
      (msgUtf8.charCodeAt(msgLength - 1) << 8) |
      0x80
    );
  }

  while (wordArray.length % 16 !== 14) {
    wordArray.push(0);
  }

  wordArray.push(msgLength >>> 29);
  wordArray.push((msgLength << 3) & 0x0ffffffff);

  for (blockstart = 0; blockstart < wordArray.length; blockstart += 16) {
    for (let i = 0; i < 16; i++) {
      W[i] = wordArray[blockstart + i];
    }
    for (let i = 16; i <= 79; i++) {
      W[i] = rotateLeft(W[i - 3] ^ W[i - 8] ^ W[i - 14] ^ W[i - 16], 1);
    }

    let A = H0, B = H1, C = H2, D = H3, E = H4;
    let temp;

    for (let i = 0; i <= 19; i++) {
      temp = (rotateLeft(A, 5) + ((B & C) | (~B & D)) + E + W[i] + 0x5A827999) & 0x0ffffffff;
      E = D; D = C; C = rotateLeft(B, 30); B = A; A = temp;
    }
    for (let i = 20; i <= 39; i++) {
      temp = (rotateLeft(A, 5) + (B ^ C ^ D) + E + W[i] + 0x6ED9EBA1) & 0x0ffffffff;
      E = D; D = C; C = rotateLeft(B, 30); B = A; A = temp;
    }
    for (let i = 40; i <= 59; i++) {
      temp = (rotateLeft(A, 5) + ((B & C) | (B & D) | (C & D)) + E + W[i] + 0x8F1BBCDC) & 0x0ffffffff;
      E = D; D = C; C = rotateLeft(B, 30); B = A; A = temp;
    }
    for (let i = 60; i <= 79; i++) {
      temp = (rotateLeft(A, 5) + (B ^ C ^ D) + E + W[i] + 0xCA62C1D6) & 0x0ffffffff;
      E = D; D = C; C = rotateLeft(B, 30); B = A; A = temp;
    }

    H0 = (H0 + A) & 0x0ffffffff;
    H1 = (H1 + B) & 0x0ffffffff;
    H2 = (H2 + C) & 0x0ffffffff;
    H3 = (H3 + D) & 0x0ffffffff;
    H4 = (H4 + E) & 0x0ffffffff;
  }

  return (cvtHex(H0) + cvtHex(H1) + cvtHex(H2) + cvtHex(H3) + cvtHex(H4)).toLowerCase();
};

/**
 * Generate Cloudinary signature client-side.
 * This is used when the backend is unreachable.
 */
const generateClientSignature = (params, apiSecret) => {
  // Sort params alphabetically and create the string to sign
  const sortedKeys = Object.keys(params).sort();
  const stringToSign = sortedKeys
    .map(key => `${key}=${params[key]}`)
    .join('&');
  return sha1(stringToSign + apiSecret);
};

/**
 * XMLHttpRequest-based file upload that works with React Native FormData.
 * This bypasses Expo's custom fetch which doesn't support {uri, type, name} FormData parts.
 */
const xhrUpload = (url, formData, headers = {}, timeoutMs = 60000) => {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url);

    // Set headers
    Object.keys(headers).forEach(key => {
      xhr.setRequestHeader(key, headers[key]);
    });

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const response = JSON.parse(xhr.responseText);
          resolve(response);
        } catch (e) {
          resolve(xhr.responseText);
        }
      } else {
        reject(new Error(`Upload failed with status ${xhr.status}: ${xhr.responseText}`));
      }
    };

    xhr.onerror = () => {
      reject(new Error('Network error during upload'));
    };

    xhr.ontimeout = () => {
      reject(new Error('Upload timed out'));
    };

    xhr.timeout = timeoutMs;
    xhr.send(formData);
  });
};

/**
 * Get a signed upload signature from the backend.
 * This allows authenticated uploads directly to Cloudinary without exposing API secret.
 */
const getSignedUploadParams = async (folder, resourceType) => {
  try {
    if (!BACKEND_URL) return null;

    const response = await fetch(`${BACKEND_URL}/api/sos/sign-upload`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({ folder, resource_type: resourceType }),
    });

    if (!response.ok) return null;
    return await response.json();
  } catch (error) {
    console.warn('Failed to get signed upload params from backend:', error.message);
    return null;
  }
};

/**
 * Generate signed upload params locally (client-side fallback).
 * Used when the backend is unreachable.
 */
const generateLocalSignedParams = (folder) => {
  const timestamp = Math.floor(Date.now() / 1000);
  const paramsToSign = {
    folder: folder,
    timestamp: timestamp,
  };
  const signature = generateClientSignature(paramsToSign, CLOUDINARY_API_SECRET);

  return {
    signature,
    timestamp,
    api_key: CLOUDINARY_API_KEY,
    cloud_name: CLOUDINARY_CLOUD_NAME,
    folder,
  };
};

/**
 * Upload a file directly to Cloudinary using XMLHttpRequest with SIGNED upload.
 * Uses backend signing first, falls back to client-side signing.
 * @param {string} fileUri - Local file URI
 * @param {string} resourceType - 'image', 'video' (audio uses 'video'), or 'raw'
 * @param {string} folder - Cloudinary folder path
 * @returns {Promise<Object>} Upload result with secure_url
 */
export const uploadToCloudinary = async (fileUri, resourceType = 'image', folder = 'sos') => {
  try {
    if (!fileUri) {
      throw new Error('No file URI provided');
    }

    const cloudName = CLOUDINARY_CLOUD_NAME;
    const uploadUrl = `https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`;

    // Determine file extension and mime type
    let fileName = fileUri.split('/').pop() || 'file';
    let fileType = 'application/octet-stream';

    if (resourceType === 'image') {
      fileType = 'image/jpeg';
      if (!fileName.includes('.')) fileName += '.jpg';
    } else if (resourceType === 'video') {
      fileType = 'audio/m4a';
      if (!fileName.includes('.')) fileName += '.m4a';
    }

    // Build form data using React Native compatible format
    const formData = new FormData();

    formData.append('file', {
      uri: Platform.OS === 'android' ? fileUri : fileUri.replace('file://', ''),
      type: fileType,
      name: fileName,
    });

    // Try backend signed upload first
    let signedParams = await getSignedUploadParams(folder, resourceType);

    // If backend is unreachable, generate signature client-side
    if (!signedParams) {
      console.log('Backend unreachable, generating client-side signature...');
      signedParams = generateLocalSignedParams(folder);
    }

    // Always use signed upload (no unsigned preset needed)
    formData.append('signature', signedParams.signature);
    formData.append('timestamp', String(signedParams.timestamp));
    formData.append('api_key', signedParams.api_key);
    formData.append('folder', folder);
    console.log(`Using signed Cloudinary upload for ${resourceType}`);

    // Use XMLHttpRequest instead of fetch to avoid Expo's FormData issues
    const timeout = resourceType === 'image' ? 120000 : 60000;
    const result = await xhrUpload(uploadUrl, formData, {
      'Accept': 'application/json',
    }, timeout);

    console.log(`Cloudinary ${resourceType} upload success:`, result.secure_url);

    return {
      url: result.secure_url,
      publicId: result.public_id,
      resourceType: result.resource_type,
      format: result.format,
      bytes: result.bytes,
    };
  } catch (error) {
    console.error(`Cloudinary ${resourceType} upload failed:`, error);
    throw error;
  }
};

/**
 * Upload file via backend server using XMLHttpRequest (FormData with file URI)
 * Primary upload method - routes through backend for reliability
 * @param {string} fileUri - Local file URI
 * @param {string} fileType - 'image' or 'audio'
 * @param {string} userId - User ID
 * @returns {Promise<string>} URL of uploaded file
 */
const uploadViaBackend = async (fileUri, fileType, userId) => {
  if (!BACKEND_URL) {
    throw new Error('Backend URL not configured');
  }

  const formData = new FormData();
  formData.append('user_id', userId);

  const fileName = fileUri.split('/').pop() || 'file';
  const uri = Platform.OS === 'android' ? fileUri : fileUri.replace('file://', '');

  if (fileType === 'image') {
    formData.append('image_file', {
      uri: uri,
      type: 'image/jpeg',
      name: fileName,
    });
  } else {
    formData.append('audio_file', {
      uri: uri,
      type: 'audio/m4a',
      name: fileName,
    });
  }

  // Use XHR instead of fetch to avoid Expo's FormData issue
  const timeout = fileType === 'image' ? 120000 : 60000;
  const result = await xhrUpload(`${BACKEND_URL}/api/sos/upload`, formData, {
    'Accept': 'application/json',
  }, timeout);

  return fileType === 'image' ? result.image_url : result.audio_url;
};

/**
 * Read a local file URI as base64 string using XMLHttpRequest (binary).
 * This is the most reliable way in React Native - avoids blob/FileReader issues.
 * @param {string} fileUri - Local file URI (file:///...)
 * @returns {Promise<string>} Base64 encoded string
 */
const readFileAsBase64 = (fileUri) => {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('GET', fileUri, true);
    xhr.responseType = 'arraybuffer';

    xhr.onload = () => {
      if (xhr.status === 200 || xhr.status === 0) {
        try {
          const bytes = new Uint8Array(xhr.response);
          let binary = '';
          const chunkSize = 8192;
          for (let i = 0; i < bytes.length; i += chunkSize) {
            const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
            binary += String.fromCharCode.apply(null, chunk);
          }
          const base64 = btoa(binary);
          resolve(base64);
        } catch (e) {
          reject(new Error(`Base64 encoding failed: ${e.message}`));
        }
      } else {
        reject(new Error(`Failed to read file: status ${xhr.status}`));
      }
    };

    xhr.onerror = () => {
      reject(new Error('XHR error reading file'));
    };

    xhr.ontimeout = () => {
      reject(new Error('File read timed out'));
    };

    xhr.timeout = 30000;
    xhr.send();
  });
};

/**
 * Upload file via backend using base64 encoding (reliable fallback)
 * Uses XHR to read file as binary, then base64 encodes it
 * @param {string} fileUri - Local file URI
 * @param {string} fileType - 'image' or 'audio'
 * @param {string} userId - User ID
 * @returns {Promise<string>} URL of uploaded file
 */
const uploadViaBackendBase64 = async (fileUri, fileType, userId) => {
  if (!BACKEND_URL) {
    throw new Error('Backend URL not configured');
  }

  // Read file as base64 using XHR (avoids blob/ArrayBuffer issues)
  const base64Data = await readFileAsBase64(fileUri);

  const fileName = fileUri.split('/').pop() || 'file';

  const payload = {
    user_id: userId,
  };

  if (fileType === 'image') {
    payload.image_base64 = base64Data;
    payload.image_filename = fileName;
  } else {
    payload.audio_base64 = base64Data;
    payload.audio_filename = fileName;
  }

  // Use XHR with JSON body (no FormData - avoids the Expo issue entirely)
  const jsonBody = JSON.stringify(payload);

  const result = await new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${BACKEND_URL}/api/sos/upload-base64`);
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.setRequestHeader('Accept', 'application/json');

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText));
        } catch (e) {
          reject(new Error('Invalid JSON response from server'));
        }
      } else {
        reject(new Error(`Base64 upload failed: ${xhr.status} - ${xhr.responseText}`));
      }
    };

    xhr.onerror = () => reject(new Error('Network error during base64 upload'));
    xhr.ontimeout = () => reject(new Error('Base64 upload timed out'));
    xhr.timeout = 120000; // 2 min timeout for large base64 payloads
    xhr.send(jsonBody);
  });

  return fileType === 'image' ? result.image_url : result.audio_url;
};

/**
 * Upload SOS image with 3-tier fallback:
 * 1. Direct Cloudinary via XHR FormData with SIGNED upload (client-side signature if backend unreachable)
 * 2. Backend via XHR FormData (server-side upload)
 * 3. Backend via base64 JSON (ultimate fallback)
 */
export const uploadSOSImageToCloudinary = async (imageUri, userId = 'unknown') => {
  // Tier 1: Try direct Cloudinary upload via XHR with signed params
  try {
    console.log('Attempting direct Cloudinary image upload (signed XHR)...');
    const result = await uploadToCloudinary(imageUri, 'image', `sos/images/${userId}`);
    if (result.url) {
      console.log('Image uploaded directly to Cloudinary:', result.url);
      return result.url;
    }
  } catch (error) {
    console.warn('Direct Cloudinary image upload failed:', error.message);
  }

  // Tier 2: Try backend upload via XHR
  try {
    console.log('Attempting image upload via backend (XHR)...');
    const url = await uploadViaBackend(imageUri, 'image', userId);
    if (url) {
      console.log('Image uploaded via backend:', url);
      return url;
    }
  } catch (error) {
    console.warn('Backend XHR image upload failed:', error.message);
  }

  // Tier 3: Try base64 upload via backend
  try {
    console.log('Attempting image upload via backend (base64)...');
    const url = await uploadViaBackendBase64(imageUri, 'image', userId);
    if (url) {
      console.log('Image uploaded via backend base64:', url);
      return url;
    }
  } catch (error) {
    console.error('All image upload methods failed:', error.message);
    throw new Error('Failed to upload image after all retry attempts');
  }
};

/**
 * Upload SOS audio with 3-tier fallback
 */
export const uploadSOSAudioToCloudinary = async (audioUri, userId = 'unknown') => {
  // Tier 1: Try direct Cloudinary upload via XHR (signed upload)
  try {
    console.log('Attempting direct Cloudinary audio upload (signed XHR)...');
    const result = await uploadToCloudinary(audioUri, 'video', `sos/audio/${userId}`);
    if (result.url) {
      console.log('Audio uploaded directly to Cloudinary:', result.url);
      return result.url;
    }
  } catch (error) {
    console.warn('Direct Cloudinary audio upload failed:', error.message);
  }

  // Tier 2: Try backend upload via XHR
  try {
    console.log('Attempting audio upload via backend (XHR)...');
    const url = await uploadViaBackend(audioUri, 'audio', userId);
    if (url) {
      console.log('Audio uploaded via backend:', url);
      return url;
    }
  } catch (error) {
    console.warn('Backend XHR audio upload failed:', error.message);
  }

  // Tier 3: Try base64 upload via backend
  try {
    console.log('Attempting audio upload via backend (base64)...');
    const url = await uploadViaBackendBase64(audioUri, 'audio', userId);
    if (url) {
      console.log('Audio uploaded via backend base64:', url);
      return url;
    }
  } catch (error) {
    console.error('All audio upload methods failed:', error.message);
    throw new Error('Failed to upload audio after all retry attempts');
  }
};

/**
 * Upload all SOS files in parallel (optimized for speed)
 * @param {Object} params - { imageUri, audioUri, userId }
 * @returns {Promise<Object>} { imageUrl, audioUrl }
 */
export const uploadAllSOSFiles = async ({ imageUri, audioUri, userId }) => {
  const uploads = [];
  let imageUrl = null;
  let audioUrl = null;

  if (imageUri) {
    uploads.push(
      uploadSOSImageToCloudinary(imageUri, userId)
        .then(url => { imageUrl = url; })
        .catch(err => { console.error('Image upload error:', err.message); })
    );
  }

  if (audioUri) {
    uploads.push(
      uploadSOSAudioToCloudinary(audioUri, userId)
        .then(url => { audioUrl = url; })
        .catch(err => { console.error('Audio upload error:', err.message); })
    );
  }

  await Promise.allSettled(uploads);

  return { imageUrl, audioUrl };
};
