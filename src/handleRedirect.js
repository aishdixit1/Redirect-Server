import { isValidHttpUrl } from './isValidHttpUrl.js';
import { trackClickInBackground } from './trackClickInBackground.js';

export function handleRedirect(req, res) {

  // Extract query parameters
  const { redirectLink, broadcast_id, contact_id, button_text } = req.query;

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

  trackClickInBackground({
    broadcastId: broadcast_id,
    contactId: contact_id,
    buttonText: button_text,
  }).catch((err) => {
    console.error('Background tracking failed fatally:', err);
  });

  if (targetUrl) {
    return res.redirect(302, targetUrl);
  }

  return res.status(400).send('Invalid redirect link provided and no fallback URL is configured.');
}
