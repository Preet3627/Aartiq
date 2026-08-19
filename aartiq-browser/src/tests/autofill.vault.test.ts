import { AutofillVault } from '../lib/autofill/vault';

describe('AutofillVault — encrypted form filling', () => {
  const fields = [
    { index: 0, name: 'email', type: 'email', autocomplete: 'email' },
    { index: 1, name: 'password', type: 'password' },
    { index: 2, name: 'first_name', autocomplete: 'given-name' },
  ];

  it('matches page fields to stored credentials + profiles', async () => {
    const v = new AutofillVault('supersecret');
    v.unlock();
    await v.addCredential({ domain: 'example.com', username: 'me@example.com', password: 'hunter2' });
    v.addProfile('Default', { firstName: 'Jane', lastName: 'Doe' });
    const matches = v.matchForm('example.com', fields);
    const byIndex = Object.fromEntries(matches.map((m) => [m.fieldIndex, m.value]));
    expect(byIndex[0]).toBe('me@example.com');
    expect(byIndex[1]).toBe('hunter2');
    expect(byIndex[2]).toBe('Jane');
  });

  it('refuses to operate while locked', () => {
    const v = new AutofillVault('x');
    expect(() => v.listCredentials()).toThrow(/locked/);
  });

  it('round-trips through encrypted export/import', async () => {
    const v = new AutofillVault('supersecret');
    v.unlock();
    await v.addCredential({ domain: 'a.com', username: 'u', password: 'p' });
    const blob = await v.exportEncrypted();
    expect(blob.startsWith('E2EE2:')).toBe(true);
    const v2 = await AutofillVault.importEncrypted(blob, 'supersecret');
    expect(v2.getForDomain('a.com')[0].username).toBe('u');
  });
});
