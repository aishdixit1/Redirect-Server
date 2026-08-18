import { isValidHttpUrl } from './isValidHttpUrl.js';
import { trackClickInBackground } from './trackClickInBackground.js';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Parses the `data` parameter to extract broadcastId and contactId.
 * Expected format: "${broadcastId}_${contactId}" or "{${broadcastId}_${contactId}}"
 *
 * @param {string} data
 * @returns {{ broadcastId: string|null, contactId: string|null }}
 */
export function parseDataParam(data) {
  if (!data || typeof data !== 'string') {
    return { broadcastId: null, contactId: null };
  }

  // Remove any curly braces and whitespace
  const cleaned = data.replace(/[\{\}]/g, '').trim();
  const parts = cleaned.split('_');

  if (parts.length >= 2) {
    const broadcastId = parts[0].trim();
    const contactId = parts[1].trim();

    if (UUID_REGEX.test(broadcastId) && UUID_REGEX.test(contactId)) {
      return { broadcastId, contactId };
    }
  }

  return { broadcastId: null, contactId: null };
}

export function handleRedirect(req, res) {

  // Extract query parameters
  const { redirectLink, button_text, data } = req.query;

  // Extract broadcastId and contactId from data param if available, fallback to individual query params
  const { broadcastId: dataBroadcastId, contactId: dataContactId } = parseDataParam(data);
  const broadcastId = dataBroadcastId;
  const contactId = dataContactId;
  const buttonText = button_text;

  const fallbackUrl = process.env.DEFAULT_FALLBACK_URL;

  const isRedirectLinkValid = isValidHttpUrl(redirectLink);

  const targetUrl = isRedirectLinkValid ? redirectLink : fallbackUrl;

  if (!isRedirectLinkValid) {
    if (fallbackUrl) {
      console.log(`Invalid redirect link provided. Redirecting to fallback URL: ${fallbackUrl}`);
    } else {
      console.log('Invalid redirect link provided. No fallback URL configured; tracking will still run.');
    }
  }

  // Track the click in the background without blocking the response
  trackClickInBackground({
    broadcastId,
    contactId,
    buttonText,
  }).catch((err) => {
    console.error('Background tracking failed fatally:', err);
  });

  if (targetUrl) {
    return res.redirect(302, targetUrl);
  }

  return res.status(400).send('Invalid redirect link provided and no fallback URL is configured.');
}

