import { db } from "../config/db.js";
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function trackClickInBackground({
  broadcastId,
  contactId,
  buttonText,
}) {
  if (
    !broadcastId ||
    !contactId ||
    !UUID_REGEX.test(broadcastId) ||
    !UUID_REGEX.test(contactId)
  ) {
    console.warn("Invalid or missing UUIDs for tracking. Skipping insert.");
    return;
  }

  const client = await db.getClient();

  try {
    await client.query("BEGIN");

    // Validate IDs in a single query
    const validationQuery = `
      SELECT 
        (SELECT EXISTS(SELECT 1 FROM broadcasts WHERE broadcast_id = $1)) as valid_broadcast,
        (SELECT EXISTS(SELECT 1 FROM contacts WHERE contact_id = $2)) as valid_contact;
    `;

    const { rows } = await client.query(validationQuery, [
      broadcastId,
      contactId,
    ]);
    const { valid_broadcast, valid_contact } = rows[0];

    if (!valid_broadcast || !valid_contact) {
      console.warn(
        `Validation failed. Broadcast valid: ${valid_broadcast}, Contact valid: ${valid_contact}`,
      );
      await client.query("ROLLBACK");
      return; // Exit silently; the user was already redirected
    }

    // Insert the Click
    const insertQuery = `
      INSERT INTO clicks (broadcast_id, contact_id, button_clicked) 
      VALUES ($1, $2, $3)
    `;

    // Decode button text just in case the URL encoded it (e.g., %20 for spaces)
    const decodedButtonText = buttonText
      ? decodeURIComponent(buttonText)
      : "Unknown";

    await client.query(insertQuery, [
      broadcastId,
      contactId,
      decodedButtonText,
    ]);

    // await client.query(
    //   `
    //     UPDATE broadcasts
    //     SET button_clicks = COALESCE(button_clicks, 0) + 1
    //     WHERE broadcast_id = $1
    //   `,
    //   [broadcastId],
    // );

    await client.query("COMMIT");

    console.log(
      `Click logged for Contact: ${contactId} | Broadcast: ${broadcastId}`,
    );
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Database error during async click tracking:", error.message);
  } finally {
    // Release the client back to the pool
    client.release();
  }
}
