import { expect, test } from 'bun:test';
import { automaticSosScope } from '../../apps/web/src/lib/sos-auto-scope';
test('automatic source scope follows exact county labels without deriving IDs or summing', () => {
  const scopes = [{ id: 'odd-id', name: ' Bibb County ' }, { id: 'monroe', name: 'Monroe' }, { id: 'state', name: 'Statewide' }];
  expect(automaticSosScope('13021', scopes)).toBe('odd-id');
  expect(automaticSosScope('13207', scopes)).toBe('monroe');
  expect(automaticSosScope('all', scopes)).toBe('state');
  expect(automaticSosScope('13001', scopes)).toBe('');
  expect(automaticSosScope('all', scopes.slice(0, 2))).toBe('');
  expect(automaticSosScope('13021', [...scopes, { id: 'duplicate', name: 'Bibb' }])).toBe('');
  expect(automaticSosScope('unknown', scopes)).toBe('');
});
