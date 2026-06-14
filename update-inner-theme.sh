#!/bin/bash

# AssetFlow Inner Theme Update
# Only updates inner components — keeps black outer shell (bg-black, bg-black/40)
# Run from project root: bash update-inner-theme.sh

FILES=$(find app components lib -name "*.tsx" -o -name "*.ts" | grep -v node_modules | grep -v .next | grep -v globals.css)

for file in $FILES; do
  echo "Updating: $file"
  
  # Inner card/panel backgrounds (NOT bg-black which is outer shell)
  sed -i '' 's/bg-zinc-900 /bg-\[var\(--bg-secondary\)\] /g' "$file"
  sed -i '' 's/bg-zinc-950/bg-\[var\(--bg-elevated\)\]/g' "$file"
  sed -i '' 's/bg-zinc-800 /bg-\[var\(--bg-elevated\)\] /g' "$file"
  
  # Borders on inner components
  sed -i '' 's/border-zinc-800/border-\[var\(--border-default\)\]/g' "$file"
  sed -i '' 's/border-zinc-700/border-\[var\(--border-hover\)\]/g' "$file"
  
  # Primary text
  sed -i '' 's/text-white /text-\[var\(--text-primary\)\] /g' "$file"
  sed -i '' 's/text-zinc-300/text-\[var\(--text-primary\)\]/g' "$file"
  
  # Secondary text
  sed -i '' 's/text-zinc-400/text-\[var\(--text-secondary\)\]/g' "$file"
  
  # Muted text
  sed -i '' 's/text-zinc-500/text-\[var\(--text-muted\)\]/g' "$file"
  sed -i '' 's/text-zinc-600/text-\[var\(--text-muted\)\]/g' "$file"
  
  # Hover states for inner components
  sed -i '' 's/hover:bg-zinc-900/hover:bg-\[var\(--bg-elevated\)\]/g' "$file"
  sed -i '' 's/hover:bg-zinc-800/hover:bg-\[var\(--bg-elevated\)\]/g' "$file"
  sed -i '' 's/hover:border-zinc-700/hover:border-\[var\(--border-hover\)\]/g' "$file"
  sed -i '' 's/hover:border-zinc-500/hover:border-\[var\(--border-hover\)\]/g' "$file"
  sed -i '' 's/hover:text-white/hover:text-\[var\(--text-primary\)\]/g' "$file"
  
  # Focus states
  sed -i '' 's/focus:border-zinc-600/focus:border-\[var\(--border-hover\)\]/g' "$file"
  sed -i '' 's/focus:border-white/focus:border-\[var\(--accent\)\]/g' "$file"
  
  # Placeholder text
  sed -i '' 's/placeholder:text-zinc-600/placeholder:text-\[var\(--text-muted\)\]/g' "$file"
  
  # Dividers
  sed -i '' 's/border-zinc-800\/50/border-\[var\(--border-default\)\]\/50/g' "$file"
  
  # Keep black explicitly untouched — these are outer shell
  # bg-black, bg-black/40, bg-black/20 stay as-is
done

echo "Done! All inner components updated. Black outer shell preserved."