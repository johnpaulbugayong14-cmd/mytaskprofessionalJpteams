module.exports = async function handler(req, res) {
  const origin = req.headers.origin;
  const allowedOrigin = origin === 'https://johnpaulbugayong14-cmd.github.io'
    ? origin
    : 'https://johnpaulbugayong14-cmd.github.io';

  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Vary', 'Origin');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { userEmails, title, body, type = 'general' } = req.body;

    if (!userEmails || !Array.isArray(userEmails) || userEmails.length === 0) {
      return res.status(400).json({ error: 'userEmails must be a non-empty array' });
    }

    if (!title || !body) {
      return res.status(400).json({ error: 'title and body are required' });
    }

    const tokens = [];

    // Get FCM tokens for each recipient
    for (const email of userEmails) {
      try {
        const tokenDoc = await getDoc(doc(db, 'fcmTokens', email));
        if (tokenDoc.exists() && tokenDoc.data().token) {
          tokens.push(tokenDoc.data().token);
        } else {
          console.log(`No FCM token found for ${email}`);
        }
      } catch (error) {
        console.error(`Error getting token for ${email}:`, error);
      }
    }

    if (tokens.length === 0) {
      return res.status(200).json({ success: false, message: 'No valid FCM tokens found for recipients' });
    }

    // Send FCM notification using legacy API
    const fcmPayload = {
      registration_ids: tokens,
      notification: {
        title,
        body,
        icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" fill="%233b82f6"/><text x="256" y="280" font-family="Arial, sans-serif" font-size="200" font-weight="bold" text-anchor="middle" fill="white">✓</text></svg>',
        badge: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" fill="%233b82f6"/><text x="256" y="280" font-family="Arial, sans-serif" font-size="200" font-weight="bold" text-anchor="middle" fill="white">✓</text></svg>'
      },
      data: {
        type,
        timestamp: new Date().toISOString()
      }
    };

    const fcmResponse = await fetch('https://fcm.googleapis.com/fcm/send', {
      method: 'POST',
      headers: {
        'Authorization': `key=${process.env.FCM_SERVER_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(fcmPayload)
    });

    const fcmResult = await fcmResponse.json();

    if (fcmResponse.ok) {
      console.log('FCM sent successfully:', fcmResult);
      res.status(200).json({ success: true, result: fcmResult });
    } else {
      console.error('FCM send failed:', fcmResult);
      res.status(500).json({ success: false, error: fcmResult });
    }

  } catch (error) {
    console.error('Error in send-notification:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}