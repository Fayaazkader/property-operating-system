#!/bin/bash

# AssetFlow Safe Theme Update
# Preserves bg-black (outer shell), only updates inner components
# Run from project root: bash update-theme-safe.sh

FILES=$(find app components lib -name "*.tsx" -o -name "*.ts" | grep -v node_modules | grep -v .next | grep -v globals.css | grep -v tailwind.config)

for file in $FILES; do
  echo "Updating: $file"
  
  # bg-zinc-900 → bg-secondary (cards, panels)
  sed -i '' 's/bg-zinc-900/bg-\[var\(--bg-secondary\)\]/g' "$file"
  
  # bg-zinc-950 → bg-elevated
  sed -i '' 's/bg-zinc-950/bg-\[var\(--bg-elevated\)\]/g' "$file"
  
  # bg-zinc-800 → bg-elevated (when used for cards/surfaces)
  sed -i '' 's/bg-zinc-800/bg-\[var\(--bg-elevated\)\]/g' "$file"
  
  # border-zinc-800 → border-default
  sed -i '' 's/border-zinc-800/border-\[var\(--border-default\)\]/g' "$file"
  
  # border-zinc-700 → border-hover
  sed -i '' 's/border-zinc-700/border-\[var\(--border-hover\)\]/g' "$file"
  
  # text-white → text-primary (BUT NOT in "text-white ")
  sed -i '' 's/text-white /text-\[var\(--text-primary\)\] /g' "$file"
  
  # text-zinc-300 → text-primary
  sed -i '' 's/text-zinc-300/text-\[var\(--text-primary\)\]/g' "$file"
  
  # text-zinc-400 → text-secondary
  sed -i '' 's/text-zinc-400/text-\[var\(--text-secondary\)\]/g' "$file"
  
  # text-zinc-500 → text-muted
  sed -i '' 's/text-zinc-500/text-\[var\(--text-muted\)\]/g' "$file"
  
  # text-zinc-600 → text-muted
  sed -i '' 's/text-zinc-600/text-\[var\(--text-muted\)\]/g' "$file"
  
  # hover:bg-zinc-900 → hover:bg-elevated
  sed -i '' 's/hover:bg-zinc-900/hover:bg-\[var\(--bg-elevated\)\]/g' "$file"
  
  # hover:bg-zinc-800 → hover:bg-elevated
  sed -i '' 's/hover:bg-zinc-800/hover:bg-\[var\(--bg-elevated\)\]/g' "$file"
  
  # hover:border-zinc-700 → hover:border-hover
  sed -i '' 's/hover:border-zinc-700/hover:border-\[var\(--border-hover\)\]/g' "$file"
  
  # hover:border-zinc-500 → hover:border-hover
  sed -i '' 's/hover:border-zinc-500/hover:border-\[var\(--border-hover\)\]/g' "$file"
  
  # hover:text-white → hover:text-primary
  sed -i '' 's/hover:text-white/hover:text-\[var\(--text-primary\)\]/g' "$file"
  
  # hover:text-zinc-300 → hover:text-primary
  sed -i '' 's/hover:text-zinc-300/hover:text-\[var\(--text-primary\)\]/g' "$file"
  
  # focus:border-zinc-600 → focus:border-hover
  sed -i '' 's/focus:border-zinc-600/focus:border-\[var\(--border-hover\)\]/g' "$file"
  
  # placeholder:text-zinc-600 → placeholder:text-muted
  sed -i '' 's/placeholder:text-zinc-600/placeholder:text-\[var\(--text-muted\)\]/g' "$file"
  
  # border-zinc-800/50 → border-default/50
  sed -i '' 's/border-zinc-800\/50/border-\[var\(--border-default\)\]\/50/g' "$file"
  
  # bg-black/40 stays as-is (outer shell overlay)
  # bg-black stays as-is (outer shell)
  # text-black stays as-is (active states)
  # bg-white stays as-is (active states)
done

# NOW RESTORE THE OUTER SHELL — ensure bg-black is untouched
for file in $FILES; do
  # If the script accidentally changed bg-black to a variable, restore it
  sed -i '' 's/bg-\[var(--bg-secondary)\]/bg-zinc-900/g' "$file" 2>/dev/null
done

echo "Done! Check the pages. bg-black should be preserved."