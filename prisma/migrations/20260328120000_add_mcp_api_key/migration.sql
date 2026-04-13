ALTER TABLE "User" ADD COLUMN "mcpApiKey" TEXT;

CREATE UNIQUE INDEX "User_mcpApiKey_key" ON "User"("mcpApiKey");
