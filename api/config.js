// Vercel Serverless Function
// Replaces the local Python server's /config endpoint on Vercel deployment.
// Environment variables (SUPABASE_URL, SUPABASE_KEY) are configured
// in Vercel project settings.

module.exports = function handler(req, res) {
    const supabaseUrl = process.env.SUPABASE_URL || '';
    const supabaseKey = process.env.SUPABASE_KEY || '';

    // Enable CORS for flexibility
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    res.status(200).json({
        SUPABASE_URL: supabaseUrl,
        SUPABASE_KEY: supabaseKey,
    });
};
