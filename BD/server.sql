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
-- Dumping data for table `tcategorias`
--

LOCK TABLES `tcategorias` WRITE;
/*!40000 ALTER TABLE `tcategorias` DISABLE KEYS */;
INSERT INTO `tcategorias` VALUES (1,'Desinfectantes',''),(2,'Plantas de interior','Plantas ideales para espacios cerrados con poca luz y fácil mantenimiento'),(3,'Plantas de exterior','Plantas resistentes diseñadas para crecer en jardines, patios o balcones'),(4,'Suculentas','Plantas de bajo mantenimiento que almacenan agua en sus hojas'),(5,'Cactus','Plantas resistentes que requieren poca agua y son ideales para climas secos'),(6,'Plantas ornamentales','Plantas decorativas utilizadas para embellecer espacios interiores y exteriores');
/*!40000 ALTER TABLE `tcategorias` ENABLE KEYS */;
UNLOCK TABLES;

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
-- Dumping data for table `tinventario`
--

LOCK TABLES `tinventario` WRITE;
/*!40000 ALTER TABLE `tinventario` DISABLE KEYS */;
INSERT INTO `tinventario` VALUES (1,1,1,1,1,198),(2,1,2,2,2,175);
/*!40000 ALTER TABLE `tinventario` ENABLE KEYS */;
UNLOCK TABLES;

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
  KEY `idUsuario_idx` (`usuario`),
  KEY `idInventario_idx` (`inventario`),
  CONSTRAINT `idInventario` FOREIGN KEY (`inventario`) REFERENCES `tinventario` (`id`),
  CONSTRAINT `idUsuario` FOREIGN KEY (`usuario`) REFERENCES `tusuarios` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tlista`
--

LOCK TABLES `tlista` WRITE;
/*!40000 ALTER TABLE `tlista` DISABLE KEYS */;
INSERT INTO `tlista` VALUES (2,1,3),(3,1,3),(4,1,5);
/*!40000 ALTER TABLE `tlista` ENABLE KEYS */;
UNLOCK TABLES;

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
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tlogs`
--

LOCK TABLES `tlogs` WRITE;
/*!40000 ALTER TABLE `tlogs` DISABLE KEYS */;
INSERT INTO `tlogs` VALUES (1,1,'usuarios','editar_usuario','Se actualizo el usuario Andrewww (#3).','tusuarios',3,'info','::1','{\"antes\": {\"tipo\": 2, \"correo\": \"pandred25@gmail.com\", \"nombre\": \"Andrewww\", \"estatus\": 1}, \"despues\": {\"tipo\": 2, \"correo\": \"pandred25@gmail.com\", \"nombre\": \"Andreww\", \"estatus\": 1}, \"actualizoClave\": false}','2026-04-23 20:53:33'),(2,5,'pagos','compra_procesada','Pago 1 procesado con 1 producto(s).','tpagos',1,'info','::1','{\"iva\": 19.68, \"envio\": 50, \"total\": 192.68, \"metodo\": \"efectivo\", \"subtotal\": 123, \"referencia\": null}','2026-04-23 21:17:34'),(3,5,'pagos','compra_procesada','Pago 2 procesado con 2 producto(s).','tpagos',2,'info','::1','{\"iva\": 8899.68, \"envio\": 50, \"total\": 64572.68, \"metodo\": \"efectivo\", \"subtotal\": 55623, \"referencia\": null}','2026-04-23 21:17:59');
/*!40000 ALTER TABLE `tlogs` ENABLE KEYS */;
UNLOCK TABLES;

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
  `metadata` json DEFAULT NULL,
  `fechaRegistro` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `fechaActualizacion` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_tpagos_usuario` (`usuario`),
  KEY `idx_tpagos_estado` (`estado`),
  KEY `idx_tpagos_metodo` (`metodo`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tpagos`
--

LOCK TABLES `tpagos` WRITE;
/*!40000 ALTER TABLE `tpagos` DISABLE KEYS */;
INSERT INTO `tpagos` VALUES (1,5,'efectivo','pagado',NULL,123.00,19.68,50.00,192.68,NULL,'{\"origen\": \"procesarCompra\", \"productos\": 1}','2026-04-23 21:17:34','2026-04-23 21:17:34'),(2,5,'efectivo','pagado',NULL,55623.00,8899.68,50.00,64572.68,NULL,'{\"origen\": \"procesarCompra\", \"productos\": 2}','2026-04-23 21:17:59','2026-04-23 21:17:59');
/*!40000 ALTER TABLE `tpagos` ENABLE KEYS */;
UNLOCK TABLES;

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
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tpedido`
--

LOCK TABLES `tpedido` WRITE;
/*!40000 ALTER TABLE `tpedido` DISABLE KEYS */;
INSERT INTO `tpedido` VALUES (1,1,3,4,492);
/*!40000 ALTER TABLE `tpedido` ENABLE KEYS */;
UNLOCK TABLES;

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
-- Dumping data for table `tproductos`
--

LOCK TABLES `tproductos` WRITE;
/*!40000 ALTER TABLE `tproductos` DISABLE KEYS */;
INSERT INTO `tproductos` VALUES (1,1,'Tabla de Picar','es una linda tabla de picar','Desinfectantes',122,123,'/images/af825b71fda8a4af9d00a37daf527941.jpg',NULL),(2,1,'Monstera Deliciosa','Planta de interior con hojas grandes y decorativas, ideal para espacios modernos','Plantas de Interior',120,250,'null','https://cdn0.ecologiaverde.com/es/posts/4/6/5/plantas_de_interior_grandes_1564_1200.jpg');
/*!40000 ALTER TABLE `tproductos` ENABLE KEYS */;
UNLOCK TABLES;

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
-- Dumping data for table `tproveedores`
--

LOCK TABLES `tproveedores` WRITE;
/*!40000 ALTER TABLE `tproveedores` DISABLE KEYS */;
INSERT INTO `tproveedores` VALUES (1,1,'Bimbo','Lilith','1234567890','lilith@gmail.com','Biombo','12/12/12'),(2,1,'Platas Naturales S.A.','Luis Hernández Gómez','4421122334','luis.hernandez@bimbo.com','Av. 5 de Febrero #1200, Zona Industrial, Querétaro, Qro','15/03/2024');
/*!40000 ALTER TABLE `tproveedores` ENABLE KEYS */;
UNLOCK TABLES;

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
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tsucursales`
--

LOCK TABLES `tsucursales` WRITE;
/*!40000 ALTER TABLE `tsucursales` DISABLE KEYS */;
INSERT INTO `tsucursales` VALUES (1,1,1,'Sucursal Plaza Antea','4429876543','Blvd. Bernardo Quintana 9800, Local 45, Querétaro, Qro.'),(2,1,4,'Sucursal Centro Querétaro','4421234567','Av. Zaragoza #120, Col. Centro, Querétaro, Qro.'),(4,1,4,'Sucursal Juriquilla','4425567788','Av. de la República #350, Juriquilla, Querétaro');
/*!40000 ALTER TABLE `tsucursales` ENABLE KEYS */;
UNLOCK TABLES;

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
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tusuarios`
--

LOCK TABLES `tusuarios` WRITE;
/*!40000 ALTER TABLE `tusuarios` DISABLE KEYS */;
INSERT INTO `tusuarios` VALUES (1,1,1,'$2b$10$loTw8thmPvp6pU2seyf.k.azmAmI57/wNg80YHnxPeW/fh4qyJP9u','Martin Larios','2000-12-12','MASCULINO','4421781565','admin@gmail.com','UTEQ'),(2,0,2,'$2b$10$IYbKpp2HKQWhLbm8OAJt7uGS6dwpuZGRsrNvOB9uq.jgdhZQv5I4u','lilo','12/12/12','FEMENINO','123467890','lilith@gmail.com','biombo'),(3,1,2,'$2b$10$mmEkb/hFJ/lSsjldYOy2Z.2P8xp42yyh3QWjb5RA1Ff1DX24wQKVq','Andreww','2026-04-08','FEMENINO','1234567890','pandred25@gmail.com','DEL BIOMBO'),(4,1,1,'$2b$10$EPk8H7VZ9M2.CvR.H2AgoutQhdMWuK4mT0VAlXMnmaH3rgBGJKoga','Lilith Argueta','2004-12-18','FEMENINO','4421781565','lilithargueta@gmail.com','DEL BIOMBO'),(5,1,2,'$2b$10$aU1lqmUsDiqnpzn68DxPheq3P0PRYUHomL.JK/cViKbxd152zJe6O','Flor Andrade','2009-02-05','FEMENINO','4421781565','pandred27@gmail.com','Calle de la Patria');
/*!40000 ALTER TABLE `tusuarios` ENABLE KEYS */;
UNLOCK TABLES;

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
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tventas`
--

LOCK TABLES `tventas` WRITE;
/*!40000 ALTER TABLE `tventas` DISABLE KEYS */;
INSERT INTO `tventas` VALUES (1,5,NULL,2,1,250,'2026-04-23 19:49:50'),(2,5,NULL,2,2,500,'2026-04-23 20:01:33'),(3,5,1,1,1,123,'2026-04-23 21:17:34'),(4,5,2,1,1,123,'2026-04-23 21:17:59'),(5,5,2,2,222,55500,'2026-04-23 21:17:59');
/*!40000 ALTER TABLE `tventas` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping routines for database 'server'
--
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-04-23 15:23:14
