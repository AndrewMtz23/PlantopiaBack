BEGIN;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM tinventario GROUP BY producto, sucursal HAVING COUNT(*) > 1) THEN
    RAISE EXCEPTION 'Duplicate product/branch inventory: reconcile before migration';
  END IF;
END $$;
ALTER TABLE tinventario ADD COLUMN version INTEGER NOT NULL DEFAULT 0;
CREATE UNIQUE INDEX tinventario_producto_sucursal_key ON tinventario(producto, sucursal);
CREATE TABLE inventory_movements (
  id SERIAL PRIMARY KEY,
  "inventoryId" INTEGER NOT NULL REFERENCES tinventario(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  "before" INTEGER NOT NULL,
  "after" INTEGER NOT NULL,
  delta INTEGER NOT NULL,
  reason VARCHAR(250) NOT NULL,
  "actorId" INTEGER,
  "sourceType" VARCHAR(30) NOT NULL,
  "sourceId" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT inventory_movement_balances CHECK ("before" >= 0 AND "after" >= 0 AND "after"::bigint - "before"::bigint = delta::bigint)
);
CREATE UNIQUE INDEX "inventory_movements_inventoryId_sourceType_sourceId_key" ON inventory_movements("inventoryId", "sourceType", "sourceId");
INSERT INTO inventory_movements ("inventoryId", "before", "after", delta, reason, "sourceType", "sourceId")
SELECT id, 0, cantidad, cantidad, 'Opening balance at migration; prior history unavailable', 'opening', id FROM tinventario;
COMMIT;
