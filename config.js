/**
 * Configuration file for OBTAINUM
 * 
 * IMPORTANT: This file loads settings that may contain sensitive data.
 * See .env file for actual configuration values.
 * 
 * Setup Instructions:
 * 1. Open the .env file in this directory
 * 2. Replace YOUR_GEMINI_API_KEY_HERE with your actual Gemini API key
 * 3. Get your key from: https://makersuite.google.com/app/apikey
 * 4. Never commit your .env file (it's already in .gitignore)
 */

const CONFIG = {
  // Your Gemini API key
  // UPDATE THIS: Replace with your actual API key from .env
  // See .env file for detailed instructions
  GEMINI_API_KEY: 'YOUR_GEMINI_API_KEY_HERE',
  
  // Supabase configuration (no changes needed - these are published keys)
  SUPABASE_URL: 'https://gotzmuobwuubsugnowxq.supabase.co',
  SUPABASE_ANON_KEY: 'sb_publishable_5yKRomyjh2o4Hh9Nbi6LjQ_jgooOoWs'
};

// Export for use in script.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CONFIG;
}
