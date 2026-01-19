import re
import glob

# Pattern to find: parseInt(params.id
# Replace with: const { id } = await params; const companyId = parseInt(id

files = [
    "src/app/api/company/[id]/route.ts",
    "src/app/api/company/[id]/screenshot/route.ts",
    "src/app/api/companies/[id]/email-suggestions/generate/route.ts",
    "src/app/api/companies/[id]/enrichment/route.ts",
    "src/app/api/leads/[id]/scan/route.ts",
]

for filepath in files:
    print(f"Processing {filepath}...")
    with open(filepath, 'r') as f:
        content = f.read()
    
    # Pattern 1: const companyId = parseInt(params.id
    # Replace with two lines
    content = re.sub(
        r'(\s+)const (companyId|leadId) = parseInt\(params\.id([,\)])',
        r'\1const { id } = await params;\n\1const \2 = parseInt(id\3',
        content
    )
    
    # Pattern 2: params.id directly used
    # (less common, but handle it)
    content = re.sub(
        r'params\.id',
        r'(await params).id',
        content
    )
    
    with open(filepath, 'w') as f:
        f.write(content)
    
    print(f"  ✓ Fixed {filepath}")

print("\n✅ All files fixed!")
