require('dotenv').config({ path: require('node:path').join(__dirname, '..', '.env') });
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Equipment = require('../models/Equipment');
const db = require('../database');

async function seed({ username, password }) {
  if (!username || !password || password.length < 12 || password.startsWith('replace-')) {
    throw new Error('Set ADMIN_USERNAME and your own ADMIN_PASSWORD (at least 12 characters).');
  }
  // Re-running seed inserts missing data only; it never resets passwords or loan states.
  await User.updateOne(
    { username },
    {
      $setOnInsert: {
        username,
        passwordHash: await bcrypt.hash(password, 12),
        displayName: 'Group41 Administrator',
      },
    },
    { upsert: true },
  );
  const samples = [
    ['PROJ-001', 'Epson Portable Projector', 'projector', 'HKMU / C0G01', 'available'],
    [
      'MIC-001',
      'Wireless Handheld Microphone',
      'microphone',
      'JCPC / D0625',
      'maintenance',
    ],
    ['TRI-001', 'Camera Tripod', 'tripod', 'IOH / F0401', 'available'],
    ['MIC-002', 'Conference Microphone', 'microphone', 'HPLC / H002', 'available'],
  ];
  for (const [assetCode, name, category, location, status] of samples) {
    await Equipment.updateOne(
      { assetCode },
      {
        $setOnInsert: {
          assetCode,
          name,
          category,
          location,
          status,
          description: 'Fictional demonstration equipment',
        },
      },
      { upsert: true },
    );
  }
}

if (require.main === module) {
  db.connectLocal()
    .then(() =>
      seed({ username: process.env.ADMIN_USERNAME, password: process.env.ADMIN_PASSWORD }),
    )
    .then(() => console.log('Seed complete. Existing data was preserved.'))
    .catch((err) => {
      console.error(err.message);
      process.exitCode = 1;
    })
    .finally(() => db.disconnect());
}
module.exports = { seed };
