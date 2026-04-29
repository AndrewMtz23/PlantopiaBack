const BranchRepository = require('../repositories/BranchRepository');
const ProviderRepository = require('../repositories/ProviderRepository');
const { writeActivityLog } = require('../utils/activityLog');

class BranchService {
  // Sucursales
  async createBranch(payload, requestIp, adminId) {
    const { gerente, nombre, telefono, direccion, latitud, longitud, estatus } = payload;
    
    if (!nombre) throw new Error('El nombre de la sucursal es obligatorio.');

    const branch = await BranchRepository.create({
      nombre,
      gerente: Number(gerente) || 0,
      telefono: telefono || '',
      direccion: direccion || '',
      latitud: latitud ? parseFloat(latitud) : null,
      longitud: longitud ? parseFloat(longitud) : null,
      estatus: Number(estatus) || 1
    });

    await writeActivityLog(null, {
      usuario: adminId,
      modulo: "sucursales",
      accion: "crear_sucursal",
      descripcion: `Se creó la sucursal ${nombre}.`,
      entidad: "tsucursales",
      entidadId: branch.id,
      nivel: "info",
      ip: requestIp,
    });

    return branch;
  }

  async getAllBranches() {
    return await BranchRepository.findAll();
  }

  async getPublicBranches() {
    return await BranchRepository.findAll({
      where: { estatus: 1 },
      orderBy: { nombre: 'asc' }
    });
  }

  async getManagers() {
    const prisma = require('../config/prisma');
    return await prisma.tusuarios.findMany({
      where: { estatus: 1, tipo: { in: [1, 3] } },
      select: { id: true, nombre: true, correo: true, telefono: true },
      orderBy: { nombre: 'asc' }
    });
  }

  async updateBranch(id, payload, requestIp, adminId) {
    const branchId = Number(id);
    const existing = await BranchRepository.findById(branchId);
    if (!existing) throw new Error('Sucursal no encontrada.');

    const updated = await BranchRepository.update(branchId, {
      ...payload,
      gerente: payload.gerente !== undefined ? Number(payload.gerente) : existing.gerente,
      latitud: payload.latitud !== undefined ? parseFloat(payload.latitud) : existing.latitud,
      longitud: payload.longitud !== undefined ? parseFloat(payload.longitud) : existing.longitud,
      estatus: payload.estatus !== undefined ? Number(payload.estatus) : existing.estatus
    });

    await writeActivityLog(null, {
      usuario: adminId,
      modulo: "sucursales",
      accion: "actualizar_sucursal",
      descripcion: `Se actualizó la sucursal ${existing.nombre}.`,
      entidad: "tsucursales",
      entidadId: branchId,
      nivel: "info",
      ip: requestIp,
    });

    return updated;
  }

  async deactivateBranch(id, requestIp, adminId) {
    const branchId = Number(id);
    if (!Number.isInteger(branchId) || branchId <= 0) {
      throw new Error('Id de sucursal invalido.');
    }

    const existing = await BranchRepository.findById(branchId);
    if (!existing) throw new Error('Sucursal no encontrada.');

    const updated = await BranchRepository.update(branchId, { estatus: 0 });

    await writeActivityLog(null, {
      usuario: adminId,
      modulo: "sucursales",
      accion: "desactivar_sucursal",
      descripcion: `Se desactivo la sucursal ${existing.nombre}.`,
      entidad: "tsucursales",
      entidadId: branchId,
      nivel: "warning",
      ip: requestIp,
    });

    return updated;
  }

  // Proveedores
  async createProvider(payload, requestIp, adminId) {
    const { marca, representante, telefono, correo, direccion, fechaContrato, estatus } = payload;
    
    if (!marca) throw new Error('La marca del proveedor es obligatoria.');

    const provider = await ProviderRepository.create({
      marca,
      representante: representante || '',
      telefono: telefono || '',
      correo: correo || '',
      direccion: direccion || '',
      fechaContrato: fechaContrato || '',
      estatus: Number(estatus) || 1
    });

    await writeActivityLog(null, {
      usuario: adminId,
      modulo: "proveedores",
      accion: "crear_proveedor",
      descripcion: `Se registró al proveedor ${marca}.`,
      entidad: "tproveedores",
      entidadId: provider.id,
      nivel: "info",
      ip: requestIp,
    });

    return provider;
  }

  async getAllProviders() {
    return await ProviderRepository.findAll();
  }

  async updateProvider(id, payload, requestIp, adminId) {
    const providerId = Number(id);
    if (!Number.isInteger(providerId) || providerId <= 0) {
      throw new Error('Id de proveedor invalido.');
    }

    const existing = await ProviderRepository.findById(providerId);
    if (!existing) throw new Error('Proveedor no encontrado.');

    const updated = await ProviderRepository.update(providerId, {
      ...payload,
      estatus: payload.estatus !== undefined ? Number(payload.estatus) : existing.estatus
    });

    await writeActivityLog(null, {
      usuario: adminId,
      modulo: "proveedores",
      accion: "actualizar_proveedor",
      descripcion: `Se actualizó el proveedor ${existing.marca}.`,
      entidad: "tproveedores",
      entidadId: providerId,
      nivel: "info",
      ip: requestIp,
    });

    return updated;
  }

  async deactivateProvider(id, requestIp, adminId) {
    const providerId = Number(id);
    if (!Number.isInteger(providerId) || providerId <= 0) {
      throw new Error('Id de proveedor invalido.');
    }

    const existing = await ProviderRepository.findById(providerId);
    if (!existing) throw new Error('Proveedor no encontrado.');

    const updated = await ProviderRepository.update(providerId, { estatus: 0 });

    await writeActivityLog(null, {
      usuario: adminId,
      modulo: "proveedores",
      accion: "desactivar_proveedor",
      descripcion: `Se desactivo el proveedor ${existing.marca}.`,
      entidad: "tproveedores",
      entidadId: providerId,
      nivel: "warning",
      ip: requestIp,
    });

    return updated;
  }
}

module.exports = new BranchService();
