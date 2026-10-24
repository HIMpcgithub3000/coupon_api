import mongoose from 'mongoose';
import { ICoupon } from '../types/coupon.types';
import {
  ICouponRepository,
  CreateCouponRepositoryInput,
  StorageStatus,
} from './ICouponRepository';
import { MongoCouponRepository } from './MongoCouponRepository';
import { InMemoryCouponRepository } from './InMemoryCouponRepository';
import { CouponModel } from '../models/coupon.model';

export class ResilientCouponRepository implements ICouponRepository {
  private mongoRepo: MongoCouponRepository;
  private memoryRepo: InMemoryCouponRepository;
  private pendingSyncCodes: Set<string> = new Set();
  private isOnline: boolean = false;
  private mongoUri?: string;
  private reconnectTimer?: NodeJS.Timeout;
  private isReconnecting: boolean = false;

  constructor(options?: {
    mongoUri?: string;
    initialOnline?: boolean;
    reconnectIntervalMs?: number;
    mongoRepo?: MongoCouponRepository;
    memoryRepo?: InMemoryCouponRepository;
  }) {
    this.mongoRepo = options?.mongoRepo || new MongoCouponRepository();
    this.memoryRepo = options?.memoryRepo || new InMemoryCouponRepository();
    this.mongoUri = options?.mongoUri || process.env.MONGODB_URI;
    this.isOnline = options?.initialOnline ?? (mongoose.connection.readyState === 1);

    this.setupConnectionListeners();

    // Start background health polling / reconnection timer if MongoDB URI is configured
    if (this.mongoUri) {
      const intervalMs = options?.reconnectIntervalMs ?? 5000;
      this.startReconnectionPoll(intervalMs);
    }
  }

  /**
   * Listen to Mongoose connection lifecycle events
   */
  private setupConnectionListeners(): void {
    mongoose.connection.on('connected', () => {
      this.isOnline = true;
      console.log('🟢 [ResilientStorage] MongoDB connected. Primary storage active.');
      this.warmCache().catch(() => {});
      this.syncPendingToMongo().catch((err) => {
        console.error('⚠️ [ResilientStorage] Error during auto-sync:', err.message);
      });
    });

    mongoose.connection.on('disconnected', () => {
      this.isOnline = false;
      console.warn('🟡 [ResilientStorage] MongoDB disconnected! Failing over to In-Memory storage without downtime.');
    });

    mongoose.connection.on('reconnected', () => {
      this.isOnline = true;
      console.log('🟢 [ResilientStorage] MongoDB reconnected! Syncing offline queue to database...');
      this.syncPendingToMongo().catch((err) => {
        console.error('⚠️ [ResilientStorage] Error during reconnection auto-sync:', err.message);
      });
    });

    mongoose.connection.on('error', (err) => {
      this.isOnline = false;
      console.warn('⚠️ [ResilientStorage] MongoDB error:', err.message);
    });
  }

  /**
   * Background health polling that periodically checks connectivity and attempts reconnection
   */
  private startReconnectionPoll(intervalMs: number): void {
    this.reconnectTimer = setInterval(async () => {
      const state = mongoose.connection.readyState;
      if (state === 1) {
        if (!this.isOnline) {
          this.isOnline = true;
          await this.syncPendingToMongo();
        }
        return;
      }

      this.isOnline = false;

      if (!this.isReconnecting && this.mongoUri) {
        this.isReconnecting = true;
        try {
          await mongoose.connect(this.mongoUri, {
            serverSelectionTimeoutMS: 3000,
          });
          this.isOnline = true;
          console.log('✅ [ResilientStorage] Reconnected to MongoDB via background health check.');
          await this.syncPendingToMongo();
        } catch {
          // Reconnection failed; will retry on next poll. System continues seamlessly on In-Memory.
        } finally {
          this.isReconnecting = false;
        }
      }
    }, intervalMs);

    // Unref timer so it doesn't prevent Node process from exiting
    if (this.reconnectTimer.unref) {
      this.reconnectTimer.unref();
    }
  }

  stopReconnectionPoll(): void {
    if (this.reconnectTimer) {
      clearInterval(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }
  }

  /**
   * Pre-warm in-memory cache with existing coupons from MongoDB
   */
  async warmCache(): Promise<void> {
    if (!this.isOnline) return;
    try {
      const mongoCoupons = await this.mongoRepo.findAll();
      for (const coupon of mongoCoupons) {
        this.memoryRepo.upsert({
          ...coupon,
          pendingSync: false,
          storageSource: 'mongodb',
        });
      }
    } catch {
      // Ignore cache warming errors
    }
  }

  /**
   * Create Coupon with Automatic Failover and Offline Queueing
   */
  async create(data: CreateCouponRepositoryInput): Promise<ICoupon> {
    const normalizedCode = data.code.trim().toUpperCase();

    // 1. Always write to in-memory store immediately
    const memoryCoupon = await this.memoryRepo.create(data);

    // 2. If MongoDB is currently online, attempt write to MongoDB
    if (this.isOnline) {
      try {
        const mongoCoupon = await this.mongoRepo.create(data);
        const syncedCoupon: ICoupon = {
          ...mongoCoupon,
          pendingSync: false,
          storageSource: 'mongodb',
        };
        this.memoryRepo.upsert(syncedCoupon);
        return syncedCoupon;
      } catch (err: any) {
        // If it was a duplicate key error, rethrow so API returns 409 Conflict
        if (err.code === 11000) {
          throw err;
        }

        // If it was a database connection drop / timeout:
        this.isOnline = false;
        console.warn(
          `⚠️ [ResilientStorage] MongoDB write failed (${err.message}). Diverting coupon '${normalizedCode}' to In-Memory and queuing for auto-sync.`
        );
      }
    }

    // 3. Offline / Failover Path: Mark as pending sync
    this.pendingSyncCodes.add(normalizedCode);
    const offlineCoupon: ICoupon = {
      ...memoryCoupon,
      pendingSync: true,
      storageSource: 'memory',
    };
    this.memoryRepo.upsert(offlineCoupon);
    console.log(`📦 [ResilientStorage] Coupon '${normalizedCode}' saved in-memory (queued for sync).`);
    return offlineCoupon;
  }

  /**
   * Find Coupon by Code with Failover
   */
  async findByCode(code: string): Promise<ICoupon | null> {
    const normalizedCode = code.trim().toUpperCase();

    // 1. If online, attempt MongoDB lookup first
    if (this.isOnline) {
      try {
        const mongoDoc = await this.mongoRepo.findByCode(normalizedCode);
        if (mongoDoc) {
          return {
            ...mongoDoc,
            pendingSync: false,
            storageSource: 'mongodb',
          };
        }
      } catch (err: any) {
        this.isOnline = false;
        console.warn(`⚠️ [ResilientStorage] MongoDB find failed (${err.message}). Failing over to in-memory.`);
      }
    }

    // 2. Fall back to In-Memory lookup
    const memoryDoc = await this.memoryRepo.findByCode(normalizedCode);
    if (memoryDoc) {
      return {
        ...memoryDoc,
        pendingSync: this.pendingSyncCodes.has(normalizedCode),
        storageSource: this.pendingSyncCodes.has(normalizedCode) ? 'memory' : 'mongodb',
      };
    }

    return null;
  }

  /**
   * List all coupons with Failover and In-Memory Reconciliation
   */
  async findAll(): Promise<ICoupon[]> {
    if (this.isOnline) {
      try {
        const mongoCoupons = await this.mongoRepo.findAll();
        const map = new Map<string, ICoupon>();

        // Populate from MongoDB
        for (const c of mongoCoupons) {
          map.set(c.code, { ...c, pendingSync: false, storageSource: 'mongodb' });
        }

        // Merge any un-synced offline coupons created during downtime
        const memoryCoupons = await this.memoryRepo.findAll();
        for (const c of memoryCoupons) {
          if (!map.has(c.code) || this.pendingSyncCodes.has(c.code)) {
            map.set(c.code, {
              ...c,
              pendingSync: this.pendingSyncCodes.has(c.code),
              storageSource: this.pendingSyncCodes.has(c.code) ? 'memory' : 'mongodb',
            });
          }
        }

        return Array.from(map.values()).sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
      } catch (err: any) {
        this.isOnline = false;
        console.warn(`⚠️ [ResilientStorage] MongoDB findAll failed (${err.message}). Failing over to in-memory.`);
      }
    }

    // Offline fallback
    const memoryCoupons = await this.memoryRepo.findAll();
    return memoryCoupons.map((c) => ({
      ...c,
      pendingSync: this.pendingSyncCodes.has(c.code),
      storageSource: 'memory',
    }));
  }

  /**
   * Automatic Sync: Flushes and upserts all offline coupons into MongoDB once reconnected
   */
  async syncPendingToMongo(): Promise<number> {
    if (!this.isOnline || this.pendingSyncCodes.size === 0) {
      return 0;
    }

    console.log(`🔄 [ResilientStorage] Starting auto-sync for ${this.pendingSyncCodes.size} offline coupon(s)...`);
    let syncedCount = 0;
    const codesToSync = Array.from(this.pendingSyncCodes);

    for (const code of codesToSync) {
      const coupon = await this.memoryRepo.findByCode(code);
      if (!coupon) {
        this.pendingSyncCodes.delete(code);
        continue;
      }

      try {
        const doc = await CouponModel.findOneAndUpdate(
          { code: coupon.code },
          {
            $set: {
              discount: coupon.discount,
              expiryDate: coupon.expiryDate,
              updatedAt: new Date(),
            },
            $setOnInsert: {
              createdAt: coupon.createdAt,
            },
          },
          { upsert: true, new: true }
        );

        // Mark synced
        this.pendingSyncCodes.delete(code);
        this.memoryRepo.upsert({
          ...coupon,
          id: doc._id.toString(),
          pendingSync: false,
          storageSource: 'mongodb',
        });
        syncedCount++;
        console.log(`✅ [ResilientStorage] Synced coupon '${code}' to MongoDB.`);
      } catch (err: any) {
        console.error(`❌ [ResilientStorage] Failed to sync coupon '${code}':`, err.message);
      }
    }

    console.log(`✨ [ResilientStorage] Auto-sync complete. ${syncedCount} coupon(s) saved to MongoDB.`);
    return syncedCount;
  }

  getStatus(): StorageStatus {
    return {
      isOnline: this.isOnline,
      pendingSyncCount: this.pendingSyncCodes.size,
      activeStorage: 'resilient',
    };
  }

  getPendingSyncCount(): number {
    return this.pendingSyncCodes.size;
  }

  async clear(): Promise<void> {
    this.pendingSyncCodes.clear();
    await this.memoryRepo.clear();
    if (this.isOnline) {
      await this.mongoRepo.clear();
    }
  }

  // Testing helper to simulate MongoDB disconnect/reconnect
  setSimulatedOnlineState(state: boolean): void {
    this.isOnline = state;
  }
}
