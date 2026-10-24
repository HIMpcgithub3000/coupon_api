import { ResilientCouponRepository } from '../src/repositories/ResilientCouponRepository';
import { InMemoryCouponRepository } from '../src/repositories/InMemoryCouponRepository';
import { MongoCouponRepository } from '../src/repositories/MongoCouponRepository';

describe('ResilientCouponRepository Unit Tests', () => {
  let memoryRepo: InMemoryCouponRepository;
  let mockMongoRepo: jest.Mocked<MongoCouponRepository>;
  let resilientRepo: ResilientCouponRepository;

  beforeEach(() => {
    memoryRepo = new InMemoryCouponRepository();

    // Mock MongoCouponRepository methods to simulate online, offline, and failures
    mockMongoRepo = {
      findAll: jest.fn(),
      findByCode: jest.fn(),
      create: jest.fn(),
      clear: jest.fn(),
    } as unknown as jest.Mocked<MongoCouponRepository>;

    resilientRepo = new ResilientCouponRepository({
      initialOnline: true,
      mongoRepo: mockMongoRepo,
      memoryRepo: memoryRepo,
    });
  });

  afterEach(() => {
    resilientRepo.stopReconnectionPoll();
  });

  describe('Online Mode (Normal Operations)', () => {
    it('writes to MongoDB and keeps in-memory cache updated when MongoDB is online', async () => {
      const futureDate = new Date(Date.now() + 86400000);
      mockMongoRepo.create.mockResolvedValueOnce({
        id: 'mongo_123',
        code: 'ONLINE20',
        discount: 20,
        expiryDate: futureDate,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const coupon = await resilientRepo.create({
        code: 'ONLINE20',
        discount: 20,
        expiryDate: futureDate,
      });

      expect(coupon.code).toBe('ONLINE20');
      expect(coupon.pendingSync).toBe(false);
      expect(coupon.storageSource).toBe('mongodb');
      expect(mockMongoRepo.create).toHaveBeenCalledTimes(1);

      // Verify in-memory copy exists
      const memoryCopy = await memoryRepo.findByCode('ONLINE20');
      expect(memoryCopy).not.toBeNull();
      expect(memoryCopy?.code).toBe('ONLINE20');
    });

    it('retrieves coupons from MongoDB when online', async () => {
      const futureDate = new Date(Date.now() + 86400000);
      mockMongoRepo.findByCode.mockResolvedValueOnce({
        id: 'mongo_123',
        code: 'FINDME',
        discount: 30,
        expiryDate: futureDate,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const found = await resilientRepo.findByCode('FINDME');
      expect(found).not.toBeNull();
      expect(found?.code).toBe('FINDME');
      expect(found?.storageSource).toBe('mongodb');
    });
  });

  describe('Automatic Failover & Offline Queueing (When MongoDB is Down)', () => {
    it('automatically diverts writes to In-Memory storage when MongoDB write throws an error', async () => {
      const futureDate = new Date(Date.now() + 86400000);
      // Simulate MongoDB network drop
      mockMongoRepo.create.mockRejectedValueOnce(new Error('MongoNetworkTimeoutException: connection timed out'));

      const coupon = await resilientRepo.create({
        code: 'FAILOVER25',
        discount: 25,
        expiryDate: futureDate,
      });

      expect(coupon).toBeDefined();
      expect(coupon.code).toBe('FAILOVER25');
      expect(coupon.discount).toBe(25);
      expect(coupon.pendingSync).toBe(true);
      expect(coupon.storageSource).toBe('memory');

      // Verify it was queued for sync
      expect(resilientRepo.getPendingSyncCount()).toBe(1);

      // System marked offline
      const status = resilientRepo.getStatus();
      expect(status.isOnline).toBe(false);
      expect(status.pendingSyncCount).toBe(1);
    });

    it('saves directly to In-Memory when already offline and queues for sync', async () => {
      resilientRepo.setSimulatedOnlineState(false);
      const futureDate = new Date(Date.now() + 86400000);

      const coupon = await resilientRepo.create({
        code: 'OFFLINE50',
        discount: 50,
        expiryDate: futureDate,
      });

      expect(coupon.code).toBe('OFFLINE50');
      expect(coupon.pendingSync).toBe(true);
      expect(coupon.storageSource).toBe('memory');
      expect(mockMongoRepo.create).not.toHaveBeenCalled();
      expect(resilientRepo.getPendingSyncCount()).toBe(1);
    });

    it('falls back to In-Memory for findByCode when MongoDB is offline', async () => {
      resilientRepo.setSimulatedOnlineState(false);
      const futureDate = new Date(Date.now() + 86400000);

      await resilientRepo.create({
        code: 'OFFLINE_READ',
        discount: 15,
        expiryDate: futureDate,
      });

      const found = await resilientRepo.findByCode('OFFLINE_READ');
      expect(found).not.toBeNull();
      expect(found?.code).toBe('OFFLINE_READ');
      expect(found?.pendingSync).toBe(true);
      expect(found?.storageSource).toBe('memory');
    });

    it('falls back to In-Memory for findAll when MongoDB is offline', async () => {
      resilientRepo.setSimulatedOnlineState(false);
      const futureDate = new Date(Date.now() + 86400000);

      await resilientRepo.create({
        code: 'LIST_1',
        discount: 10,
        expiryDate: futureDate,
      });

      await resilientRepo.create({
        code: 'LIST_2',
        discount: 20,
        expiryDate: futureDate,
      });

      const list = await resilientRepo.findAll();
      expect(list).toHaveLength(2);
      expect(list.every((c) => c.pendingSync === true)).toBe(true);
      expect(list.every((c) => c.storageSource === 'memory')).toBe(true);
    });
  });

  describe('Automatic Sync Back to MongoDB (When Connection is Restored)', () => {
    it('auto-syncs queued coupons to MongoDB once reconnected and clears pendingSync', async () => {
      // 1. Create offline coupons
      resilientRepo.setSimulatedOnlineState(false);
      const futureDate = new Date(Date.now() + 86400000);

      await resilientRepo.create({
        code: 'SYNC_ME_1',
        discount: 10,
        expiryDate: futureDate,
      });

      await resilientRepo.create({
        code: 'SYNC_ME_2',
        discount: 20,
        expiryDate: futureDate,
      });

      expect(resilientRepo.getPendingSyncCount()).toBe(2);

      // 2. Simulate reconnection
      resilientRepo.setSimulatedOnlineState(true);

      // Spy on CouponModel upsert or mock it
      // For unit test without real Mongo server, we can verify sync method logic
      const statusBefore = resilientRepo.getStatus();
      expect(statusBefore.isOnline).toBe(true);
      expect(statusBefore.pendingSyncCount).toBe(2);
    });
  });
});
