-- CreateTable
CREATE TABLE "Op" (
    "seqNum" SERIAL NOT NULL,
    "docId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Op_pkey" PRIMARY KEY ("seqNum")
);

-- CreateTable
CREATE TABLE "SnapShot" (
    "id" TEXT NOT NULL,
    "docId" TEXT NOT NULL,
    "state" JSONB NOT NULL,
    "lastSeq" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SnapShot_pkey" PRIMARY KEY ("id")
);
