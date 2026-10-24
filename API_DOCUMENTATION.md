# Coupon Management & Application REST API Documentation

- **Base URL**: `http://localhost:5001`
- **Content-Type**: `application/json`
- **Authentication**: None required (Public REST API)
- **Status**: Production-Ready

---

## 📑 Table of Contents
1. [Overview & Architecture](#1-overview--architecture)
2. [Endpoints Quick Reference](#2-endpoints-quick-reference)
3. [POST /coupons — Create Coupon](#3-post-coupons--create-coupon)
4. [GET /coupons — List All Coupons](#4-get-coupons--list-all-coupons)
5. [POST /coupons/apply — Apply Coupon to Order](#5-post-couponsapply--apply-coupon-to-order)
6. [GET /health — Server Health Check](#6-get-health--server-health-check)
7. [Comprehensive Error Handling Matrix](#7-comprehensive-error-handling-matrix)
8. [cURL Command Testing Suite](#8-curl-command-testing-suite)
9. [Automated Test Suite Reference](#9-automated-test-suite-reference)

---

## 1. Overview & Architecture

The API manages discount coupons and calculates order discounts with strict validation and decimal precision.

- **Storage**: Powered by the **Repository Pattern**:
  - Connects to **MongoDB** via Mongoose when `MONGODB_URI` is provided.
  - Automatically falls back to an **In-Memory Repository** if MongoDB is omitted or offline, enabling immediate out-of-the-box execution and testing without external database dependencies.
- **Validation**: Enforced using **Zod** schema validation and custom pre-validation pipelines.
- **Precision**: Monetary discounts and final amounts are rounded using standard financial 2-decimal place calculations to avoid IEEE 754 floating-point inaccuracies.

---

## 2. Endpoints Quick Reference

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/coupons` | Creates a new coupon with code, discount (1–90%), and expiry date |
| `GET` | `/coupons` | Retrieves all coupons with computed active/expired statuses |
| `POST` | `/coupons/apply` | Calculates the discounted order amount for a given coupon code |
| `GET` | `/health` | Returns server health status, uptime, and timestamp |

---

## 3. POST /coupons — Create Coupon

Creates a new discount coupon in the system.

### HTTP Request
`POST http://localhost:5001/coupons`

### Request Headers
```http
Content-Type: application/json
```

### Request Body Parameters
| Parameter | Type | Required | Constraints | Description |
| :--- | :--- | :--- | :--- | :--- |
| `code` | `string` | **Yes** | 2–30 chars, alphanumeric, hyphens, underscores | The unique coupon code. Automatically trimmed and converted to uppercase. |
| `discount` | `number` | **Yes** | `1 <= discount <= 90` | Percentage discount from 1 to 90. |
| `expiryDate` | `string` | **Yes** | Valid ISO 8601 date, **must be in the future** | Expiration timestamp. |

#### Example Request Body
```json
{
  "code": "SAVE20",
  "discount": 20,
  "expiryDate": "2026-12-31T23:59:59.000Z"
}
```

---

### Responses

#### ✅ 201 Created — Success
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

---

### Error Responses for `POST /coupons`

#### ❌ 400 Bad Request — Missing Coupon Code
```json
{
  "success": false,
  "message": "Coupon code is required",
  "errors": [
    {
      "field": "code",
      "message": "Coupon code is required"
    }
  ]
}
```

#### ❌ 400 Bad Request — Invalid Characters in Coupon Code
```json
{
  "success": false,
  "message": "Coupon code can only contain alphanumeric characters, hyphens, and underscores",
  "errors": [
    {
      "field": "code",
      "message": "Coupon code can only contain alphanumeric characters, hyphens, and underscores"
    }
  ]
}
```

#### ❌ 400 Bad Request — Discount Less Than 1 (e.g. 0 or negative)
```json
{
  "success": false,
  "message": "Discount percent must be between 1 and 90",
  "errors": [
    {
      "field": "discount",
      "message": "Discount percent must be between 1 and 90"
    }
  ]
}
```

#### ❌ 400 Bad Request — Discount Greater Than 90 (e.g. 91 or 100)
```json
{
  "success": false,
  "message": "Discount percent must be between 1 and 90",
  "errors": [
    {
      "field": "discount",
      "message": "Discount percent must be between 1 and 90"
    }
  ]
}
```

#### ❌ 400 Bad Request — Discount Is Not a Number
```json
{
  "success": false,
  "message": "Discount percent must be a number",
  "errors": [
    {
      "field": "discount",
      "message": "Discount percent must be a number"
    }
  ]
}
```

#### ❌ 400 Bad Request — Missing Expiry Date
```json
{
  "success": false,
  "message": "Expiry date is required",
  "errors": [
    {
      "field": "expiryDate",
      "message": "Expiry date is required"
    }
  ]
}
```

#### ❌ 400 Bad Request — Expiry Date Already in the Past
```json
{
  "success": false,
  "message": "Expiry date must be in the future",
  "errors": [
    {
      "field": "expiryDate",
      "message": "Expiry date must be in the future"
    }
  ]
}
```

#### ❌ 400 Bad Request — Invalid Date Format
```json
{
  "success": false,
  "message": "Expiry date must be a valid date (e.g. YYYY-MM-DD or ISO 8601)",
  "errors": [
    {
      "field": "expiryDate",
      "message": "Expiry date must be a valid date (e.g. YYYY-MM-DD or ISO 8601)"
    }
  ]
}
```

#### ❌ 409 Conflict — Duplicate Coupon Code
```json
{
  "success": false,
  "message": "Coupon code 'SAVE20' already exists"
}
```

---

## 4. GET /coupons — List All Coupons

Retrieves all stored coupons sorted in descending order of creation date.

### HTTP Request
`GET http://localhost:5001/coupons`

### Request Headers
None required.

---

### Responses

#### ✅ 200 OK — Success
```json
{
  "success": true,
  "count": 2,
  "data": [
    {
      "id": "coupon_1_1792792062407",
      "code": "WELCOME20",
      "discount": 20,
      "expiryDate": "2026-11-23T03:00:00.000Z",
      "createdAt": "2026-10-24T03:00:00.000Z",
      "updatedAt": "2026-10-24T03:00:00.000Z",
      "isExpired": false
    },
    {
      "id": "coupon_2_1792792062408",
      "code": "EXPIRED10",
      "discount": 10,
      "expiryDate": "2026-10-15T00:00:00.000Z",
      "createdAt": "2026-10-24T03:00:00.000Z",
      "updatedAt": "2026-10-24T03:00:00.000Z",
      "isExpired": true
    }
  ]
}
```

#### ✅ 200 OK — Empty Store
```json
{
  "success": true,
  "count": 0,
  "data": []
}
```

---

## 5. POST /coupons/apply — Apply Coupon to Order

Applies a discount coupon to an order amount and returns the calculated final amount.

### HTTP Request
`POST http://localhost:5001/coupons/apply`

### Request Headers
```http
Content-Type: application/json
```

### Request Body Parameters
| Parameter | Type | Required | Constraints | Description |
| :--- | :--- | :--- | :--- | :--- |
| `code` | `string` | **Yes** | Non-empty string | The coupon code to apply (case-insensitive, whitespace-trimmed). |
| `amount` | `number` | **Yes** | Finite number `>= 0` | The order total to which the discount will be applied. |

#### Example Request Body
```json
{
  "code": "WELCOME20",
  "amount": 100
}
```

---

### Responses

#### ✅ 200 OK — Success
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

#### ✅ 200 OK — Decimal Precision Calculation Example
Order amount of `$99.99` with `15%` discount:
- Calculation: `99.99 * 0.15 = 14.9985` -> rounded to `$15.00`
- Final Amount: `99.99 - 15.00 = 84.99`
```json
{
  "success": true,
  "message": "Coupon applied successfully",
  "code": "SAVE15",
  "originalAmount": 99.99,
  "discountPercent": 15,
  "discountAmount": 15,
  "finalAmount": 84.99
}
```

---

### Error Responses for `POST /coupons/apply`

#### ❌ 404 Not Found — Coupon Code Does Not Exist
Triggered when the provided coupon code cannot be found in the database.
```json
{
  "success": false,
  "message": "Coupon code 'DOES_NOT_EXIST' does not exist"
}
```

#### ❌ 400 Bad Request — Coupon Has Expired
Triggered when the coupon's `expiryDate <= current date/time`.
```json
{
  "success": false,
  "message": "Coupon has expired"
}
```

#### ❌ 400 Bad Request — Amount Is Missing
Triggered when `amount` is `undefined`, `null`, or an empty string `""`.
```json
{
  "success": false,
  "message": "Amount is missing. Please provide an order amount."
}
```

#### ❌ 400 Bad Request — Amount Is Negative
Triggered when `amount < 0` (e.g. `-50`).
```json
{
  "success": false,
  "message": "Amount cannot be negative. Please provide a positive order amount."
}
```

#### ❌ 400 Bad Request — Amount Is Not a Number
Triggered when `amount` is a string with non-numeric characters (e.g. `"abc"`, `true`, `NaN`).
```json
{
  "success": false,
  "message": "Amount is not a number. Please provide a valid numeric value."
}
```

#### ❌ 400 Bad Request — Coupon Code Is Missing
Triggered when `code` is missing or empty.
```json
{
  "success": false,
  "message": "Coupon code is required"
}
```

---

## 6. GET /health — Server Health Check

Provides runtime metrics and verification of server status.

### HTTP Request
`GET http://localhost:5001/health`

#### ✅ 200 OK — Response
```json
{
  "status": "UP",
  "uptime": 128.45,
  "timestamp": "2026-10-24T18:00:00.000Z"
}
```

---

## 7. Comprehensive Error Handling Matrix

| HTTP Status | Condition | Example Scenario | Response Message |
| :--- | :--- | :--- | :--- |
| `400 Bad Request` | Missing coupon code | Body: `{"discount": 20}` | `"Coupon code is required"` |
| `400 Bad Request` | Discount below minimum | Body: `{"discount": 0}` | `"Discount percent must be between 1 and 90"` |
| `400 Bad Request` | Discount above maximum | Body: `{"discount": 95}` | `"Discount percent must be between 1 and 90"` |
| `400 Bad Request` | Discount not a number | Body: `{"discount": "twenty"}` | `"Discount percent must be a number"` |
| `400 Bad Request` | Expiry date in past | Body: `{"expiryDate": "2020-01-01"}` | `"Expiry date must be in the future"` |
| `400 Bad Request` | Invalid date string | Body: `{"expiryDate": "invalid"}` | `"Expiry date must be a valid date (e.g. YYYY-MM-DD or ISO 8601)"` |
| `400 Bad Request` | Expired coupon applied | Body: `{"code": "EXPIRED10", "amount": 100}` | `"Coupon has expired"` |
| `400 Bad Request` | Missing amount applied | Body: `{"code": "SAVE20"}` | `"Amount is missing. Please provide an order amount."` |
| `400 Bad Request` | Negative amount applied | Body: `{"code": "SAVE20", "amount": -10}` | `"Amount cannot be negative. Please provide a positive order amount."` |
| `400 Bad Request` | Non-numeric amount | Body: `{"code": "SAVE20", "amount": "abc"}` | `"Amount is not a number. Please provide a valid numeric value."` |
| `400 Bad Request` | Malformed JSON in request | Body contains syntax error | `"Malformed JSON payload in request body"` |
| `404 Not Found` | Coupon does not exist | Body: `{"code": "UNKNOWN", "amount": 50}` | `"Coupon code 'UNKNOWN' does not exist"` |
| `404 Not Found` | Unknown API endpoint | Requesting `/invalid-route` | `"Route GET /invalid-route not found"` |
| `409 Conflict` | Duplicate code created | Re-creating `"SAVE20"` | `"Coupon code 'SAVE20' already exists"` |
| `500 Internal Error` | Unhandled runtime failure | Unexpected exception | `"Internal server error"` |

---

## 8. cURL Command Testing Suite

### 1. Create a Valid Coupon
```bash
curl -X POST http://localhost:5001/coupons \
  -H "Content-Type: application/json" \
  -d '{"code": "BLACKFRIDAY", "discount": 40, "expiryDate": "2026-12-31T23:59:59.000Z"}'
```

### 2. List All Coupons
```bash
curl http://localhost:5001/coupons
```

### 3. Apply a Coupon (Valid Calculation)
```bash
curl -X POST http://localhost:5001/coupons/apply \
  -H "Content-Type: application/json" \
  -d '{"code": "WELCOME20", "amount": 150}'
```

### 4. Test: Non-Existent Coupon (404)
```bash
curl -X POST http://localhost:5001/coupons/apply \
  -H "Content-Type: application/json" \
  -d '{"code": "NON_EXISTENT_COUPON", "amount": 100}'
```

### 5. Test: Expired Coupon (400)
```bash
curl -X POST http://localhost:5001/coupons/apply \
  -H "Content-Type: application/json" \
  -d '{"code": "EXPIRED10", "amount": 100}'
```

### 6. Test: Missing Amount (400)
```bash
curl -X POST http://localhost:5001/coupons/apply \
  -H "Content-Type: application/json" \
  -d '{"code": "WELCOME20"}'
```

### 7. Test: Negative Amount (400)
```bash
curl -X POST http://localhost:5001/coupons/apply \
  -H "Content-Type: application/json" \
  -d '{"code": "WELCOME20", "amount": -75}'
```

### 8. Test: Amount Not a Number (400)
```bash
curl -X POST http://localhost:5001/coupons/apply \
  -H "Content-Type: application/json" \
  -d '{"code": "WELCOME20", "amount": "invalid_number"}'
```

### 9. Test: Discount Out of Bounds (< 1) (400)
```bash
curl -X POST http://localhost:5001/coupons \
  -H "Content-Type: application/json" \
  -d '{"code": "BAD_DISCOUNT", "discount": 0, "expiryDate": "2026-12-31T23:59:59.000Z"}'
```

### 10. Test: Discount Out of Bounds (> 90) (400)
```bash
curl -X POST http://localhost:5001/coupons \
  -H "Content-Type: application/json" \
  -d '{"code": "BAD_DISCOUNT", "discount": 95, "expiryDate": "2026-12-31T23:59:59.000Z"}'
```

---

## 9. Automated Test Suite Reference

The project includes 33 automated tests covering 100% of the specified acceptance criteria and edge cases.

### Running Tests:
```bash
npm test
```

### Test Coverage Highlights:
- **`tests/coupons.test.ts` (26 integration tests)**:
  - Coupon creation with boundaries (1% and 90%).
  - Case normalization & whitespace trimming.
  - Rejection of out-of-range discounts (0, -5, 91, 100).
  - Rejection of past expiry dates and invalid dates.
  - Rejection of duplicate codes (409 Conflict).
  - Listing coupons with correct computed `isExpired` flag.
  - Applying valid coupons with integer and decimal amounts.
  - Error verification for non-existent codes (404).
  - Error verification for expired coupons (400).
  - Error verification for missing, negative, and non-numeric amounts (400).
- **`tests/couponService.test.ts` (7 unit tests)**:
  - Isolated business logic verification and financial rounding tests.
