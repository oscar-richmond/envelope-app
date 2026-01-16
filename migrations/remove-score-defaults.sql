-- Data Migration: Remove score=0 defaults for unscanned companies
-- Run this AFTER schema migration completes

-- 1. CompanyProspect: Set stalenessScore=null for unscanned companies
UPDATE "CompanyProspect"
SET "stalenessScore" = NULL
WHERE "stalenessScore" = 0
  AND "lastAnalysedAt" IS NULL
  AND "websiteHealthStatus" IS NULL;

-- 2. CompanyProspect: Set financialActivityScore=null for unchecked companies
UPDATE "CompanyProspect"
SET "financialActivityScore" = NULL
WHERE "financialActivityScore" = 0
  AND "financialLastCheckedAt" IS NULL;

-- 3. CompanyProspect: Set contactPriorityScore=null for uncalculated
UPDATE "CompanyProspect"
SET "contactPriorityScore" = NULL
WHERE "contactPriorityScore" = 0
  AND "contactPriorityLastCalculatedAt" IS NULL;

-- Verification queries (run these after migration):

-- Check how many companies have null staleness scores (should be many)
SELECT COUNT(*) as unscanned_count
FROM "CompanyProspect"
WHERE "stalenessScore" IS NULL;

-- Check how many have legitimate score=0 (should be few)
SELECT COUNT(*) as fresh_zero_count
FROM "CompanyProspect"
WHERE "stalenessScore" = 0
  AND "lastAnalysedAt" IS NOT NULL;

-- Sample 10 companies to verify correct states
SELECT 
  id,
  "companyName",
  "stalenessScore",
  "lastAnalysedAt",
  "websiteHealthStatus",
  "websiteHealthScore"
FROM "CompanyProspect"
ORDER BY "updatedAt" DESC
LIMIT 10;
