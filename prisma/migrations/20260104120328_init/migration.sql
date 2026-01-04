-- CreateTable
CREATE TABLE "Lead" (
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
    "metaViewport" BOOLEAN NOT NULL DEFAULT false,
    "generatorTag" TEXT,
    "emailDraft" TEXT,
    "subjectLine1" TEXT,
    "subjectLine2" TEXT,
    "emailStatus" TEXT NOT NULL DEFAULT 'NEW',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Settings" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "openaiApiKey" TEXT,
    "toneGuidelines" TEXT
);

-- CreateIndex
CREATE UNIQUE INDEX "Lead_websiteUrl_key" ON "Lead"("websiteUrl");
