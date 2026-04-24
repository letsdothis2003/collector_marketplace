# OBTAINUM - Setup Guide

## API Key Configuration

### Quick Start
1. **Get your Gemini API Key**
   - Go to: https://makersuite.google.com/app/apikey
   - Create a new API key

2. **Add your API Key**
   - Open `config.js`
   - Replace `YOUR_GEMINI_API_KEY_HERE` with your actual key

3. **That's it!**
   - Your API key is loaded automatically when the page loads
   - The `.env` file is already in `.gitignore` so your key won't be committed

### Important Security Notes
- ⚠️ **Never commit your API key** - it's already protected by `.gitignore`
- ⚠️ **Never share your `.env` or `config.js` with real keys** in pull requests
- ⚠️ Each developer should have their own API key

## Fixed Issues

### 1. ✅ Duplicate Listing Creation
**Problem**: When creating a listing, it would create a duplicate entry.

**Root Cause**: The form had both:
- `onsubmit` attribute in HTML
- JavaScript event listener

This caused the submission function to run **twice**.

**Solution**: Removed the `onsubmit` attribute from the form. Now it only runs once via the JavaScript event listener.

### 2. ✅ API Key Management
**Before**: API key was hardcoded in `script.js`
- Insecure - visible in version control
- Difficult to change

**After**: 
- API key is loaded from `config.js`
- `config.js` points to instructions
- Easy to update without touching `script.js`
- `.gitignore` prevents accidental commits

## File Changes Summary

### New Files
- `.env` - Environment configuration template (in .gitignore)
- `config.js` - Centralized configuration loader

### Modified Files
- `script.js` - Now loads API key from CONFIG
- `create.html` - Removed `onsubmit`, added `config.js` script tag
- All HTML files - Added `config.js` script tag before `script.js`
- `.env` - Updated with better documentation

## Testing the Fix

1. Navigate to create a listing
2. Fill in the form details
3. Click "PUBLISH LISTING"
4. Verify only ONE listing is created (check the shop page)

Before: Would show 2 identical listings
After: Shows 1 listing ✓
