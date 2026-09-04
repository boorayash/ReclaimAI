-- CreateTable
CREATE TABLE "SimClock" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "currentDay" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SimClock_pkey" PRIMARY KEY ("id")
);
