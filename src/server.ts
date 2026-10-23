import dotenv from 'dotenv';
dotenv.config();

import { createApp } from './app';
import { connectDatabase, disconnectDatabase } from './config/database';
import { MongoCouponRepository } from './repositories/MongoCouponRepository';
import { InMemoryCouponRepository } from './repositories/InMemoryCouponRepository';
import { ICouponRepository } from './repositories/ICouponRepository';

const PORT = parseInt(process.env.PORT || '5001', 10);

async function bootstrap() {
  console.log('🚀 Starting Coupon API Server...');

  let repository: ICouponRepository;
  let storageType: 'mongodb' | 'memory' = 'memory';

  if (process.env.STORAGE_TYPE === 'memory') {
    console.log('📦 Explicitly using In-Memory Coupon Repository (STORAGE_TYPE=memory)');
    repository = new InMemoryCouponRepository();
    storageType = 'memory';
  } else {
    const dbResult = await connectDatabase();
    if (dbResult.connected) {
      repository = new MongoCouponRepository();
      storageType = 'mongodb';
    } else {
      repository = new InMemoryCouponRepository();
      storageType = 'memory';
    }
  }

  // Pre-seed a sample coupon for testing convenience if in-memory or empty
  const initialCoupons = await repository.findAll();
  if (initialCoupons.length === 0) {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 30);

    const expiredDate = new Date();
    expiredDate.setDate(expiredDate.getDate() - 5);

    await repository.create({
      code: 'WELCOME20',
      discount: 20,
      expiryDate: futureDate,
    });

    await repository.create({
      code: 'SUMMER50',
      discount: 50,
      expiryDate: futureDate,
    });

    await repository.create({
      code: 'EXPIRED10',
      discount: 10,
      expiryDate: expiredDate,
    });

    console.log('🌱 Seeded 3 initial coupons (WELCOME20 [20%], SUMMER50 [50%], EXPIRED10 [Expired])');
  }

  const app = createApp({ repository, storageType });

  const server = app.listen(PORT, () => {
    console.log(`\n=================================================`);
    console.log(`🚀 Coupon API server running on: http://localhost:${PORT}`);
    console.log(`🗄️  Active Storage: ${storageType.toUpperCase()}`);
    console.log(`📡 Endpoints available:`);
    console.log(`   - POST http://localhost:${PORT}/coupons`);
    console.log(`   - GET  http://localhost:${PORT}/coupons`);
    console.log(`   - POST http://localhost:${PORT}/coupons/apply`);
    console.log(`   - GET  http://localhost:${PORT}/health`);
    console.log(`=================================================\n`);
  });

  const shutdown = async () => {
    console.log('\n🛑 Gracefully shutting down...');
    server.close(async () => {
      await disconnectDatabase();
      console.log('HTTP server closed.');
      process.exit(0);
    });
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

bootstrap().catch((err) => {
  console.error('Fatal Server Bootstrap Error:', err);
  process.exit(1);
});
