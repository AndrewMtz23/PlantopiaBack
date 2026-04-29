const BaseRepository = require('./BaseRepository');

class UserRepository extends BaseRepository {
  constructor() {
    super('tusuarios');
  }

  async findByEmail(email) {
    return await this.findOne({
      where: { correo: email }
    });
  }

  async getProfile(id) {
    return await this.findById(id, {
      select: {
        id: true,
        estatus: true,
        tipo: true,
        nombre: true,
        fechaNacimiento: true,
        genero: true,
        telefono: true,
        correo: true,
        domicilio: true,
        ciudad: true,
        estadoDireccion: true,
        codigoPostal: true,
        referenciasDomicilio: true,
        latitud: true,
        longitud: true,
        fotoPerfil: true,
      }
    });
  }
}

module.exports = new UserRepository();
