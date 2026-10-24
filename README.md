# Coupon Management & Application API

A production-ready REST API built with **TypeScript**, **Node.js**, **Express**, and **MongoDB** (with automatic zero-config In-Memory fallback) for creating discount coupons and applying them to orders.

---

## 📋 Features & Design Highlights

- **TypeScript Strict Mode**: Fully typed data models, repositories, and DTOs.
- **Robust Storage Architecture (Repository Pattern)**:
  - Connects to **MongoDB** (via Mongoose) when `MONGODB_URI` is provided.
  - Automatically falls back to an **In-Memory Repository** if MongoDB is unavailable or omitted—meaning the API is 100% testable immediately after `git clone` without requiring a local database setup.
- **Comprehensive Input Validation & Sanitization**:
  - Validates discount percentage strictly from **1 to 90**.
  - Enforces valid future expiry dates.
  - Normalizes coupon codes (auto-uppercased, whitespace-trimmed, alphanumeric/hyphen/underscore).
  - Handles order amounts cleanly (safely rejecting missing, negative, NaN, and non-numeric inputs).
- **Accurate Financial Calculations**:
  - Calculates discounts rounded to 2 decimal places (`cents`), preventing floating-point precision errors (e.g. `0.30000000000000004`).
- **Automated Test Suite**:
  - 33 comprehensive unit and integration tests using **Jest** and **Supertest** covering every edge case and required error scenario.
- **Production Hardening**:
  - Secure HTTP headers via `helmet`.
  - CORS enabled.
  - Centralized operational error handling with appropriate HTTP status codes (200, 201, 400, 404, 409).

---

## 🛠️ Tech Stack

- **Runtime**: Node.js (v18+)
- **Framework**: Express.js
- **Language**: TypeScript
- **Database / ODM**: MongoDB / Mongoose (with In-Memory repository fallback)
- **Validation**: Zod
- **Testing**: Jest, Supertest, ts-jest

---

## 🚀 Installation & Getting Started

### 1. Clone the repository & install dependencies

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

# Optional: Provide MongoDB connection string.
# If omitted or unavailable, the server automatically defaults to In-Memory storage.
# MONGODB_URI=mongodb://localhost:27017/coupon_db
```

### 3. Run the API

**Development Mode (with auto-reload):**
```bash
npm run dev
```

**Production Build & Run:**
```bash
npm run build
npm start
```

The server starts on `http://localhost:5001`.

### 4. Run the Bonus React Page (Optional)

To start the simple React page that creates coupons and lists them:

```bash
npm run client
```

This starts the React frontend on `http://localhost:3000` and automatically proxies API requests to `http://localhost:5001`.

---

## 🧪 Running Automated Tests

Run the full integration and unit test suite (33 tests):

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
Creates a coupon with a code, a discount percent from 1 to 90, and a future expiry date.

- **Method**: `POST`
- **Path**: `/coupons`
- **Headers**: `Content-Type: application/json`

#### Request Body
```json
{
  "code": "SAVE20",
  "discount": 20,
  "expiryDate": "2026-12-31T23:59:59.000Z"
}
```

#### Validation Rules:
- `code`: String, required, 2–30 characters, alphanumeric with hyphens/underscores. Automatically converted to uppercase.
- `discount`: Number, required, must be between **1 and 90** (inclusive).
- `expiryDate`: ISO date string or valid date, required, must be in the future.

#### Success Response (`201 Created`):
```json
{
  "success": true,
  "message": "Coupon created successfully",
  "data": {
    "id": "coupon_1_1792792062407",
    "code": "SAVE20",
    "discount": 20,
    "expiryDate": "2026-12-31T23:59:59.000Z",
    "createdAt": "2026-10-24T03:00:00.000Z",
    "updatedAt": "2026-10-24T03:00:00.000Z",
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
      "id": "coupon_1_1792792062407",
      "code": "WELCOME20",
      "discount": 20,
      "expiryDate": "2026-11-23T03:00:00.000Z",
      "createdAt": "2026-10-24T03:00:00.000Z",
      "updatedAt": "2026-10-24T03:00:00.000Z",
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

#### Request Body
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

#### Required Error Cases Handled:

| Condition | HTTP Status | Error Message |
| :--- | :--- | :--- |
| **Coupon code does not exist** | `404 Not Found` | `Coupon code '<CODE>' does not exist` |
| **Coupon has expired** | `400 Bad Request` | `Coupon has expired` |
| **Amount is missing** | `400 Bad Request` | `Amount is missing. Please provide an order amount.` |
| **Amount is negative** | `400 Bad Request` | `Amount cannot be negative. Please provide a positive order amount.` |
| **Amount is not a number** | `400 Bad Request` | `Amount is not a number. Please provide a valid numeric value.` |
| **Code is missing** | `400 Bad Request` | `Coupon code is required` |

---

## 🧪 Quick Test Guide with cURL

Make sure the server is running (`npm run dev`), then run these commands in your terminal:

### 1. Create a Coupon (Valid)
```bash
curl -X POST http://localhost:5001/coupons \
  -H "Content-Type: application/json" \
  -d '{"code": "SAVE25", "discount": 25, "expiryDate": "2026-12-31T23:59:59.000Z"}'
```

### 2. List All Coupons
```bash
curl http://localhost:5001/coupons
```

### 3. Apply Coupon (Success)
```bash
curl -X POST http://localhost:5001/coupons/apply \
  -H "Content-Type: application/json" \
  -d '{"code": "WELCOME20", "amount": 100}'
```
*Expected: `finalAmount: 80`*

### 4. Non-Existent Coupon (404 Error)
```bash
curl -X POST http://localhost:5001/coupons/apply \
  -H "Content-Type: application/json" \
  -d '{"code": "DOES_NOT_EXIST", "amount": 100}'
```
*Expected 404: `Coupon code 'DOES_NOT_EXIST' does not exist`*

### 5. Expired Coupon (400 Error)
```bash
curl -X POST http://localhost:5001/coupons/apply \
  -H "Content-Type: application/json" \
  -d '{"code": "EXPIRED10", "amount": 100}'
```
*Expected 400: `Coupon has expired`*

### 6. Missing Amount (400 Error)
```bash
curl -X POST http://localhost:5001/coupons/apply \
  -H "Content-Type: application/json" \
  -d '{"code": "WELCOME20"}'
```
*Expected 400: `Amount is missing. Please provide an order amount.`*

### 7. Negative Amount (400 Error)
```bash
curl -X POST http://localhost:5001/coupons/apply \
  -H "Content-Type: application/json" \
  -d '{"code": "WELCOME20", "amount": -50}'
```
*Expected 400: `Amount cannot be negative. Please provide a positive order amount.`*

### 8. Amount Not a Number (400 Error)
```bash
curl -X POST http://localhost:5001/coupons/apply \
  -H "Content-Type: application/json" \
  -d '{"code": "WELCOME20", "amount": "abc"}'
```
*Expected 400: `Amount is not a number. Please provide a valid numeric value.`*

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
│   │   ├── errorHandler.ts          # Centralized error handler
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
│   │   └── coupon.schema.ts         # Zod schemas & granular input checkers
│   ├── services/
│   │   └── coupon.service.ts        # Business logic & discount computation
│   ├── types/
│   │   ├── coupon.types.ts          # TypeScript interfaces & DTOs
│   │   └── errors.ts                # Custom AppError subclasses
│   ├── app.ts                       # Express application assembly
│   └── server.ts                    # Server bootstrap & graceful shutdown
├── tests/
│   ├── couponService.test.ts        # Service unit tests
│   └── coupons.test.ts              # Supertest integration tests (33 cases)
├── jest.config.ts                   # Jest testing configuration
├── tsconfig.json                    # TypeScript compiler options
├── package.json
└── README.md
```
