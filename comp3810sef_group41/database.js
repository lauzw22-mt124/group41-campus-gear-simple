const mongoose = require('mongoose');
const Equipment = require('./models/Equipment');
const Loan = require('./models/Loan');
const User = require('./models/User');

async function connect(uri) {
  if (!uri) throw new Error('Set MONGODB_URI in .env. See README.md.');
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
  const hello = await mongoose.connection.db.admin().command({ hello: 1 });
  if (!hello.setName && hello.msg !== 'isdbgrid') {
    await mongoose.disconnect();
    throw new Error('Use a MongoDB replica set (Atlas works). Transactions require it.');
  }
  // Build the unique indexes before accepting a checkout request.
  await Promise.all([Equipment.init(), Loan.init(), User.init()]);
}

module.exports = { connect, disconnect: () => mongoose.disconnect() };
