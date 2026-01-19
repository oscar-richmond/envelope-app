#!/bin/bash
# Fix all Next.js 16 async params issues

echo "Fixing Next.js 16 async params compatibility..."

# List of files to fix
files=(
  "src/app/api/company/[id]/route.ts"
  "src/app/api/company/[id]/screenshot/route.ts"
  "src/app/api/companies/[id]/email-suggestions/generate/route.ts"
  "src/app/api/companies/[id]/enrichment/route.ts"
  "src/app/api/leads/[id]/scan/route.ts"
)

for file in "${files[@]}"; do
  echo "Processing $file..."
  # Replace sync params with async params
  sed -i '' 's/{ params }: { params: { id: string } }/{ params }: { params: Promise<{ id: string }> }/g' "$file"
  
  # Add await for params access - this is trickier, will need manual review
  # sed -i '' 's/const companyId = parseInt(params\.id/const { id } = await params; const companyId = parseInt(id/g' "$file"
done

echo "Done! Please review changes and add 'await params' where needed."
