const mongoose = require('mongoose');

const connectTestDb = async () => {
  await mongoose.connect(process.env.MONGO_URI);
};

const resetDb = async () => {
  const collections = await mongoose.connection.db.collections();
  for (const collection of collections) {
    await collection.deleteMany({});
  }
};

const disconnectTestDb = async () => {
  await mongoose.disconnect();
};

module.exports = { connectTestDb, resetDb, disconnectTestDb };
