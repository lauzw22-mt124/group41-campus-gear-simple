const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryReplSet } = require('mongodb-memory-server');
const { connect, disconnect } = require('../database');
const { createApp } = require('../server');
const { seed } = require('../scripts/seed');
const Equipment = require('../models/Equipment');
const Loan = require('../models/Loan');
let repl,
  app,
  counter = 0;
const password = 'Group41-Demo-2026!';
const secret = 'integration-test-only-secret-with-32-characters';
function data(overrides = {}) {
  return {
    assetCode: `TEST-${++counter}`,
    name: 'Projector',
    category: 'projector',
    location: 'Cabinet A',
    description: '',
    ...overrides,
  };
}
async function create(overrides) {
  const r = await request(app).post('/api/equipment').send(data(overrides)).expect(201);
  return r.body.data;
}
async function loan(item, overrides) {
  return request(app)
    .post('/api/loans')
    .send({
      equipmentId: item._id,
      borrowerName: 'Test Borrower',
      borrowerId: 'S41001',
      ...overrides,
    });
}
function csrf(html) {
  const m = html.match(/name="_csrf" value="([a-f0-9]+)"/);
  assert.ok(m, 'CSRF token should be present');
  return m[1];
}
async function signIn(agent) {
  const r = await agent.get('/login').expect(200);
  await agent
    .post('/login')
    .type('form')
    .send({ _csrf: csrf(r.text), username: 'admin41', password })
    .expect(302);
}
before(async () => {
  repl = await MongoMemoryReplSet.create({
    binary: { version: '7.0.24' },
    replSet: { count: 1, storageEngine: 'wiredTiger' },
  });
  await connect(repl.getUri('integration'));
  await seed({ username: 'admin41', password });
  app = createApp({ secret });
});
after(async () => {
  await disconnect();
  if (repl) await repl.stop();
});
test('health and unauthenticated web protection', async () => {
  await request(app).get('/health').expect(200);
  for (const path of ['/equipment', '/equipment/new', '/loans', '/'])
    await request(app).get(path).expect(302).expect('Location', '/login');
});
test('login rejects wrong password, rotates session and logout removes access', async () => {
  const agent = request.agent(app);
  const r = await agent.get('/login');
  await agent
    .post('/login')
    .type('form')
    .send({ _csrf: csrf(r.text), username: 'admin41', password: 'wrong' })
    .expect(401);
  await signIn(agent);
  await agent.get('/').expect(302).expect('Location', '/equipment');
  const home = await agent.get('/equipment').expect(200);
  assert.match(home.text, /Equipment/);
  await agent
    .post('/logout')
    .type('form')
    .send({ _csrf: csrf(home.text) })
    .expect(302);
  await agent.get('/equipment').expect(302);
});
test('missing and multibyte invalid CSRF tokens return 403', async () => {
  const agent = request.agent(app);
  await signIn(agent);
  await agent.post('/equipment').type('form').send(data()).expect(403);
  await agent
    .post('/equipment')
    .type('form')
    .send({ ...data(), _csrf: 'é'.repeat(64) })
    .expect(403);
});
test('all web pages render and web CRUD persists', async () => {
  const agent = request.agent(app);
  await signIn(agent);
  const form = await agent.get('/equipment/new').expect(200);
  const payload = data();
  const made = await agent
    .post('/equipment')
    .type('form')
    .send({ ...payload, _csrf: csrf(form.text) })
    .expect(302);
  const detail = await agent.get(made.headers.location).expect(200);
  const id = made.headers.location.split('/').pop();
  const edit = await agent.get(`${made.headers.location}/edit`).expect(200);
  await agent
    .post(`${made.headers.location}/edit`)
    .type('form')
    .send({ ...payload, name: 'Updated web name', _csrf: csrf(edit.text) })
    .expect(302);
  assert.equal((await Equipment.findById(id)).name, 'Updated web name');
  await agent.get('/equipment?category=projector&status=available').expect(200);
  await agent.get('/loans').expect(200);
  await agent.get(`/loans/new?equipmentId=${id}`).expect(200);
  await agent
    .post(`${made.headers.location}/delete`)
    .type('form')
    .send({ _csrf: csrf(detail.text) })
    .expect(302);
  assert.equal(await Equipment.findById(id), null);
});
test('web borrowing and return update both records', async () => {
  const item = await create();
  const agent = request.agent(app);
  await signIn(agent);
  const form = await agent.get(`/loans/new?equipmentId=${item._id}`);
  await agent
    .post('/loans')
    .type('form')
    .send({
      _csrf: csrf(form.text),
      equipmentId: item._id,
      borrowerName: 'Web User',
      borrowerId: 'WEB41',
      dueAt: '',
      notes: '',
    })
    .expect(302);
  const active = await Loan.findOne({ equipmentId: item._id });
  assert.equal((await Equipment.findById(item._id)).status, 'borrowed');
  const history = await agent.get('/loans?borrower=WEB41').expect(200);
  assert.match(history.text, /Web User/);
  await agent
    .post(`/loans/${active.id}/return`)
    .type('form')
    .send({ _csrf: csrf(history.text) })
    .expect(302);
  assert.equal((await Equipment.findById(item._id)).status, 'available');
});
test('REST equipment CRUD uses required methods and returns actual data', async () => {
  const item = await create();
  await request(app).get(`/api/equipment/${item._id}`).expect(200);
  await request(app)
    .put(`/api/equipment/${item._id}`)
    .send({
      assetCode: item.assetCode,
      name: 'Updated API name',
      category: 'tripod',
      location: 'Cabinet B',
    })
    .expect(200);
  const r = await request(app).get(`/api/equipment/${item._id}`);
  assert.equal(r.body.data.name, 'Updated API name');
  await request(app).delete(`/api/equipment/${item._id}`).expect(204);
  await request(app).get(`/api/equipment/${item._id}`).expect(404);
});
test('duplicate asset code, forbidden status edit and bad categories are rejected', async () => {
  const item = await create();
  await request(app)
    .post('/api/equipment')
    .send(data({ assetCode: item.assetCode }))
    .expect(409);
  await request(app)
    .put(`/api/equipment/${item._id}`)
    .send(data({ status: 'borrowed' }))
    .expect(400);
  await request(app)
    .post('/api/equipment')
    .send(data({ category: 'unknown' }))
    .expect(400);
  assert.equal((await Equipment.findById(item._id)).status, 'available');
});
test('filters combine category, status and literal search; query injection rejected', async () => {
  const item = await create({ name: 'Literal [test].*', category: 'tripod' });
  const r = await request(app)
    .get('/api/equipment')
    .query({ q: '[test].*', category: 'tripod', status: 'available' })
    .expect(200);
  assert.deepEqual(
    r.body.data.map((x) => x._id),
    [item._id],
  );
  await request(app).get('/api/equipment?q[$ne]=x').expect(400);
  await request(app).get('/api/equipment?status=bad').expect(400);
});
test('maintenance blocks lending and allows return to available', async () => {
  const item = await create();
  await request(app)
    .put(`/api/equipment/${item._id}/maintenance`)
    .send({ status: 'maintenance' })
    .expect(200);
  assert.equal((await loan(item)).status, 409);
  await request(app).delete(`/api/equipment/${item._id}`).expect(409);
  await request(app)
    .put(`/api/equipment/${item._id}/maintenance`)
    .send({ status: 'available' })
    .expect(200);
  assert.equal((await loan(item)).status, 201);
  await request(app)
    .put(`/api/equipment/${item._id}/maintenance`)
    .send({ status: 'maintenance' })
    .expect(409);
});
test('borrow, borrower search, return, duplicate return and history protection', async () => {
  const item = await create();
  const made = await loan(item, { borrowerId: 'UNIQUE41' });
  assert.equal(made.status, 201);
  assert.equal((await Equipment.findById(item._id)).status, 'borrowed');
  const r = await request(app).get('/api/loans?borrower=UNIQUE41&status=active');
  assert.equal(r.body.data.length, 1);
  await request(app).put(`/api/loans/${made.body.data._id}/return`).send({}).expect(200);
  const returned = await Loan.findById(made.body.data._id);
  assert.equal(returned.status, 'returned');
  assert.ok(returned.returnedAt);
  assert.equal((await Equipment.findById(item._id)).status, 'available');
  await request(app).put(`/api/loans/${returned.id}/return`).send({}).expect(409);
  const del = await request(app).delete(`/api/equipment/${item._id}`).expect(409);
  assert.equal(del.body.error.code, 'HAS_LOAN_HISTORY');
});
test('concurrent checkout produces exactly one active loan', async () => {
  const item = await create();
  const results = await Promise.all(Array.from({ length: 6 }, () => loan(item)));
  assert.equal(results.filter((r) => r.status === 201).length, 1);
  assert.ok(results.every((r) => [201, 409].includes(r.status)));
  assert.equal(await Loan.countDocuments({ equipmentId: item._id, status: 'active' }), 1);
  assert.equal((await Equipment.findById(item._id)).status, 'borrowed');
});
test('unique active-loan index and transaction rollback protect both records', async () => {
  const item = await create();
  const fields = {
    equipmentId: item._id,
    borrowerName: 'Existing',
    borrowerId: 'X',
  };
  await Loan.create(fields);
  await assert.rejects(Loan.create(fields), (e) => e.code === 11000);
  const r = await loan(item);
  assert.equal(r.status, 409);
  assert.equal(
    (await Equipment.findById(item._id)).status,
    'available',
    'failed insert must roll back status',
  );
});
test('inconsistent return rolls back the loan update', async () => {
  const item = await create();
  const record = await Loan.create({
    equipmentId: item._id,
    borrowerName: 'Legacy',
    borrowerId: 'Y',
  });
  await request(app).put(`/api/loans/${record.id}/return`).send({}).expect(409);
  assert.equal((await Loan.findById(record.id)).status, 'active');
  assert.equal((await Loan.findById(record.id)).returnedAt, null);
});
test('parallel borrow/delete never leaves a dangling loan', async () => {
  const item = await create();
  const [borrow, del] = await Promise.all([
    loan(item),
    request(app).delete(`/api/equipment/${item._id}`),
  ]);
  assert.ok([201, 404].includes(borrow.status));
  assert.ok([204, 409].includes(del.status));
  if (borrow.status === 201) assert.ok(await Equipment.findById(item._id));
  else assert.equal(await Loan.countDocuments({ equipmentId: item._id }), 0);
});
test('invalid IDs, invalid dates, malformed JSON, wrong content type and unknown API', async () => {
  await request(app).get('/api/equipment/bad').expect(400);
  await request(app).get('/api/equipment/000000000000000000000000').expect(404);
  const item = await create();
  assert.equal((await loan(item, { dueAt: 'not-a-date' })).status, 400);
  assert.equal((await loan(item, { dueAt: '2000-01-01T00:00:00Z' })).status, 400);
  await request(app)
    .post('/api/equipment')
    .set('Content-Type', 'application/json')
    .send('{')
    .expect(400);
  await request(app).post('/api/equipment').type('form').send(data()).expect(415);
  await request(app).get('/api/nope').expect(404);
});
test('EJS escapes user-supplied markup', async () => {
  const item = await create({ name: '<script>alert(1)</script>' });
  const agent = request.agent(app);
  await signIn(agent);
  const r = await agent.get(`/equipment/${item._id}`).expect(200);
  assert.ok(r.text.includes('&lt;script&gt;'));
  assert.ok(!r.text.includes('<script>alert(1)</script>'));
});
test('optional API authentication mode rejects anonymous clients', async () => {
  const protectedApp = createApp({ secret, apiAuthRequired: true });
  await request(protectedApp).get('/api/equipment').expect(401);
  const agent = request.agent(protectedApp);
  await signIn(agent);
  await agent.get('/api/equipment').expect(200);
});
test('seed is idempotent and does not reset a changed device', async () => {
  await Equipment.updateOne({ assetCode: 'PROJ-001' }, { status: 'maintenance' });
  await seed({ username: 'admin41', password });
  assert.equal(await Equipment.countDocuments({ assetCode: 'PROJ-001' }), 1);
  assert.equal((await Equipment.findOne({ assetCode: 'PROJ-001' })).status, 'maintenance');
});

test('MongoDB session store retains login across application instances', async () => {
  const MongoStore = require('connect-mongo');
  const options = {
    client: mongoose.connection.getClient(),
    collectionName: 'test_sessions',
  };
  const firstApp = createApp({ secret, store: MongoStore.create(options) });
  const agent = request.agent(firstApp);
  const page = await agent.get('/login').expect(200);
  const login = await agent
    .post('/login')
    .type('form')
    .send({
      _csrf: csrf(page.text),
      username: 'admin41',
      password,
    })
    .expect(302);
  const cookie = login.headers['set-cookie'].map((value) => value.split(';')[0]).join('; ');
  const restartedApp = createApp({ secret, store: MongoStore.create(options) });
  await request(restartedApp).get('/equipment').set('Cookie', cookie).expect(200);
});
