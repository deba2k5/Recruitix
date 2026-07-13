import { MongoClient, GridFSBucket } from 'mongodb';

const DB_NAME = 'recruitix';

// Cached across invocations — required for correctness on serverless (Vercel), where
// reconnecting on every request would quickly exhaust Atlas's connection limit.
let clientPromise = null;

function getClientPromise() {
  if (!clientPromise) {
    const uri = process.env.MONGODB_URI;
    if (!uri) {
      throw new Error('Missing MONGODB_URI environment variable.');
    }
    clientPromise = new MongoClient(uri).connect();
  }
  return clientPromise;
}

export async function getDb() {
  const client = await getClientPromise();
  return client.db(DB_NAME);
}

export async function getSnapshotBucket() {
  const db = await getDb();
  return new GridFSBucket(db, { bucketName: 'snapshots' });
}
