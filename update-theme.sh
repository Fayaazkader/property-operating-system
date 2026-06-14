#!/bin/bash

# AssetFlow Theme Update Script
# Replaces hardcoded Tailwind colors with CSS variables
# Run from project root: bash update-theme.sh

FILES=$(find app components lib -name "*.tsx" -o -name "*.ts" | grep -v node_modules | grep -v .next)

for file in $FILES; do
  echo "Updating: $file"
  
  # Backgrounds
  sed -i '' 's/bg-black/bg-\[var(--bg-primary)\]/g' "$file"
  sed -i '' 's/bg-zinc-900/bg-\[var(--bg-secondary)\]/g' "$file"
  sed -i '' 's/bg-zinc-950/bg-\[var(--bg-elevated)\]/g' "$file"
  sed -i '' 's/bg-zinc-800/bg-\[var(--bg-elevated)\]/g' "$file"
  
  # Borders
  sed -i '' 's/border-zinc-800/border-\[var(--border-default)\]/g' "$file"
  sed -i '' 's/border-zinc-700/border-\[var(--border-hover)\]/g' "$file"
  
  # Text
  sed -i '' 's/text-white/text-\[var(--text-primary)\]/g' "$file"
  sed -i '' 's/text-zinc-300/text-\[var(--text-primary)\]/g' "$file"
  sed -i '' 's/text-zinc-400/text-\[var(--text-secondary)\]/g' "$file"
  sed -i '' 's/text-zinc-500/text-\[var(--text-muted)\]/g' "$file"
  sed -i '' 's/text-zinc-600/text-\[var(--text-muted)\]/g' "$file"
  
  # Hover states
  sed -i '' 's/hover:bg-zinc-900/hover:bg-\[var(--bg-elevated)\]/g' "$file"
  sed -i '' 's/hover:bg-zinc-800/hover:bg-\[var(--bg-elevated)\]/g' "$file"
  sed -i '' 's/hover:border-zinc-700/hover:border-\[var(--border-hover)\]/g' "$file"
  sed -i '' 's/hover:border-zinc-500/hover:border-\[var(--border-hover)\]/g' "$file"
  sed -i '' 's/hover:text-white/hover:text-\[var(--text-primary)\]/g' "$file"
  
  # Focus states
  sed -i '' 's/focus:border-zinc-600/focus:border-\[var(--border-hover)\]/g' "$file"
  sed -i '' 's/focus:border-white/focus:border-\[var(--accent)\]/g' "$file"
  
  # Placeholder
  sed -i '' 's/placeholder:text-zinc-600/placeholder:text-\[var(--text-muted)\]/g' "$file"
  
  # Special: black → primary bg
  sed -i '' 's/bg-black\/40/bg-\[var(--bg-primary)\]\/40/g' "$file"
  
  # Ring
  sed -i '' 's/ring-1 ring-white/ring-1 ring-\[var(--text-primary)\]/g' "$file"
done

echo "Done! All files updated."