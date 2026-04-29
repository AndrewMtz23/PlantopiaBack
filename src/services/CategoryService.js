const CategoryRepository = require('../repositories/CategoryRepository');
const { writeActivityLog } = require('../utils/activityLog');

class CategoryService {
  /**
   * Genera un slug a partir de un nombre
   */
  generateSlug(name) {
    return name
      .toLowerCase()
      .trim()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Elimina acentos
      .replace(/[^a-z0-9 -]/g, '')     // Elimina caracteres especiales
      .replace(/\s+/g, '-')           // Reemplaza espacios por guiones
      .replace(/-+/g, '-');           // Elimina guiones duplicados
  }

  async createCategory(payload, requestIp, adminId) {
    const { nombre, descripcion, icon, color } = payload;

    if (!nombre) throw new Error('El nombre de la categoría es obligatorio.');

    const slug = this.generateSlug(nombre);

    // Verificar si ya existe el nombre o el slug
    const existingName = await CategoryRepository.findOne({ where: { nombre } });
    if (existingName) throw new Error('Ya existe una categoría con ese nombre.');

    const existingSlug = await CategoryRepository.findBySlug(slug);
    if (existingSlug) throw new Error('Ya existe una categoría con un nombre que genera el mismo slug.');

    const category = await CategoryRepository.create({
      nombre,
      slug,
      descripcion: descripcion || '',
      icon: icon || null,
      color: color || null,
      isActive: 1
    });

    await writeActivityLog(null, {
      usuario: adminId,
      modulo: "categorias",
      accion: "crear_categoria",
      descripcion: `Se creó la categoría ${nombre}.`,
      entidad: "tcategorias",
      entidadId: category.id,
      nivel: "info",
      ip: requestIp,
      metadata: { slug, icon, color },
    });

    return category;
  }

  async getAllCategories(includeInactive = false) {
    if (includeInactive) {
      return await CategoryRepository.findAll({ orderBy: { nombre: 'asc' } });
    }
    return await CategoryRepository.findAllActive();
  }

  async getCategoryById(id) {
    const categoryId = Number(id);
    if (!Number.isInteger(categoryId) || categoryId <= 0) {
      throw new Error('Id de categoria invalido.');
    }

    const category = await CategoryRepository.findById(categoryId);
    if (!category) throw new Error('Categoría no encontrada.');
    return category;
  }

  async updateCategory(id, payload, requestIp, adminId) {
    const { nombre, descripcion, icon, color, isActive } = payload;
    const categoryId = Number(id);
    if (!Number.isInteger(categoryId) || categoryId <= 0) {
      throw new Error('Id de categoria invalido.');
    }

    const existing = await CategoryRepository.findById(categoryId);
    if (!existing) throw new Error('Categoría no encontrada.');

    const updateData = {};
    if (nombre !== undefined && nombre !== existing.nombre) {
      updateData.nombre = nombre;
      updateData.slug = this.generateSlug(nombre);
      
      // Verificar unicidad del nuevo nombre/slug
      const duplicate = await CategoryRepository.findOne({ 
        where: { 
          OR: [{ nombre }, { slug: updateData.slug }],
          id: { not: categoryId }
        } 
      });
      if (duplicate) throw new Error('El nombre ya está en uso por otra categoría.');
    }

    if (descripcion !== undefined) updateData.descripcion = descripcion;
    if (icon !== undefined) updateData.icon = icon;
    if (color !== undefined) updateData.color = color;
    if (isActive !== undefined) updateData.isActive = Number(isActive);

    const updated = await CategoryRepository.update(categoryId, updateData);

    await writeActivityLog(null, {
      usuario: adminId,
      modulo: "categorias",
      accion: "actualizar_categoria",
      descripcion: `Se actualizó la categoría ${existing.nombre}.`,
      entidad: "tcategorias",
      entidadId: categoryId,
      nivel: "info",
      ip: requestIp,
      metadata: { antes: existing, despues: updated },
    });

    return updated;
  }

  async deleteCategory(id, requestIp, adminId) {
    const categoryId = Number(id);
    if (!Number.isInteger(categoryId) || categoryId <= 0) {
      throw new Error('Id de categoria invalido.');
    }
    const existing = await CategoryRepository.findById(categoryId);
    if (!existing) throw new Error('Categoría no encontrada.');

    // En lugar de borrar físicamente, desactivamos (Soft Delete)
    await CategoryRepository.update(categoryId, { isActive: 0 });

    await writeActivityLog(null, {
      usuario: adminId,
      modulo: "categorias",
      accion: "desactivar_categoria",
      descripcion: `Se desactivó la categoría ${existing.nombre}.`,
      entidad: "tcategorias",
      entidadId: categoryId,
      nivel: "warning",
      ip: requestIp,
    });

    return true;
  }
}

module.exports = new CategoryService();
