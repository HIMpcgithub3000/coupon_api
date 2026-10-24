# Coupon Management & Application API

A production-ready REST API built with **TypeScript**, **Node.js**, **Express**, and **MongoDB** (with automatic zero-config In-Memory fallback) for creating discount coupons and applying them to orders.

> 📝 **Part 2 Answers**: For the detailed bug analysis and fixes for the Express route in Part 2, see [ANSWERS.md](./ANSWERS.md).

---

## 📋 Features & Architecture

- **TypeScript Strict Mode**: Fully typed data models, repositories, controllers, and DTOs.
- **Resilient Hybrid Storage (Automatic Failover & Offline Auto-Sync)**:
  - **Zero Downtime Failover**: If MongoDB disconnects or experiences an outage at runtime, all operations automatically fail over to In-Memory storage without downtime.
  - **Offline Queueing**: Coupons created during an outage are stored in-memory and marked `pendingSync: true`.
  - **Background Health Polling**: Continuously monitors Mongoose connection events (`connected`, `disconnected`, `reconnected`) and attempts background reconnection.
  - **Automatic Database Synchronization**: The instant MongoDB reconnects, all coupons created during downtime are automatically synced and persisted into MongoDB.
- **Strict Input Validation & Sanitization**:
  - Validates discount percentage strictly from **1 to 90** (rejects `< 1`, `> 90`, or non-numbers).
  - Enforces future expiration dates.
  - Normalizes coupon codes (auto-uppercased, whitespace-trimmed, alphanumeric/hyphen/underscore).
  - Comprehensive check on order amounts (rejecting missing, negative, NaN, and non-numeric values).
  - Defends against NoSQL query selector injection.
- **Accurate Financial Calculations**:
  - Rounds discounts and final amounts to 2 decimal places (`cents`), preventing floating-point precision inaccuracies (e.g. `0.30000000000000004`).
- **Comprehensive Automated Test Suite**:
  - **48 automated unit and integration tests** using **Jest** and **Supertest** (including tests validating failover/auto-sync and all Part 2 edge cases).
- **Bonus Simple React UI**:
  - Clean, unbloated, structured React page (black text on white background) to create coupons and list them in real-time.

---

## 🛠️ Tech Stack

- **Runtime**: Node.js (v18+)
- **Framework**: Express.js
- **Language**: TypeScript
- **Database / ODM**: MongoDB / Mongoose (with In-Memory repository fallback)
- **Validation**: Zod
- **Testing**: Jest, Supertest, ts-jest
- **Frontend (Bonus)**: React 18, Vite

---

## 🚀 Installation & Getting Started

### 1. Clone & Install Dependencies

```bash
git clone <your-repo-url>
cd cashflowcrew
npm install
```

### 2. Environment Configuration (Optional)

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Default variables:
```env
PORT=5001
NODE_ENV=development

# Optional: MongoDB connection string.
# If omitted or offline, the server automatically defaults to In-Memory storage.
# MONGODB_URI=mongodb://localhost:27017/coupon_db
```

### 3. Run the API Server

**Development Mode (with auto-reload on port 5001):**
```bash
npm run dev
```

**Production Build & Run:**
```bash
npm run build
npm start
```

The server starts on **`http://localhost:5001`**.

---

### 4. Run the Bonus React Page (Optional)

To start the simple React page that creates coupons and lists them:

```bash
npm run client
```

Open your browser to **`http://localhost:3000`**.  
*(Vite proxies API requests automatically to `http://localhost:5001`).*

---

## 🧪 Running Automated Tests

Run the full integration and unit test suite (**33 tests passing**):

```bash
npm test
```

Run tests with test coverage:
```bash
npm run test:coverage
```

---

## 📡 API Endpoints Reference

### 1. Create Coupon
Creates a coupon with a code, a discount percent from 1 to 90, and an expiry date.

- **Method**: `POST`
- **Path**: `/coupons`
- **Headers**: `Content-Type: application/json`

#### Request Body:
```json
{
  "code": "SAVE20",
  "discount": 20,
  "expiryDate": "2026-12-31T23:59:59.000Z"
}
```

#### Validation Rules:
- `code`: String, required, 2–30 chars, alphanumeric with hyphens/underscores. Automatically trimmed and converted to uppercase.
- `discount`: Number, required, must be between **1 and 90** (inclusive).
- `expiryDate`: ISO date string or valid date, required, **must be in the future**.

#### Success Response (`201 Created`):
```json
{
  "success": true,
  "message": "Coupon created successfully",
  "data": {
    "id": "6adcb5e5768a794d666f2c09",
    "code": "SAVE20",
    "discount": 20,
    "expiryDate": "2026-12-31T23:59:59.000Z",
    "createdAt": "2026-10-24T13:43:01.441Z",
    "updatedAt": "2026-10-24T13:43:01.441Z",
    "isExpired": false
  }
}
```

#### Error Responses:
- `400 Bad Request`: If discount is `< 1` or `> 90`, not a number, expiry date is in the past, or code is missing.
- `409 Conflict`: If a coupon with the given code already exists.

---

### 2. List All Coupons
Lists all stored coupons.

- **Method**: `GET`
- **Path**: `/coupons`

#### Success Response (`200 OK`):
```json
{
  "success": true,
  "count": 3,
  "data": [
    {
      "id": "6adcb5dc768a794d666f2c01",
      "code": "WELCOME20",
      "discount": 20,
      "expiryDate": "2026-11-23T13:42:52.718Z",
      "createdAt": "2026-10-24T13:42:52.726Z",
      "updatedAt": "2026-10-24T13:42:52.726Z",
      "isExpired": false
    }
  ]
}
```

---

### 3. Apply Coupon to Order
Takes `{ code, amount }` and returns the final amount after applying the discount.

- **Method**: `POST`
- **Path**: `/coupons/apply`
- **Headers**: `Content-Type: application/json`

#### Request Body:
```json
{
  "code": "WELCOME20",
  "amount": 100
}
```

#### Success Response (`200 OK`):
```json
{
  "success": true,
  "message": "Coupon applied successfully",
  "code": "WELCOME20",
  "originalAmount": 100,
  "discountPercent": 20,
  "discountAmount": 20,
  "finalAmount": 80
}
```

---

## ⚠️ Required Error Handling Specifications (`POST /coupons/apply`)

The endpoint strictly handles all required error conditions with clear, informative messages:

| Test Condition | HTTP Status | Response Message |
| :--- | :--- | :--- |
| **The coupon code does not exist** | `404 Not Found` | `"Coupon code '<CODE>' does not exist"` |
| **The coupon has expired** | `400 Bad Request` | `"Coupon has expired"` |
| **The amount is missing** | `400 Bad Request` | `"Amount is missing. Please provide an order amount."` |
| **The amount is negative** | `400 Bad Request` | `"Amount cannot be negative. Please provide a positive order amount."` |
| **The amount is not a number** | `400 Bad Request` | `"Amount is not a number. Please provide a valid numeric value."` |
| **The coupon code is missing** | `400 Bad Request` | `"Coupon code is required"` |

---

## 💻 Quick Test Commands (cURL)

Make sure the server is running (`npm run dev`), then execute these commands in your terminal:

### 1. Create a Valid Coupon
```bash
curl -X POST http://localhost:5001/coupons \
  -H "Content-Type: application/json" \
  -d '{"code": "SAVE25", "discount": 25, "expiryDate": "2026-12-31T23:59:59.000Z"}'
```

### 2. List All Coupons
```bash
curl http://localhost:5001/coupons
```

### 3. Apply Coupon (Success - $100 with 20% discount = $80)
```bash
curl -X POST http://localhost:5001/coupons/apply \
  -H "Content-Type: application/json" \
  -d '{"code": "WELCOME20", "amount": 100}'
```

### 4. Test: Non-Existent Coupon (404 Not Found)
```bash
curl -X POST http://localhost:5001/coupons/apply \
  -H "Content-Type: application/json" \
  -d '{"code": "NON_EXISTENT_COUPON", "amount": 100}'
```

### 5. Test: Expired Coupon (400 Bad Request)
```bash
curl -X POST http://localhost:5001/coupons/apply \
  -H "Content-Type: application/json" \
  -d '{"code": "EXPIRED10", "amount": 100}'
```

### 6. Test: Missing Amount (400 Bad Request)
```bash
curl -X POST http://localhost:5001/coupons/apply \
  -H "Content-Type: application/json" \
  -d '{"code": "WELCOME20"}'
```

### 7. Test: Negative Amount (400 Bad Request)
```bash
curl -X POST http://localhost:5001/coupons/apply \
  -H "Content-Type: application/json" \
  -d '{"code": "WELCOME20", "amount": -50}'
```

### 8. Test: Amount Not a Number (400 Bad Request)
```bash
curl -X POST http://localhost:5001/coupons/apply \
  -H "Content-Type: application/json" \
  -d '{"code": "WELCOME20", "amount": "abc"}'
```

---

## 💡 Notes on Design Decisions

1. **Storage Choice**: Implemented using the **Repository Pattern** (`ICouponRepository`). It connects to **MongoDB** if `MONGODB_URI` is present in `.env`, and gracefully defaults to an in-memory repository if not provided. This ensures that any reviewer can clone and test the repository without needing a running database instance.
2. **Financial Precision**: Floating point values in discounts are rounded using `Math.round(val * 100) / 100` to prevent IEEE 754 precision issues (e.g. `$84.99000000000001`).
3. **Case-Insensitive Coupon Codes**: Codes are normalized to uppercase (`save20` -> `SAVE20`) and trimmed of whitespace, aligning with standard e-commerce best practices.
4. **Part 2 Answers**: All bugs in the Part 2 route are fully documented with root causes, failure modes, and corrected code in [ANSWERS.md](./ANSWERS.md).

---

## 📂 Project Structure

```
cashflowcrew/
├── src/
│   ├── config/
│   │   └── database.ts              # MongoDB connection & fallback manager
│   ├── controllers/
│   │   └── coupon.controller.ts     # HTTP request handlers
│   ├── middlewares/
│   │   ├── errorHandler.ts          # Centralized error handling
│   │   └── validate.ts              # Zod validation middleware
│   ├── models/
│   │   └── coupon.model.ts          # Mongoose Schema & Document definition
│   ├── repositories/
│   │   ├── ICouponRepository.ts     # Repository contract interface
│   │   ├── InMemoryCouponRepository.ts # Zero-config in-memory storage
│   │   └── MongoCouponRepository.ts # MongoDB Mongoose storage
│   ├── routes/
│   │   └── coupon.routes.ts         # /coupons routing
│   ├── schemas/
│   │   └── coupon.schema.ts         # Zod schemas & input checkers
│   ├── services/
│   │   └── coupon.service.ts        # Business logic & discount computation
│   ├── types/
│   │   ├── coupon.types.ts          # TypeScript interfaces & DTOs
│   │   └── errors.ts                # Operational AppError classes
│   ├── app.ts                       # Express application assembly
│   └── server.ts                    # Server bootstrap & graceful shutdown
├── client/                          # Bonus Simple React UI (black on white)
│   ├── src/
│   │   ├── App.tsx                  # Coupon form & live coupons table
│   │   ├── index.css                # Plain, clean styling
│   │   └── main.tsx
│   ├── package.json
│   └── vite.config.ts
├── tests/
│   ├── couponService.test.ts        # Service unit tests
│   └── coupons.test.ts              # Supertest integration tests (33 cases)
├── ANSWERS.md                       # Part 2 Bug Analysis & Code Review
├── README.md                        # Project Documentation
├── package.json
└── tsconfig.json
```
