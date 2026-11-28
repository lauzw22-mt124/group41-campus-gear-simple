/**
 * Database lifecycle.
 * `connect` attaches Mongoose to a MongoDB replica set and builds indexes;
 * `connectLocal` starts a real, persistent local mongod process through
 * `mongodb-memory-server`; `disconnect` stops both without deleting data.
 */

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { mkdir } = require('node:fs/promises');
const path = require('node:path');
let localServer;
const Equipment = require('./models/Equipment');
const Loan = require('./models/Loan');
const User = require('./models/User');

/**
 * Connects Mongoose to a replica set and initialises model indexes.
 * @param {string} uri MongoDB connection URI.
 * @returns {Promise<void>}
 */
async function connect(uri) {
  if (!uri) throw new Error('A MongoDB connection URI is required.');
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
  const hello = await mongoose.connection.db.admin().command({ hello: 1 });
  if (!hello.setName && hello.msg !== 'isdbgrid') {
    await mongoose.disconnect();
    throw new Error('Use a MongoDB replica set. Transactions require it.');
  }
  // Indexes must exist before the first checkout request is served.
  await Promise.all([Equipment.init(), Loan.init(), User.init()]);
}

/**
 * Starts a real MongoDB process with persistent disk storage.
 * @param {{directory?: string, port?: number}} [options]
 *   Data directory root and MongoDB port.
 * @returns {Promise<void>}
 */
async function connectLocal({
  directory = path.join(__dirname, '.local-data'),
  port = 27041,
} = {}) {
  const dbPath = path.join(directory, 'mongodb');
  await mkdir(dbPath, { recursive: true });
  localServer = new MongoMemoryServer({
    binary: {
      version: '7.0.24',
      downloadDir: process.env.MONGOMS_DOWNLOAD_DIR || path.join(__dirname, '.cache', 'mongodb'),
    },
    instance: {
      ip: '127.0.0.1',
      port,
      portGeneration: false,
      dbPath,
      storageEngine: 'wiredTiger',
      replSet: 'group41',
    },
  });
  await localServer.start();
  const uri = localServer.getUri('group41');
  const client = new mongoose.mongo.MongoClient(uri, { directConnection: true });
  try {
    await client.connect();
    try {
      await client.db('admin').command({
        replSetInitiate: { _id: 'group41', members: [{ _id: 0, host: `127.0.0.1:${port}` }] },
      });
    } catch (err) {
      if (err.code !== 23) throw err; // AlreadyInitialized: keep the existing replica set.
    }
  } finally {
    await client.close();
  }
  await connect(`${uri}?replicaSet=group41`);
}

/**
 * Stops Mongoose and the local mongod, keeping the data directory intact.
 * @returns {Promise<void>}
 */
async function disconnect() {
  await mongoose.disconnect();
  if (localServer) {
    await localServer.stop({ doCleanup: false, force: false });
    localServer = undefined;
  }
}

module.exports = { connect, connectLocal, disconnect };
