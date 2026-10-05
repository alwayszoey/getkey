const { MongoClient } = require("mongodb");

let cachedClient = null;
let cachedDb = null;

async function connectDB() {
  if (cachedDb) return cachedDb;

  if (!process.env.MONGO_URI) {
    throw new Error("MONGO_URI is not set");
  }

  if (!cachedClient) {
    cachedClient = new MongoClient(process.env.MONGO_URI, {
      maxPoolSize: 10
    });
    await cachedClient.connect();
  }

  cachedDb = cachedClient.db("getkey");
  return cachedDb;
}

module.exports = { connectDB };
