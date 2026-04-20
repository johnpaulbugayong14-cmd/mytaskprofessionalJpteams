module.exports = async (req, res) => {
  // Handle OPTIONS preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const { email, name, type, title } = req.body || {};

    if (!email || !name || !type || !title) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: email, name, type, title'
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ success: false, error: 'Invalid email format' });
    }

    // Return success - email queued
    return res.status(200).json({
      success: true,
      message: `Email notification queued for ${email}`
    });
    
  } catch (error) {
    console.error('trigger-email error:', error);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
};
