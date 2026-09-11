-- CreateEnum
CREATE TYPE "CertificateRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "CertificateStatus" AS ENUM ('VALID', 'REVOKED');

-- CreateTable
CREATE TABLE "courses" (
    "id" TEXT NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "description" VARCHAR(1000),
    "coordinator" VARCHAR(100) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "courses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "course_modules" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "title" VARCHAR(120) NOT NULL,
    "hours" INTEGER NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "course_modules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "certificate_requests" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "status" "CertificateRequestStatus" NOT NULL DEFAULT 'PENDING',
    "pendingKey" TEXT,
    "rejectionReason" VARCHAR(500),
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "certificate_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "certificates" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "code" CHAR(12) NOT NULL,
    "registryYear" INTEGER NOT NULL,
    "registrySequence" INTEGER NOT NULL,
    "status" "CertificateStatus" NOT NULL DEFAULT 'VALID',
    "validKey" TEXT,
    "holderName" VARCHAR(100) NOT NULL,
    "courseTitle" VARCHAR(200) NOT NULL,
    "snapshot" JSONB NOT NULL,
    "dataHash" CHAR(64) NOT NULL,
    "fileHash" CHAR(64) NOT NULL,
    "fileKey" TEXT NOT NULL,
    "issuedById" TEXT NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL,
    "revokedById" TEXT,
    "revokedAt" TIMESTAMP(3),
    "revocationReason" VARCHAR(500),

    CONSTRAINT "certificates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "registry_counters" (
    "year" INTEGER NOT NULL,
    "last" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "registry_counters_pkey" PRIMARY KEY ("year")
);

-- CreateIndex
CREATE UNIQUE INDEX "course_modules_courseId_position_key" ON "course_modules"("courseId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "certificate_requests_pendingKey_key" ON "certificate_requests"("pendingKey");

-- CreateIndex
CREATE INDEX "certificate_requests_status_createdAt_idx" ON "certificate_requests"("status", "createdAt");

-- CreateIndex
CREATE INDEX "certificate_requests_userId_idx" ON "certificate_requests"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "certificates_requestId_key" ON "certificates"("requestId");

-- CreateIndex
CREATE UNIQUE INDEX "certificates_code_key" ON "certificates"("code");

-- CreateIndex
CREATE UNIQUE INDEX "certificates_validKey_key" ON "certificates"("validKey");

-- CreateIndex
CREATE INDEX "certificates_issuedAt_idx" ON "certificates"("issuedAt");

-- CreateIndex
CREATE INDEX "certificates_userId_idx" ON "certificates"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "certificates_registryYear_registrySequence_key" ON "certificates"("registryYear", "registrySequence");

-- AddForeignKey
ALTER TABLE "course_modules" ADD CONSTRAINT "course_modules_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certificate_requests" ADD CONSTRAINT "certificate_requests_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certificate_requests" ADD CONSTRAINT "certificate_requests_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certificate_requests" ADD CONSTRAINT "certificate_requests_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "courses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "certificate_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "courses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_issuedById_fkey" FOREIGN KEY ("issuedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_revokedById_fkey" FOREIGN KEY ("revokedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
