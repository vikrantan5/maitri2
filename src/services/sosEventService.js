import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { db } from '../config/firebaseConfig';
import ENV from '../config/env';
import { dispatchEmergencyCase } from './emergencyDispatchService';

const BACKEND_URL = ENV.BACKEND_URL || '';

/**
 * Save SOS event to Firestore for persistent storage AND auto-dispatch
 * the case to the nearest police station + verified officers + admin
 * panel via a parallel write to /emergencyCases.
 *
 * @param {Object} sosResult - The result object from triggerSOS
 * @returns {Promise<string>} Firestore document ID of the sos_events row
 */
export const saveSOSEventToFirestore = async (sosResult) => {
  try {
    const sosEventsRef = collection(db, 'sos_events');

    // Capture the signed-in user so the station/admin dashboards can
    // correlate the SOS to a user record.
    const currentUser = getAuth().currentUser;
    const uid = currentUser?.uid || null;

    const eventData = {
      success: sosResult.success || false,
      // canonical user identity (consumed by web `ensureCaseFromSosEvent`)
      userId: uid,
      user_id: uid,
      userName: sosResult.userName || 'Unknown',
      user_name: sosResult.userName || 'Unknown',
      contactsCount: sosResult.contactsCount || 0,
      timestamp: sosResult.timestamp || new Date().toISOString(),
      createdAt: serverTimestamp(),
      created_at: new Date().toISOString(),

      // Location data
      location: sosResult.location || null,
      locationUrl: sosResult.locationUrl || null,

      // Evidence URLs (both casings for the web normalizer)
      imageUrl: sosResult.imageUrl || null,
      image_url: sosResult.imageUrl || null,
      audioUrl: sosResult.audioUrl || null,
      audio_url: sosResult.audioUrl || null,

      // Status details
      sms: {
        success: sosResult.sms?.success || false,
        sentTo: sosResult.sms?.sentTo || 0,
        error: sosResult.sms?.error || null,
      },
      call: {
        success: sosResult.call?.success || false,
        message: sosResult.call?.message || null,
        error: sosResult.call?.error || null,
      },
      audioRecording: {
        started: sosResult.audioRecording?.started || false,
        captured: sosResult.audioRecording?.captured || false,
        uploaded: sosResult.audioRecording?.uploaded || false,
      },
      photoCapture: sosResult.photoCapture || null,

      // Error info
      imageUploadError: sosResult.imageUploadError || null,
      audioUploadError: sosResult.audioUploadError || null,
    };

    const docRef = await addDoc(sosEventsRef, eventData);
    console.log('SOS event saved to Firestore:', docRef.id);

    // Fire-and-forget: also create the routed emergencyCases doc so the
    // nearest station + verified officers + admin panel get it instantly.
    // We don't await — the SMS/call evidence flow already succeeded; this
    // is the dispatch overlay on top of it.
    dispatchEmergencyCase({
      sourceEventId: docRef.id,
      userId: uid || 'unknown',
      userName: sosResult.userName || 'Unknown',
      userPhone: sosResult.userPhone || '',
      location: sosResult.location || null,
      imageUrl: sosResult.imageUrl || null,
      audioUrl: sosResult.audioUrl || null,
    }).catch((err) =>
      console.error('[sosEventService] dispatchEmergencyCase failed (continuing):', err?.code, err?.message),
    );

    return docRef.id;
  } catch (error) {
    console.error('Failed to save SOS event to Firestore:', error);
    throw error;
  }
};

/**
 * Notify backend API about SOS event
 * @param {Object} payload - SOS event payload for backend
 * @returns {Promise<Object>} Backend response
 */
export const notifyBackend = async (payload) => {
  try {
    if (!BACKEND_URL) {
      console.warn('Backend URL not configured, skipping backend notification');
      return { status: 'skipped', message: 'No backend URL configured' };
    }

    const response = await fetch(`${BACKEND_URL}/api/sos/notify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        user_id: payload.user_id || 'unknown',
        user_name: payload.user_name || 'Unknown',
        latitude: payload.latitude || null,
        longitude: payload.longitude || null,
        location_url: payload.location_url || null,
        image_url: payload.image_url || null,
        audio_url: payload.audio_url || null,
        emergency_contacts: payload.emergency_contacts || [],
        contacts_notified: payload.contacts_notified || 0,
        sms_success: payload.sms_success || false,
        call_success: payload.call_success || false,
        audio_recorded: payload.audio_recorded || false,
        photo_captured: payload.photo_captured || false,
        success: payload.success || false,
        timestamp: payload.timestamp || new Date().toISOString(),
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Backend SOS notify error:', errorText);
      throw new Error(`Backend returned ${response.status}: ${errorText}`);
    }

    const result = await response.json();
    console.log('Backend SOS notification successful:', result);
    return result;
  } catch (error) {
    console.error('Failed to notify backend about SOS event:', error);
    throw error;
  }
};
