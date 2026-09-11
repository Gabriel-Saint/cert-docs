import { InvalidCpfError } from '../errors';
import { Cpf } from './cpf';

describe('Cpf (Value Object)', () => {
  it('normaliza e expõe os formatos', () => {
    const cpf = Cpf.create('529.982.247-25');

    expect(cpf.toString()).toBe('52998224725');
    expect(cpf.formatted()).toBe('529.982.247-25');
    expect(cpf.masked()).toBe('529.***.***-25');
    expect(cpf.partial()).toBe('529-25');
  });

  it.each(['52998224724', '000.000.000-00', '123', ''])(
    'lança InvalidCpfError para %p',
    (raw) => {
      expect(() => Cpf.create(raw)).toThrow(InvalidCpfError);
    },
  );

  it('compara por valor', () => {
    expect(Cpf.create('52998224725').equals(Cpf.create('529.982.247-25'))).toBe(
      true,
    );
    expect(Cpf.create('52998224725').equals(Cpf.create('11144477735'))).toBe(
      false,
    );
  });
});
