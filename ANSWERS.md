# Part 2: Bug Analysis & Code Review

## The Original Code Snippet

```javascript
app.post("/apply", async (req, res) => {
  const coupon = await Coupon.findOne({ code: req.body.code });
  if (coupon.expiresAt < new Date()) {
    return res.status(400).json({ message: "Expired" });
  }
  const finalAmount = req.body.amount - req.body.amount * coupon.discount / 100;
  res.json({ finalAmount });
});
```

---

## Summary of Identified Bugs & Issues

| # | Bug / Vulnerability | Severity | Impact |
| :- | :--- | :--- | :--- |
| **1** | **Unhandled Non-Existent Coupon (`null.expiresAt`)** | **Critical** | Server crash / unhandled rejection / hung request |
| **2** | **No `try...catch` / Unhandled Database Failures** | **High** | Process crashes or hangs on database timeout/disconnect |
| **3** | **NoSQL Injection & Missing Input Validation on `code`** | **Critical** | Security vulnerability / arbitrary coupon redemption |
| **4** | **Missing, Negative, or Non-Numeric `amount` Handling** | **High** | Returns `NaN` / `null` with 200 OK; accepts negative orders |
| **5** | **Floating-Point Precision Inaccuracy** | **Medium** | Produces precision artifacts (e.g. `16.991500000000002`) |
| **6** | **Unsafe Date Comparison** | **Medium** | Fails if `expiresAt` is stored as an ISO string or timestamp |
| **7** | **Missing `req.body` Guard (Missing Body-Parser or Headers)** | **Medium** | Throws `TypeError` if `req.body` is undefined |
| **8** | **Minimal / Uninformative API Response** | **Low** | Lacks breakdown metadata (`originalAmount`, `discountSaved`) |

---

## Detailed Bug Breakdown & Solutions

### 1. Unhandled Non-Existent Coupon (Critical Bug)
- **What goes wrong:**
  When a user submits a coupon code that does not exist in the database, `Coupon.findOne()` resolves to `null`.
  The code immediately attempts to evaluate `coupon.expiresAt`.
  In JavaScript, accessing a property on `null` throws:
  ```text
  TypeError: Cannot read properties of null (reading 'expiresAt')
  ```
  In Express (especially Express 4), unhandled errors inside async route handlers trigger an unhandled promise rejection. The HTTP request never receives a response and hangs until client timeout.
- **How to fix it:**
  Check whether `coupon` exists immediately after the database query and return a `404 Not Found` response:
  ```javascript
  if (!coupon) {
    return res.status(404).json({ message: "Coupon code does not exist" });
  }
  ```

---

### 2. Missing Error Handling / No `try...catch` Block
- **What goes wrong:**
  `Coupon.findOne()` is an asynchronous network I/O operation against MongoDB. If the database goes down, network connection drops, or query timeout occurs, the promise rejects.
  Without a `try...catch` block (or an async error wrapper like `express-async-handler`), Express 4 will not forward the rejected promise to error middleware, causing unhandled rejections and frozen connections.
- **How to fix it:**
  Wrap the entire handler in a `try...catch` block and return an appropriate `500 Internal Server Error` (or forward via `next(err)`):
  ```javascript
  try {
    // route logic
  } catch (err) {
    console.error("Error applying coupon:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
  ```

---

### 3. NoSQL Injection & Unvalidated `req.body.code`
- **What goes wrong:**
  - **NoSQL Injection Vulnerability**: The query `{ code: req.body.code }` passes the user's raw input directly to Mongoose/MongoDB. If a malicious client sends:
    ```json
    { "code": { "$ne": null }, "amount": 100 }
    ```
    MongoDB evaluates `$ne: null` (not equal to null) and returns the **first coupon in the collection**, allowing attackers to obtain discounts without knowing any valid coupon code!
  - **Whitespace and Casing Inconsistencies**: If a user enters `" save20 "` or `"welcome20"`, the exact lookup fails even if `"WELCOME20"` exists in the database.
- **How to fix it:**
  Validate that `req.body.code` is strictly a non-empty string, trim surrounding whitespace, and normalize casing:
  ```javascript
  if (!req.body?.code || typeof req.body.code !== "string" || !req.body.code.trim()) {
    return res.status(400).json({ message: "Coupon code is required" });
  }
  const code = req.body.code.trim().toUpperCase();
  const coupon = await Coupon.findOne({ code });
  ```

---

### 4. Missing, Negative, or Non-Numeric `amount`
- **What goes wrong:**
  - **Missing amount**: If `amount` is omitted (`undefined`), JavaScript computes:
    ```javascript
    undefined - undefined * 20 / 100 // => NaN
    ```
    JSON serialization converts `NaN` to `null` (`JSON.stringify({ finalAmount: NaN }) => '{"finalAmount":null}'`). The API responds with `200 OK` and `{ "finalAmount": null }` instead of an error!
  - **Non-numeric strings**: If `amount` is `"abc"`, it also evaluates to `NaN`.
  - **Negative amount**: If `amount` is `-100`, the calculation yields `-80`, allowing negative order amounts.
  - **Zero or Infinity**: `Infinity` would produce `Infinity`.
- **How to fix it:**
  Enforce strict validation for the order amount:
  ```javascript
  const rawAmount = req.body?.amount;
  if (rawAmount === undefined || rawAmount === null || rawAmount === "") {
    return res.status(400).json({ message: "Amount is missing" });
  }

  const amount = Number(rawAmount);
  if (isNaN(amount) || !Number.isFinite(amount)) {
    return res.status(400).json({ message: "Amount must be a valid number" });
  }

  if (amount < 0) {
    return res.status(400).json({ message: "Amount cannot be negative" });
  }
  ```

---

### 5. Floating-Point Arithmetic Precision Errors
- **What goes wrong:**
  JavaScript uses IEEE 754 floating-point arithmetic. Standard operations on fractional dollar amounts produce precision artifacts:
  ```javascript
  const amount = 19.99;
  const discount = 15;
  amount - (amount * discount) / 100;
  // => 16.991500000000002
  ```
  In financial/e-commerce applications, returning fractional cents causes payment processor rejections (e.g., Stripe/PayPal require standard 2-decimal currencies) and reconciliation bugs.
- **How to fix it:**
  Round the calculated discount and final amount to 2 decimal places:
  ```javascript
  const rawDiscount = (amount * coupon.discount) / 100;
  const discountAmount = Math.round(rawDiscount * 100) / 100;
  const finalAmount = Math.max(0, Math.round((amount - discountAmount) * 100) / 100);
  ```

---

### 6. Unsafe Date Comparison
- **What goes wrong:**
  ```javascript
  if (coupon.expiresAt < new Date())
  ```
  If `coupon.expiresAt` in MongoDB is stored as an ISO 8601 string (e.g. `"2026-12-31T23:59:59.000Z"`) instead of a BSON Date object, comparing a string to a `Date` object relies on JavaScript type coercion and can produce unexpected falsy comparisons.
- **How to fix it:**
  Explicitly convert `coupon.expiresAt` to a `Date` timestamp using `.getTime()`:
  ```javascript
  const expiryTime = new Date(coupon.expiresAt).getTime();
  if (isNaN(expiryTime) || expiryTime <= Date.now()) {
    return res.status(400).json({ message: "Coupon has expired" });
  }
  ```

---

### 7. Missing Body-Parser Guard
- **What goes wrong:**
  If the incoming request is sent without `Content-Type: application/json` or if Express `express.json()` middleware is missing, `req.body` will be `undefined`.
  Executing `req.body.code` will immediately throw `TypeError: Cannot read properties of undefined (reading 'code')`.
- **How to fix it:**
  Ensure optional chaining (`req.body?.code`) or guard against missing bodies before reading properties.

---

## The Fully Fixed, Production-Grade Route

Here is the corrected and hardened version of the route resolving all issues:

```javascript
app.post("/apply", async (req, res) => {
  try {
    // 1. Guard against undefined request body
    if (!req.body || typeof req.body !== "object") {
      return res.status(400).json({ message: "Invalid request payload" });
    }

    const { code: rawCode, amount: rawAmount } = req.body;

    // 2. Validate Coupon Code (prevents NoSQL injection and empty values)
    if (!rawCode || typeof rawCode !== "string" || !rawCode.trim()) {
      return res.status(400).json({ message: "Coupon code is required" });
    }
    const code = rawCode.trim().toUpperCase();

    // 3. Validate Amount (missing, negative, or not a number)
    if (rawAmount === undefined || rawAmount === null || rawAmount === "") {
      return res.status(400).json({ message: "Amount is missing" });
    }

    const amount = Number(rawAmount);
    if (isNaN(amount) || !Number.isFinite(amount)) {
      return res.status(400).json({ message: "Amount must be a valid number" });
    }

    if (amount < 0) {
      return res.status(400).json({ message: "Amount cannot be negative" });
    }

    // 4. Fetch Coupon from Database
    const coupon = await Coupon.findOne({ code });

    // 5. Check if Coupon Exists (fixes null.expiresAt crash)
    if (!coupon) {
      return res.status(404).json({ message: `Coupon code '${code}' does not exist` });
    }

    // 6. Safe Expiry Check
    const expiryTime = new Date(coupon.expiresAt).getTime();
    if (isNaN(expiryTime) || expiryTime <= Date.now()) {
      return res.status(400).json({ message: "Coupon has expired" });
    }

    // 7. Calculate Discount with 2-decimal financial rounding
    const discountPercent = Number(coupon.discount) || 0;
    const rawDiscount = (amount * discountPercent) / 100;
    const discountAmount = Math.round(rawDiscount * 100) / 100;
    const finalAmount = Math.max(0, Math.round((amount - discountAmount) * 100) / 100);

    // 8. Return Clear, Structured Response
    return res.status(200).json({
      success: true,
      code: coupon.code,
      originalAmount: Number(amount.toFixed(2)),
      discountPercent,
      discountAmount: Number(discountAmount.toFixed(2)),
      finalAmount: Number(finalAmount.toFixed(2)),
    });
  } catch (error) {
    console.error("Error in /apply route:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});
```
