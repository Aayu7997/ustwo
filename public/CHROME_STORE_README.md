# UsTwo Chrome Extension - Chrome Web Store Submission Guide

## Extension Overview
**Name:** UsTwo - Watch Together  
**Version:** 1.0.0  
**Category:** Social & Communication / Entertainment

## Description for Chrome Web Store

### Short Description (132 characters max)
Watch videos together with your partner in perfect sync across Netflix, Prime, YouTube, Vimeo, and more streaming platforms!

### Detailed Description
UsTwo is the ultimate companion app for couples who want to watch their favorite shows and movies together, even when apart. Our Chrome extension seamlessly syncs video playback across multiple streaming platforms, making long-distance movie nights feel like you're sitting on the same couch.

**✨ Key Features:**
• **Perfect Sync** - Automatically synchronizes play, pause, and seek across devices
• **Multi-Platform Support** - Works with Netflix, Prime Video, Disney+, YouTube, Vimeo, Hulu, HBO Max, Hotstar, Crunchyroll, and more
• **Video Chat Integration** - Built-in HD video calling to see your partner's reactions
• **AI-Powered Recommendations** - Smart suggestions based on both partners' preferences
• **Watch Together** - Share your screen or upload files to watch anything together
• **Real-Time Sync** - Lightning-fast synchronization with minimal delay
• **Private & Secure** - Your viewing data stays private with end-to-end encryption

**💕 Perfect For:**
- Long-distance couples
- Friends watching together remotely
- Family movie nights across different locations
- Virtual watch parties

**🎬 Supported Platforms:**
Netflix, Prime Video, Disney+, YouTube, Vimeo, Hulu, HBO Max, Disney+ Hotstar, Crunchyroll, and more!

**How It Works:**
1. Install the extension
2. Visit ustwo.lovable.app to create a room
3. Share your unique room code with your partner
4. Start watching - playback syncs automatically!

**Privacy & Security:**
We take your privacy seriously. UsTwo only accesses video players on supported streaming platforms and never collects or stores your viewing history or personal data without your consent.

## Required Assets

### Screenshots (1280x800 or 640x400)
Prepare 5 screenshots showing:
1. Main web app interface with video player
2. AI recommendations feature
3. Video call in picture-in-picture mode
4. Calendar and planning features
5. Chrome extension popup showing sync status

### Promotional Images
- **Small Promo Tile:** 440x280 pixels
- **Large Promo Tile:** 920x680 pixels  
- **Marquee Promo Tile:** 1400x560 pixels

### Store Listing Icon
- **128x128 pixels** - Main store icon

## Submission Checklist

### Before Submitting:
- [ ] Create high-quality icons (16px, 32px, 48px, 128px)
- [ ] Test on Chrome, Edge, and other Chromium browsers
- [ ] Prepare 5 screenshots demonstrating key features
- [ ] Create promotional graphics (Small, Large, Marquee tiles)
- [ ] Write privacy policy URL (required for Chrome Web Store)
- [ ] Set up support email address
- [ ] Create demo video (recommended)
- [ ] Test with multiple streaming platforms
- [ ] Verify all permissions are necessary and documented
- [ ] Review content security policy

### Required Information:
- **Developer Email:** your-email@example.com
- **Support URL:** https://ustwo.lovable.app/support (create this page)
- **Privacy Policy URL:** https://ustwo.lovable.app/privacy (create this page)
- **Homepage URL:** https://ustwo.lovable.app

### Pricing & Distribution:
- **Price:** Free
- **Countries:** All countries (or specific ones)
- **Mature Content:** No

## Files to Package

Create a ZIP file containing ONLY these files from the `public/` directory:
```
manifest-v3.json (rename to manifest.json in the ZIP)
background.js
content-script.js
popup.html
popup.js
popup.css (if separate from popup.html)
icon-16.png
icon-32.png
icon-48.png
icon-128.png
```

**Important:** Do NOT include:
- Source maps
- Development files
- README files
- Any files not listed in manifest.json

## Packaging Instructions

1. **Create Icons:**
   - Generate 16x16, 32x32, 48x48, and 128x128 PNG icons
   - Use a consistent design across all sizes
   - Ensure transparency where appropriate
   - Icons should represent couples/hearts/video themes

2. **Update manifest.json:**
   - Replace "favicon.ico" references with actual icon files
   - Verify all URLs point to production (mxatgocmnasozbkbjiuq.supabase.co)
   - Test that all permissions are necessary

3. **Create ZIP Package:**
   ```bash
   # From the public directory
   zip -r ustwo-extension-v1.0.0.zip \
     manifest.json \
     background.js \
     content-script.js \
     popup.html \
     popup.js \
     icon-16.png \
     icon-32.png \
     icon-48.png \
     icon-128.png
   ```

4. **Test the ZIP:**
   - Load unpacked in Chrome (chrome://extensions)
   - Test on all supported streaming platforms
   - Verify popup works correctly
   - Check that sync functionality works
   - Test with a partner on a different device

## Submission Steps

1. **Google Chrome Developer Account**
   - Go to: https://chrome.google.com/webstore/devconsole
   - Pay one-time $5 developer registration fee
   - Verify your email

2. **Upload Extension**
   - Click "New Item"
   - Upload your ZIP file
   - Fill in all required fields

3. **Store Listing**
   - Add detailed description
   - Upload screenshots (minimum 1, recommended 5)
   - Add promotional images
   - Set category: Social & Communication
   - Add language support

4. **Privacy & Compliance**
   - Create and link privacy policy
   - Declare permission usage
   - Submit for review

5. **Review Process**
   - Typically takes 1-3 business days
   - Check email for review status
   - Address any feedback from reviewers

## Privacy Policy Requirements

Your privacy policy must explain:
- What data you collect (room codes, user preferences, etc.)
- How data is used (sync functionality, recommendations)
- How data is shared (only with room partners)
- Data retention policies
- User rights and controls
- Contact information for privacy concerns

## Support Resources

Create these pages before submitting:
1. **Privacy Policy:** https://ustwo.lovable.app/privacy
2. **Support Page:** https://ustwo.lovable.app/support
3. **Terms of Service:** https://ustwo.lovable.app/terms

## Post-Submission

After approval:
- Monitor user reviews and ratings
- Respond to user feedback
- Track installations and usage
- Plan updates and improvements
- Maintain compatibility with platform updates

## Update Process

For future updates:
1. Increment version number in manifest.json
2. Document changes in release notes
3. Create new ZIP package
4. Upload to Chrome Web Store
5. Submit for review

## Common Rejection Reasons

Avoid these issues:
- ❌ Unnecessary permissions
- ❌ Missing privacy policy
- ❌ Poor quality screenshots
- ❌ Misleading description
- ❌ Broken functionality
- ❌ Copyright violations in name/icons
- ❌ Unclear permission usage explanations

## Testing Checklist

Before submission, test:
- [ ] Extension loads without errors
- [ ] Popup displays correctly
- [ ] Content scripts inject properly
- [ ] Sync works on Netflix
- [ ] Sync works on YouTube
- [ ] Sync works on Prime Video
- [ ] Sync works on Vimeo
- [ ] Background service worker functions
- [ ] Room codes connect properly
- [ ] No console errors
- [ ] Works in incognito mode (if applicable)
- [ ] Permissions are all used and necessary

## Need Help?

- Chrome Web Store Developer Docs: https://developer.chrome.com/docs/webstore/
- Extension Development: https://developer.chrome.com/docs/extensions/
- Support: developer-support@google.com

Good luck with your submission! 🚀