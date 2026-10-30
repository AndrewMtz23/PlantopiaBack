BEGIN;

DO $$
DECLARE problem_count bigint;
BEGIN
 SELECT count(*) INTO problem_count FROM (
   SELECT "precioCompra"::numeric AS value FROM tproductos UNION ALL
   SELECT "precioVenta"::numeric FROM tproductos UNION ALL
   SELECT subtotal::numeric FROM tpedido UNION ALL SELECT total::numeric FROM tventas
 ) amounts WHERE value <> round(value, 2) OR value < 0 OR value > 9999999999.99 OR value::text IN ('NaN', 'Infinity', '-Infinity');
 IF problem_count > 0 THEN RAISE EXCEPTION 'Monetary precision/range requires reconciliation: % values; migration stopped', problem_count; END IF;
END $$;

DO $$ BEGIN
 IF EXISTS (SELECT lower(trim(correo)) FROM tusuarios GROUP BY lower(trim(correo)) HAVING count(*) > 1) THEN
  RAISE EXCEPTION 'Duplicate normalized email: reconcile before migration';
 END IF;
END $$;
UPDATE tusuarios SET correo = lower(trim(correo));
-- AlterTable
ALTER TABLE "tpagos" ALTER COLUMN "subtotal" SET DATA TYPE DECIMAL(12,2),
ALTER COLUMN "iva" SET DATA TYPE DECIMAL(12,2),
ALTER COLUMN "envio" SET DATA TYPE DECIMAL(12,2),
ALTER COLUMN "total" SET DATA TYPE DECIMAL(12,2);

-- AlterTable
ALTER TABLE "tpedido" ALTER COLUMN "subtotal" SET DATA TYPE DECIMAL(12,2);

-- AlterTable
ALTER TABLE "tproductos" ALTER COLUMN "precioCompra" SET DATA TYPE DECIMAL(12,2),
ALTER COLUMN "precioVenta" SET DATA TYPE DECIMAL(12,2);

-- AlterTable
ALTER TABLE "tusuarios" ALTER COLUMN "correo" SET DATA TYPE VARCHAR(254);

-- AlterTable
ALTER TABLE "tventas" ALTER COLUMN "total" SET DATA TYPE DECIMAL(12,2);

-- CreateIndex
CREATE UNIQUE INDEX "tpedido_usuario_inventario_key" ON "tpedido"("usuario", "inventario");

-- CreateIndex
CREATE UNIQUE INDEX "tusuarios_correo_key" ON "tusuarios"("correo");

-- AddForeignKey
ALTER TABLE "tpagos" ADD CONSTRAINT "tpagos_usuario_fkey" FOREIGN KEY ("usuario") REFERENCES "tusuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tpagos" ADD CONSTRAINT "tpagos_repartidorId_fkey" FOREIGN KEY ("repartidorId") REFERENCES "tusuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tproducto_imagenes" ADD CONSTRAINT "tproducto_imagenes_producto_fkey" FOREIGN KEY ("producto") REFERENCES "tproductos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tventas" ADD CONSTRAINT "tventas_pago_fkey" FOREIGN KEY ("pago") REFERENCES "tpagos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE tusuarios ADD CONSTRAINT email_normalized CHECK (correo = lower(trim(correo)) AND length(correo) > 3);
ALTER TABLE tinventario ADD CONSTRAINT stock_nonnegative CHECK (cantidad >= 0);
ALTER TABLE tpedido ADD CONSTRAINT cart_quantity_positive CHECK (cantidad > 0), ADD CONSTRAINT cart_subtotal_nonnegative CHECK (subtotal >= 0);
ALTER TABLE tproductos ADD CONSTRAINT prices_nonnegative CHECK ("precioCompra" >= 0 AND "precioVenta" >= 0);
ALTER TABLE tventas ADD CONSTRAINT sale_quantity_positive CHECK (cantidad > 0), ADD CONSTRAINT sale_total_nonnegative CHECK (total >= 0);
ALTER TABLE tpagos ADD CONSTRAINT payment_totals_nonnegative CHECK (subtotal >= 0 AND iva >= 0 AND envio >= 0 AND total >= 0);
COMMIT;
