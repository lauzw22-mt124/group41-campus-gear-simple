const { test } = require('node:test');
const assert = require('node:assert/strict');
const { mkdtemp, rm } = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');
const request = require('supertest');
const db = require('../database');
const { createApp } = require('../server');
const { seed } = require('../scripts/seed');
const Equipment = require('../models/Equipment');
const Loan = require('../models/Loan');

test('local MongoDB keeps equipment and active loans after stopping and restarting', async (t) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'group41-persistence-'));
  t.after(async () => {
    await db.disconnect();
    await rm(directory, { recursive: true, force: true });
  });
  const probe = net.createServer();
  await new Promise((resolve, reject) => {
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', resolve);
  });
  const port = probe.address().port;
  await new Promise((resolve) => probe.close(resolve));
  const credentials = { username: 'admin41', password: 'Local-Persistence-Test-41!' };
  await db.connectLocal({ directory, port });
  await seed(credentials);
  const app = createApp({ secret: 'local-persistence-test-secret-0123456789' });
  const item = await Equipment.findOne({ assetCode: 'PROJ-001' });
  await Equipment.updateOne({ _id: item.id }, { location: 'Saved on this computer' });
  const borrowed = await request(app)
    .post('/api/loans')
    .send({
      equipmentId: item.id,
      borrowerName: 'Local Test',
      borrowerId: 'LOCAL41',
    })
    .expect(201);

  await db.disconnect();
  await db.connectLocal({ directory, port });
  await seed(credentials); // Startup seed must preserve the saved loan and edits.
  const saved = await Equipment.findById(item.id);
  assert.equal(saved.location, 'Saved on this computer');
  assert.equal(saved.status, 'borrowed');
  assert.equal(await Equipment.countDocuments({ assetCode: 'PROJ-001' }), 1);
  assert.equal((await Loan.findById(borrowed.body.data._id)).status, 'active');
  await request(app)
    .post('/api/loans')
    .send({
      equipmentId: item.id,
      borrowerName: 'Second Test',
      borrowerId: 'LOCAL42',
    })
    .expect(409);
  await request(app).put(`/api/loans/${borrowed.body.data._id}/return`).send({}).expect(200);
  assert.equal((await Equipment.findById(item.id)).status, 'available');
});
