import { db } from '../../config/db.js';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * GET /api/clicks/broadcast/:broadcast_id
 * Returns total clicks for a broadcast and a list of contacts who clicked.
 */
export async function getBroadcastClicks(req, res) {
  const { broadcast_id } = req.params;

  if (!broadcast_id || !UUID_REGEX.test(broadcast_id)) {
    return res.status(400).json({ error: 'Invalid broadcast_id format. Must be a valid UUID.' });
  }

  try {
    // 1. Verify broadcast existence
    const broadcastCheck = await db.query(
      'SELECT broadcast_id, name FROM broadcasts WHERE broadcast_id = $1',
      [broadcast_id]
    );

    if (broadcastCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Broadcast not found.' });
    }

    // 2. Count total clicks for this broadcast
    const clicksCountRes = await db.query(
      'SELECT COUNT(*)::int AS total_clicks FROM clicks WHERE broadcast_id = $1',
      [broadcast_id]
    );
    const total_clicks = clicksCountRes.rows[0]?.total_clicks || 0;

    // 3. Get distinct contacts who clicked this broadcast
    const contactsRes = await db.query(
      `SELECT DISTINCT ON (c.contact_id)
         c.contact_id,
         TRIM(CONCAT(c.first_name, ' ', c.last_name)) AS name,
         c.phone_number
       FROM clicks cl
       JOIN contacts c ON cl.contact_id = c.contact_id
       WHERE cl.broadcast_id = $1`,
      [broadcast_id]
    );

    const contacts = contactsRes.rows.map((row) => ({
      contact_id: row.contact_id,
      name: row.name || [row.first_name, row.last_name].filter(Boolean).join(' ') || 'Unknown',
      phone_number: row.phone_number || ''
    }));

    return res.status(200).json({
      total_clicks,
      contacts,
    });
  } catch (error) {
    console.error('Error fetching broadcast clicks:', error);
    return res.status(500).json({ error: 'Internal server error while fetching broadcast click analytics.' });
  }
}

/**
 * GET /api/clicks/contact/:contact_id
 * Returns total clicks for a contact and a list of broadcasts from which they clicked.
 */
export async function getContactClicks(req, res) {
  const { contact_id } = req.params;

  if (!contact_id || !UUID_REGEX.test(contact_id)) {
    return res.status(400).json({ error: 'Invalid contact_id format. Must be a valid UUID.' });
  }

  try {
    // 1. Verify contact existence
    const contactCheck = await db.query(
      'SELECT contact_id FROM contacts WHERE contact_id = $1',
      [contact_id]
    );

    if (contactCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Contact not found.' });
    }

    // 2. Count total clicks for this contact
    const clicksCountRes = await db.query(
      'SELECT COUNT(*)::int AS total_clicks FROM clicks WHERE contact_id = $1',
      [contact_id]
    );
    const total_clicks = clicksCountRes.rows[0]?.total_clicks || 0;

    // 3. Get distinct broadcasts from where this contact clicked
    const broadcastsRes = await db.query(
      `SELECT DISTINCT ON (b.broadcast_id)
         b.broadcast_id,
         b.name AS broadcast_name
       FROM clicks cl
       JOIN broadcasts b ON cl.broadcast_id = b.broadcast_id
       WHERE cl.contact_id = $1`,
      [contact_id]
    );

    const broadcasts = broadcastsRes.rows.map((row) => ({
      broadcast_id: row.broadcast_id,
      broadcast_name: row.broadcast_name || 'Unnamed Broadcast'
    }));

    return res.status(200).json({
      total_clicks,
      broadcasts,
    });
  } catch (error) {
    console.error('Error fetching contact clicks:', error);
    return res.status(500).json({ error: 'Internal server error while fetching contact click analytics.' });
  }
}
