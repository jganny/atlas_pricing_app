#!/bin/bash
echo "🚀 Preparing deployment to GitHub Pages..."

# Navigate to the workspace
cd "/Users/jganny/.gemini/antigravity/scratch/logistics-pricing-app" || exit

# Push the latest commits
echo "📤 Pushing code to GitHub..."
git push origin main

if [ $? -eq 0 ]; then
  echo "✅ Code successfully pushed to GitHub!"
  echo "👉 Go to: https://github.com/jganny/atlas_pricing_app/settings/pages"
  echo "👉 Under 'Build and deployment', set the Source to 'Deploy from a branch' and select 'main'."
  echo "✨ Once saved, your site will be live at: https://jganny.github.io/atlas_pricing_app/"
else
  echo "❌ Push failed. Please make sure you are logged into GitHub or run: git push origin main manually."
fi
