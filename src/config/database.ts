import mongoose from 'mongoose';

export interface DatabaseConnectionResult {
  connected: boolean;
  type: 'mongodb' | 'memory';
}

export const connectDatabase = async (
  uri?: string
): Promise<DatabaseConnectionResult> => {
  const mongoUri = uri || process.env.MONGODB_URI;

  if (!mongoUri) {
    console.log('ℹ️  No MONGODB_URI provided. Defaulting to In-Memory storage.');
    return { connected: false, type: 'memory' };
  }

  try {
    console.log(`Connecting to MongoDB at: ${mongoUri.replace(/:([^:@]+)@/, ':****@')}`);
    await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 4000,
    });
    console.log('✅ Successfully connected to MongoDB database.');
    return { connected: true, type: 'mongodb' };
  } catch (error) {
    console.warn(
      '⚠️  Failed to connect to MongoDB, falling back to In-Memory storage.',
      (error as Error).message
    );
    return { connected: false, type: 'memory' };
  }
};

export const disconnectDatabase = async (): Promise<void> => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
    console.log('MongoDB disconnected.');
  }
};
