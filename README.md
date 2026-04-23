# Plantopia Backend API 🌱 🚀

Este es el repositorio del servidor (Backend) para el proyecto **Plantopia**, un sistema E-commerce especializado en la venta de plantas y productos botánicos.

> [!NOTE]
> **Proyecto Académico**: Este repositorio forma parte de un proyecto escolar desarrollado para aprender y aplicar tecnologías de desarrollo web moderno.

## 🛠️ Tecnologías Utilizadas

- **Node.js**: Entorno de ejecución para JavaScript.
- **Express**: Framework para la creación de APIs REST.
- **MySQL / MySQL2**: Sistema de gestión de bases de datos.
- **JWT**: Autenticación segura mediante tokens.
- **Bcryptjs**: Encriptación de contraseñas.
- **Railway**: Plataforma de despliegue y base de datos en producción.

## 📋 Características

- Autenticación de usuarios (Clientes y Administradores).
- Gestión de productos, categorías y sucursales.
- Sistema de logs de actividad para auditoría.
- Procesamiento de pagos (simulado/integrado).
- Carga de imágenes local segura.

## 🚀 Instalación y Uso Local

1. Clona este repositorio.
2. Instala las dependencias:
   ```bash
   npm install
   ```
3. Configura tu archivo `.env` con las credenciales de tu base de datos (puedes usar `.env.example` como base).
4. Inicia el servidor:
   ```bash
   npm start
   ```

El servidor correrá por defecto en el puerto `3001`.

## 🌐 Despliegue

Este backend está diseñado para ser desplegado en **Railway**. Asegúrate de configurar las variables de entorno correspondientes en el panel de control de Railway.

---
© 2026 - Proyecto Plantopia
