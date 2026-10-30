-- AlterTable
ALTER TABLE "tpagos" ADD COLUMN     "cobradoPor" INTEGER,
ADD COLUMN     "fechaCobro" TIMESTAMP(3),
ADD COLUMN     "idempotencyKey" VARCHAR(120),
ADD COLUMN     "requestHash" VARCHAR(64),
ALTER COLUMN "estado" SET DEFAULT 'pendiente';

-- AlterTable
ALTER TABLE "tventas" ADD COLUMN     "costoUnitario" DECIMAL(12,2),
ADD COLUMN     "inventario" INTEGER,
ADD COLUMN     "precioUnitario" DECIMAL(12,2),
ADD COLUMN     "sucursal" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "tpagos_usuario_idempotencyKey_key" ON "tpagos"("usuario", "idempotencyKey");
