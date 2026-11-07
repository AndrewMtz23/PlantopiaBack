const test = require('node:test');
const assert = require('node:assert/strict');
const { userSchema } = require('../src/modules/identity/userSchemas');
const profile = {
  nombre: 'Cliente Ejemplo', correo: 'cliente@example.test',
  fechaNacimiento: '1990-01-01', genero: 'otro', domicilio: 'Calle Prueba 123',
};

test('profile and registration accept formatted ten-digit phone numbers', () => {
  for (const telefono of ['4421234567', '(442) 123-4567', '442 123 4567', '442-123-4567']) {
    for (const options of [{}, { create: true }, { admin: true, create: true }]) {
      const payload = { ...profile, telefono, ...(options.create ? { clave: 'Password123!' } : {}) };
      assert.equal(userSchema(payload, options).telefono, '4421234567');
      assert.equal(payload.telefono, telefono);
    }
  }
});

test('phone formatting does not allow letters, country codes or wrong lengths', () => {
  for (const telefono of ['442abc1234567', '+52 4421234567', '442123456', '44212345678', '', null, 4421234567]) {
    assert.throws(() => userSchema({ ...profile, telefono }), { code: 'INVALID_INPUT' });
  }
});
