-- MySQL dump 10.13  Distrib 8.0.44, for Win64 (x86_64)
--
-- Host: localhost    Database: server
-- ------------------------------------------------------
-- Server version	8.0.44

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `tcategorias`
--

DROP TABLE IF EXISTS `tcategorias`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `tcategorias` (
  `id` int NOT NULL AUTO_INCREMENT,
  `nombre` varchar(100) NOT NULL,
  `descripcion` varchar(255) DEFAULT '',
  PRIMARY KEY (`id`),
  UNIQUE KEY `nombre` (`nombre`)
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `tinventario`
--

DROP TABLE IF EXISTS `tinventario`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `tinventario` (
  `id` int NOT NULL AUTO_INCREMENT,
  `estatus` int NOT NULL,
  `sucursal` int NOT NULL,
  `proveedor` int NOT NULL,
  `producto` int NOT NULL,
  `cantidad` int NOT NULL,
  PRIMARY KEY (`id`),
  KEY `sucursal_idx` (`sucursal`),
  KEY `proveedor_idx` (`proveedor`),
  KEY `producto_idx` (`producto`),
  CONSTRAINT `producto` FOREIGN KEY (`producto`) REFERENCES `tproductos` (`id`),
  CONSTRAINT `proveedor` FOREIGN KEY (`proveedor`) REFERENCES `tproveedores` (`id`),
  CONSTRAINT `sucursal` FOREIGN KEY (`sucursal`) REFERENCES `tsucursales` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `tlista`
--

DROP TABLE IF EXISTS `tlista`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `tlista` (
  `id` int NOT NULL AUTO_INCREMENT,
  `inventario` int NOT NULL,
  `usuario` int NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_tlista_usuario_inventario` (`usuario`,`inventario`),
  KEY `idUsuario_idx` (`usuario`),
  KEY `idInventario_idx` (`inventario`),
  CONSTRAINT `idInventario` FOREIGN KEY (`inventario`) REFERENCES `tinventario` (`id`),
  CONSTRAINT `idUsuario` FOREIGN KEY (`usuario`) REFERENCES `tusuarios` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `tlogs`
--

DROP TABLE IF EXISTS `tlogs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `tlogs` (
  `id` int NOT NULL AUTO_INCREMENT,
  `usuario` int DEFAULT NULL,
  `modulo` varchar(60) NOT NULL,
  `accion` varchar(80) NOT NULL,
  `descripcion` varchar(255) NOT NULL,
  `entidad` varchar(60) DEFAULT NULL,
  `entidadId` int DEFAULT NULL,
  `nivel` varchar(20) NOT NULL DEFAULT 'info',
  `ip` varchar(80) DEFAULT NULL,
  `metadata` json DEFAULT NULL,
  `fechaRegistro` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_tlogs_usuario` (`usuario`),
  KEY `idx_tlogs_modulo` (`modulo`),
  KEY `idx_tlogs_entidad` (`entidad`),
  KEY `idx_tlogs_fecha` (`fechaRegistro`)
) ENGINE=InnoDB AUTO_INCREMENT=21 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `tpagos`
--

DROP TABLE IF EXISTS `tpagos`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `tpagos` (
  `id` int NOT NULL AUTO_INCREMENT,
  `usuario` int NOT NULL,
  `metodo` varchar(40) NOT NULL DEFAULT 'efectivo',
  `estado` varchar(30) NOT NULL DEFAULT 'pagado',
  `referencia` varchar(120) DEFAULT NULL,
  `subtotal` decimal(10,2) NOT NULL DEFAULT '0.00',
  `iva` decimal(10,2) NOT NULL DEFAULT '0.00',
  `envio` decimal(10,2) NOT NULL DEFAULT '0.00',
  `total` decimal(10,2) NOT NULL DEFAULT '0.00',
  `proveedor` varchar(60) DEFAULT NULL,
  `direccionEntrega` json DEFAULT NULL,
  `estadoEntrega` varchar(30) NOT NULL DEFAULT 'preparando',
  `fechaEstimadaEntrega` date DEFAULT NULL,
  `guiaEntrega` varchar(120) DEFAULT NULL,
  `notasEntrega` varchar(500) DEFAULT NULL,
  `metadata` json DEFAULT NULL,
  `fechaRegistro` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `fechaActualizacion` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_tpagos_usuario` (`usuario`),
  KEY `idx_tpagos_estado` (`estado`),
  KEY `idx_tpagos_metodo` (`metodo`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `tpedido`
--

DROP TABLE IF EXISTS `tpedido`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `tpedido` (
  `id` int NOT NULL AUTO_INCREMENT,
  `inventario` int NOT NULL,
  `usuario` int NOT NULL,
  `cantidad` int NOT NULL,
  `subtotal` double NOT NULL,
  PRIMARY KEY (`id`),
  KEY `inventario_idx` (`inventario`),
  KEY `usuario_idx` (`usuario`),
  CONSTRAINT `inventario` FOREIGN KEY (`inventario`) REFERENCES `tinventario` (`id`),
  CONSTRAINT `usuario` FOREIGN KEY (`usuario`) REFERENCES `tusuarios` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=10 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `tproducto_imagenes`
--

DROP TABLE IF EXISTS `tproducto_imagenes`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `tproducto_imagenes` (
  `id` int NOT NULL AUTO_INCREMENT,
  `producto` int NOT NULL,
  `ruta` varchar(500) NOT NULL,
  `nombreOriginal` varchar(255) DEFAULT NULL,
  `esPrincipal` tinyint NOT NULL DEFAULT '0',
  `orden` int NOT NULL DEFAULT '0',
  `fechaRegistro` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_tproducto_imagenes_producto` (`producto`),
  KEY `idx_tproducto_imagenes_orden` (`orden`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `tproductos`
--

DROP TABLE IF EXISTS `tproductos`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `tproductos` (
  `id` int NOT NULL AUTO_INCREMENT,
  `estatus` int NOT NULL,
  `nombre` varchar(45) NOT NULL,
  `detalles` varchar(450) NOT NULL,
  `categoria` varchar(45) NOT NULL,
  `precioCompra` double NOT NULL,
  `precioVenta` double NOT NULL,
  `imagen` varchar(450) NOT NULL,
  `imagenUrl` varchar(500) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `tproveedores`
--

DROP TABLE IF EXISTS `tproveedores`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `tproveedores` (
  `id` int NOT NULL AUTO_INCREMENT,
  `estatus` int NOT NULL,
  `marca` varchar(45) NOT NULL,
  `representante` varchar(45) NOT NULL,
  `telefono` varchar(10) NOT NULL,
  `correo` varchar(45) NOT NULL,
  `direccion` varchar(450) NOT NULL,
  `fechaContrato` varchar(10) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `tsucursales`
--

DROP TABLE IF EXISTS `tsucursales`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `tsucursales` (
  `id` int NOT NULL AUTO_INCREMENT,
  `estatus` int NOT NULL,
  `gerente` int NOT NULL,
  `nombre` varchar(45) NOT NULL,
  `telefono` varchar(10) NOT NULL,
  `direccion` varchar(450) NOT NULL,
  `latitud` decimal(10,8) DEFAULT NULL,
  `longitud` decimal(11,8) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `tusuarios`
--

DROP TABLE IF EXISTS `tusuarios`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `tusuarios` (
  `id` int NOT NULL AUTO_INCREMENT,
  `estatus` int NOT NULL,
  `tipo` int NOT NULL,
  `clave` varchar(255) NOT NULL,
  `nombre` varchar(45) NOT NULL,
  `fechaNacimiento` varchar(10) NOT NULL,
  `genero` varchar(45) NOT NULL,
  `telefono` varchar(10) NOT NULL,
  `correo` varchar(45) NOT NULL,
  `domicilio` varchar(450) NOT NULL,
  `ciudad` varchar(120) DEFAULT NULL,
  `estadoDireccion` varchar(120) DEFAULT NULL,
  `codigoPostal` varchar(10) DEFAULT NULL,
  `referenciasDomicilio` varchar(500) DEFAULT NULL,
  `fotoPerfil` varchar(500) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `tventas`
--

DROP TABLE IF EXISTS `tventas`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `tventas` (
  `id` int NOT NULL AUTO_INCREMENT,
  `usuario` int NOT NULL,
  `pago` int DEFAULT NULL,
  `producto` int NOT NULL,
  `cantidad` int NOT NULL,
  `total` double NOT NULL,
  `fechaRegistro` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `id_usuario_idx` (`usuario`),
  KEY `idProducto` (`producto`),
  CONSTRAINT `idCliente` FOREIGN KEY (`usuario`) REFERENCES `tusuarios` (`id`),
  CONSTRAINT `idProducto` FOREIGN KEY (`producto`) REFERENCES `tproductos` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-04-28 19:36:13
