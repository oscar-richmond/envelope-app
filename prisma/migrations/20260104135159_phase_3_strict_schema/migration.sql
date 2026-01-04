/*
  Warnings:

  - You are about to drop the column `incorporationDate` on the `CompanyProspect` table. All the data in the column will be lost.
  - You are about to drop the column `registeredOfficeAddress` on the `CompanyProspect` table. All the data in the column will be lost.
  - Added the required column `updatedAt` to the `CompanyProspect` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_CompanyProspect" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "companyName" TEXT NOT NULL,
    "companyNumber" TEXT NOT NULL,
    "industry" TEXT,
    "sicCodes" TEXT,
    "employeeSizeBand" TEXT,
    "registeredLocation" TEXT,
    "websiteUrl" TEXT,
    "websiteConfidence" TEXT NOT NULL DEFAULT 'LOW',
    "source" TEXT NOT NULL DEFAULT 'companies_house',
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_CompanyProspect" ("companyName", "companyNumber", "createdAt", "id", "sicCodes", "source", "status") SELECT "companyName", "companyNumber", "createdAt", "id", "sicCodes", "source", coalesce("status", 'NEW') AS "status" FROM "CompanyProspect";
DROP TABLE "CompanyProspect";
ALTER TABLE "new_CompanyProspect" RENAME TO "CompanyProspect";
CREATE UNIQUE INDEX "CompanyProspect_companyNumber_key" ON "CompanyProspect"("companyNumber");
CREATE TABLE "new_Lead" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "companyName" TEXT NOT NULL,
    "websiteUrl" TEXT NOT NULL,
    "industry" TEXT,
    "location" TEXT,
    "stalenessScore" INTEGER NOT NULL DEFAULT 0,
    "scoreConfidence" TEXT NOT NULL DEFAULT 'LOW',
    "scoreReasons" TEXT,
    "lastAnalyzedAt" DATETIME,
    "copyrightYear" INTEGER,
    "hasSitemap" BOOLEAN NOT NULL DEFAULT false,
    "sitemapLastMod" DATETIME,
    "blogLastPost" DATETIME,
    "metaViewport" BOOLEAN NOT NULL DEFAULT false,
    "generatorTag" TEXT,
    "emailDraft" TEXT,
    "subjectLine1" TEXT,
    "subjectLine2" TEXT,
    "emailStatus" TEXT NOT NULL DEFAULT 'NEW',
    "companyProspectId" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Lead_companyProspectId_fkey" FOREIGN KEY ("companyProspectId") REFERENCES "CompanyProspect" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Lead" ("blogLastPost", "companyName", "copyrightYear", "createdAt", "emailDraft", "emailStatus", "generatorTag", "hasSitemap", "id", "industry", "lastAnalyzedAt", "location", "metaViewport", "scoreConfidence", "scoreReasons", "sitemapLastMod", "stalenessScore", "subjectLine1", "subjectLine2", "updatedAt", "websiteUrl") SELECT "blogLastPost", "companyName", "copyrightYear", "createdAt", "emailDraft", "emailStatus", "generatorTag", "hasSitemap", "id", "industry", "lastAnalyzedAt", "location", "metaViewport", "scoreConfidence", "scoreReasons", "sitemapLastMod", "stalenessScore", "subjectLine1", "subjectLine2", "updatedAt", "websiteUrl" FROM "Lead";
DROP TABLE "Lead";
ALTER TABLE "new_Lead" RENAME TO "Lead";
CREATE UNIQUE INDEX "Lead_websiteUrl_key" ON "Lead"("websiteUrl");
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
