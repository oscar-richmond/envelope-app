/*
  Warnings:

  - You are about to drop the `GmailConnection` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `SuppressionList` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropIndex
DROP INDEX "GmailConnection_email_key";

-- DropIndex
DROP INDEX "SuppressionList_email_key";

-- DropIndex
DROP INDEX "SuppressionList_domain_key";

-- AlterTable
ALTER TABLE "Contact" ADD COLUMN "source" TEXT;

-- AlterTable
ALTER TABLE "OutreachMessage" ADD COLUMN "gmailThreadId" TEXT;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "GmailConnection";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "SuppressionList";
PRAGMA foreign_keys=on;

-- CreateTable
CREATE TABLE "CompanyProspect" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "companyName" TEXT NOT NULL,
    "companyNumber" TEXT NOT NULL,
    "registeredOfficeAddress" TEXT,
    "sicCodes" TEXT,
    "incorporationDate" DATETIME,
    "status" TEXT,
    "source" TEXT NOT NULL DEFAULT 'companies_house',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "GmailAccount" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "email" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "expiryDate" BIGINT NOT NULL,
    "dailyLimit" INTEGER NOT NULL DEFAULT 20,
    "sentToday" INTEGER NOT NULL DEFAULT 0,
    "lastSentAt" DATETIME
);

-- CreateTable
CREATE TABLE "SuppressionEntry" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "domain" TEXT,
    "email" TEXT,
    "reason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Settings" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "openaiApiKey" TEXT,
    "toneGuidelines" TEXT,
    "emailSignature" TEXT,
    "dailySendLimit" INTEGER NOT NULL DEFAULT 50
);
INSERT INTO "new_Settings" ("id", "openaiApiKey", "toneGuidelines") SELECT "id", "openaiApiKey", "toneGuidelines" FROM "Settings";
DROP TABLE "Settings";
ALTER TABLE "new_Settings" RENAME TO "Settings";
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;

-- CreateIndex
CREATE UNIQUE INDEX "CompanyProspect_companyNumber_key" ON "CompanyProspect"("companyNumber");

-- CreateIndex
CREATE UNIQUE INDEX "GmailAccount_email_key" ON "GmailAccount"("email");

-- CreateIndex
CREATE UNIQUE INDEX "SuppressionEntry_domain_key" ON "SuppressionEntry"("domain");

-- CreateIndex
CREATE UNIQUE INDEX "SuppressionEntry_email_key" ON "SuppressionEntry"("email");
