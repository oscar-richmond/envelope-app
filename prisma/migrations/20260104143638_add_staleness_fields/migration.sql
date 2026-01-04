-- AlterTable
ALTER TABLE "CompanyProspect" ADD COLUMN "lastAnalysedAt" DATETIME;
ALTER TABLE "CompanyProspect" ADD COLUMN "scoreReasons" TEXT;
ALTER TABLE "CompanyProspect" ADD COLUMN "signals" TEXT;
ALTER TABLE "CompanyProspect" ADD COLUMN "stalenessConfidence" TEXT;
ALTER TABLE "CompanyProspect" ADD COLUMN "stalenessScore" INTEGER DEFAULT 0;
