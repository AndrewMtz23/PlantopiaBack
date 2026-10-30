-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "tcategorias" (
    "id" SERIAL NOT NULL,
    "nombre" VARCHAR(100) NOT NULL,
    "slug" VARCHAR(100),
    "descripcion" VARCHAR(255) DEFAULT '',
    "icon" VARCHAR(50),
    "color" VARCHAR(20),
    "isActive" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tcategorias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tinventario" (
    "id" SERIAL NOT NULL,
    "estatus" INTEGER NOT NULL,
    "sucursal" INTEGER NOT NULL,
    "proveedor" INTEGER NOT NULL,
    "producto" INTEGER NOT NULL,
    "cantidad" INTEGER NOT NULL,

    CONSTRAINT "tinventario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tlista" (
    "id" SERIAL NOT NULL,
    "inventario" INTEGER NOT NULL,
    "usuario" INTEGER NOT NULL,

    CONSTRAINT "tlista_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tlogs" (
    "id" SERIAL NOT NULL,
    "usuario" INTEGER,
    "modulo" VARCHAR(60) NOT NULL,
    "accion" VARCHAR(80) NOT NULL,
    "descripcion" VARCHAR(255) NOT NULL,
    "entidad" VARCHAR(60),
    "entidadId" INTEGER,
    "nivel" VARCHAR(20) NOT NULL DEFAULT 'info',
    "ip" VARCHAR(80),
    "metadata" JSONB,
    "fechaRegistro" TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tlogs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tpagos" (
    "id" SERIAL NOT NULL,
    "usuario" INTEGER NOT NULL,
    "metodo" VARCHAR(40) NOT NULL DEFAULT 'efectivo',
    "estado" VARCHAR(30) NOT NULL DEFAULT 'pagado',
    "referencia" VARCHAR(120),
    "subtotal" DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    "iva" DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    "envio" DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    "total" DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    "proveedor" VARCHAR(60),
    "direccionEntrega" JSONB,
    "estadoEntrega" VARCHAR(30) NOT NULL DEFAULT 'preparando',
    "fechaEstimadaEntrega" DATE,
    "guiaEntrega" VARCHAR(120),
    "notasEntrega" VARCHAR(500),
    "repartidorId" INTEGER,
    "metadata" JSONB,
    "fechaRegistro" TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechaActualizacion" TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tpagos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tpedido" (
    "id" SERIAL NOT NULL,
    "inventario" INTEGER NOT NULL,
    "usuario" INTEGER NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "subtotal" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "tpedido_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tproducto_imagenes" (
    "id" SERIAL NOT NULL,
    "producto" INTEGER NOT NULL,
    "ruta" VARCHAR(500) NOT NULL,
    "nombreOriginal" VARCHAR(255),
    "esPrincipal" SMALLINT NOT NULL DEFAULT 0,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "fechaRegistro" TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tproducto_imagenes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tproductos" (
    "id" SERIAL NOT NULL,
    "estatus" INTEGER NOT NULL,
    "nombre" VARCHAR(45) NOT NULL,
    "detalles" VARCHAR(450) NOT NULL,
    "categoria" VARCHAR(45) NOT NULL,
    "precioCompra" DOUBLE PRECISION NOT NULL,
    "precioVenta" DOUBLE PRECISION NOT NULL,
    "imagen" VARCHAR(450) NOT NULL,
    "imagenUrl" VARCHAR(500),

    CONSTRAINT "tproductos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tproveedores" (
    "id" SERIAL NOT NULL,
    "estatus" INTEGER NOT NULL,
    "marca" VARCHAR(45) NOT NULL,
    "representante" VARCHAR(45) NOT NULL,
    "telefono" VARCHAR(10) NOT NULL,
    "correo" VARCHAR(45) NOT NULL,
    "direccion" VARCHAR(450) NOT NULL,
    "fechaContrato" VARCHAR(10) NOT NULL,

    CONSTRAINT "tproveedores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tsucursales" (
    "id" SERIAL NOT NULL,
    "estatus" INTEGER NOT NULL,
    "gerente" INTEGER NOT NULL,
    "nombre" VARCHAR(45) NOT NULL,
    "telefono" VARCHAR(10) NOT NULL,
    "direccion" VARCHAR(450) NOT NULL,
    "latitud" DECIMAL(10,8),
    "longitud" DECIMAL(11,8),

    CONSTRAINT "tsucursales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tusuarios" (
    "id" SERIAL NOT NULL,
    "estatus" INTEGER NOT NULL,
    "tipo" INTEGER NOT NULL,
    "clave" VARCHAR(255) NOT NULL,
    "nombre" VARCHAR(45) NOT NULL,
    "fechaNacimiento" VARCHAR(10) NOT NULL,
    "genero" VARCHAR(45) NOT NULL,
    "telefono" VARCHAR(10) NOT NULL,
    "correo" VARCHAR(45) NOT NULL,
    "domicilio" VARCHAR(450) NOT NULL,
    "ciudad" VARCHAR(120),
    "estadoDireccion" VARCHAR(120),
    "codigoPostal" VARCHAR(10),
    "referenciasDomicilio" VARCHAR(500),
    "latitud" DECIMAL(10,8),
    "longitud" DECIMAL(11,8),
    "fotoPerfil" VARCHAR(500),

    CONSTRAINT "tusuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tventas" (
    "id" SERIAL NOT NULL,
    "usuario" INTEGER NOT NULL,
    "pago" INTEGER,
    "producto" INTEGER NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "total" DOUBLE PRECISION NOT NULL,
    "fechaRegistro" TIMESTAMP(0) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tventas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "nombre" ON "tcategorias"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "slug" ON "tcategorias"("slug");

-- CreateIndex
CREATE INDEX "producto_idx" ON "tinventario"("producto");

-- CreateIndex
CREATE INDEX "proveedor_idx" ON "tinventario"("proveedor");

-- CreateIndex
CREATE INDEX "sucursal_idx" ON "tinventario"("sucursal");

-- CreateIndex
CREATE INDEX "idInventario_idx" ON "tlista"("inventario");

-- CreateIndex
CREATE INDEX "idUsuario_idx" ON "tlista"("usuario");

-- CreateIndex
CREATE UNIQUE INDEX "uniq_tlista_usuario_inventario" ON "tlista"("usuario", "inventario");

-- CreateIndex
CREATE INDEX "idx_tlogs_entidad" ON "tlogs"("entidad");

-- CreateIndex
CREATE INDEX "idx_tlogs_fecha" ON "tlogs"("fechaRegistro");

-- CreateIndex
CREATE INDEX "idx_tlogs_modulo" ON "tlogs"("modulo");

-- CreateIndex
CREATE INDEX "idx_tlogs_usuario" ON "tlogs"("usuario");

-- CreateIndex
CREATE INDEX "idx_tpagos_estado" ON "tpagos"("estado");

-- CreateIndex
CREATE INDEX "idx_tpagos_metodo" ON "tpagos"("metodo");

-- CreateIndex
CREATE INDEX "idx_tpagos_usuario" ON "tpagos"("usuario");

-- CreateIndex
CREATE INDEX "inventario_idx" ON "tpedido"("inventario");

-- CreateIndex
CREATE INDEX "usuario_idx" ON "tpedido"("usuario");

-- CreateIndex
CREATE INDEX "idx_tproducto_imagenes_orden" ON "tproducto_imagenes"("orden");

-- CreateIndex
CREATE INDEX "idx_tproducto_imagenes_producto" ON "tproducto_imagenes"("producto");

-- CreateIndex
CREATE INDEX "idProducto" ON "tventas"("producto");

-- CreateIndex
CREATE INDEX "id_usuario_idx" ON "tventas"("usuario");

-- AddForeignKey
ALTER TABLE "tinventario" ADD CONSTRAINT "producto" FOREIGN KEY ("producto") REFERENCES "tproductos"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tinventario" ADD CONSTRAINT "proveedor" FOREIGN KEY ("proveedor") REFERENCES "tproveedores"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tinventario" ADD CONSTRAINT "sucursal" FOREIGN KEY ("sucursal") REFERENCES "tsucursales"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tlista" ADD CONSTRAINT "idInventario" FOREIGN KEY ("inventario") REFERENCES "tinventario"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tlista" ADD CONSTRAINT "idUsuario" FOREIGN KEY ("usuario") REFERENCES "tusuarios"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tpedido" ADD CONSTRAINT "inventario" FOREIGN KEY ("inventario") REFERENCES "tinventario"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tpedido" ADD CONSTRAINT "usuario" FOREIGN KEY ("usuario") REFERENCES "tusuarios"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tventas" ADD CONSTRAINT "idCliente" FOREIGN KEY ("usuario") REFERENCES "tusuarios"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tventas" ADD CONSTRAINT "fk_idProducto" FOREIGN KEY ("producto") REFERENCES "tproductos"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
