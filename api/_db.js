const { MongoClient } = require("mongodb");

let client = null;
let db = null;

async function connectDB() {
  if (db) return db;

  if (!process.env.MONGO_URI) {
    throw new Error("MONGO_URI is not set");
  }

  if (!client) {
    client = new MongoClient(process.env.MONGO_URI, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000
    });
    await client.connect();
  }

  db = client.db("getkey");
  return db;
}

module.exports = { connectDB };
