# Part 2: Find the Bugs — Analysis & Solutions

### The Original Route:
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

## Identified Problems & Solutions

### 1. Missing Null Handling for Non-Existent Coupon
- **Problem:** If the coupon code is not present in the database, `Coupon.findOne()` returns `null`, causing `coupon.expiresAt` to throw an unhandled `TypeError: Cannot read properties of null (reading 'expiresAt')` and hang the request.
- **Solution:** Add a null check right after fetching the coupon:
  ```javascript
  if (!coupon) {
    return res.status(404).json({ message: "Coupon code does not exist" });
  }
  ```

---

### 2. Missing `try...catch` Block (Unhandled Database Errors)
- **Problem:** If MongoDB disconnects, times out, or encounters a database error, the rejected promise is unhandled in Express, causing the server request to freeze or crash.
- **Solution:** Wrap the route logic in a `try...catch` block to handle exceptions safely:
  ```javascript
  try {
    // route logic
  } catch (err) {
    return res.status(500).json({ message: "Internal server error" });
  }
  ```

---

### 3. NoSQL Injection Vulnerability in Coupon Code Query
- **Problem:** Passing raw `req.body.code` directly into `{ code: req.body.code }` allows NoSQL query injection (e.g. passing `{"$ne": null}` matches the first coupon in the database without knowing any valid code).
- **Solution:** Validate that `req.body.code` is strictly a non-empty string, trim spaces, and normalize to uppercase:
  ```javascript
  if (!req.body?.code || typeof req.body.code !== "string" || !req.body.code.trim()) {
    return res.status(400).json({ message: "Coupon code is required" });
  }
  const code = req.body.code.trim().toUpperCase();
  ```

---

### 4. Missing Validation for `req.body.amount` (Missing, Negative, or Non-Numeric)
- **Problem:** If `amount` is missing (`undefined`) or not a number (`"abc"`), the calculation produces `NaN` which serializes to `{ "finalAmount": null }` with a `200 OK` status; if `amount` is negative (`-50`), it allows invalid negative order balances.
- **Solution:** Validate that `amount` exists, is a finite number, and is non-negative:
  ```javascript
  if (req.body?.amount === undefined || req.body?.amount === null || req.body?.amount === "") {
    return res.status(400).json({ message: "Amount is missing" });
  }
  const amount = Number(req.body.amount);
  if (isNaN(amount) || !Number.isFinite(amount)) {
    return res.status(400).json({ message: "Amount is not a number" });
  }
  if (amount < 0) {
    return res.status(400).json({ message: "Amount cannot be negative" });
  }
  ```

---

### 5. Floating-Point Precision and Rounding Issues in Financial Calculation
- **Problem:** JavaScript floating-point arithmetic creates fractional cent artifacts (e.g. `19.99 - 19.99 * 15 / 100` becomes `16.991500000000002`), which causes payment gateway rejections.
- **Solution:** Round both the discount and final amount to 2 decimal places:
  ```javascript
  const discountAmount = Math.round(((amount * coupon.discount) / 100) * 100) / 100;
  const finalAmount = Math.max(0, Math.round((amount - discountAmount) * 100) / 100);
  ```

---

### 6. Unsafe Date Comparison for Expiry Check
- **Problem:** Comparing `coupon.expiresAt < new Date()` fails or produces unexpected results if `expiresAt` is stored as an ISO string or timestamp in the database.
- **Solution:** Convert `expiresAt` to a numeric timestamp before comparing:
  ```javascript
  const expiryTime = new Date(coupon.expiresAt).getTime();
  if (isNaN(expiryTime) || expiryTime <= Date.now()) {
    return res.status(400).json({ message: "Coupon has expired" });
  }
  ```

---

### 7. Missing Guard for Undefined `req.body`
- **Problem:** If a client sends a request without `Content-Type: application/json` or without a body, `req.body` is `undefined`, causing `req.body.code` to immediately throw a `TypeError`.
- **Solution:** Add a guard at the start of the route:
  ```javascript
  if (!req.body || typeof req.body !== "object") {
    return res.status(400).json({ message: "Invalid request payload" });
  }
  ```

---

### 8. Incomplete API Response Payload
- **Problem:** Returning only `{ finalAmount }` provides no transparency about what coupon was applied, what discount percentage was given, or how much money was saved.
- **Solution:** Include calculation breakdown metadata in the response:
  ```javascript
  res.status(200).json({
    success: true,
    code: coupon.code,
    originalAmount: Number(amount.toFixed(2)),
    discountPercent: coupon.discount,
    discountAmount: Number(discountAmount.toFixed(2)),
    finalAmount: Number(finalAmount.toFixed(2)),
  });
  ```

---

## Complete Fixed Code

```javascript
app.post("/apply", async (req, res) => {
  try {
    // 1. Guard against missing or malformed body
    if (!req.body || typeof req.body !== "object") {
      return res.status(400).json({ message: "Invalid request payload" });
    }

    const { code: rawCode, amount: rawAmount } = req.body;

    // 2. Validate Coupon Code (prevents NoSQL injection and empty inputs)
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
      return res.status(400).json({ message: "Amount is not a number" });
    }
    if (amount < 0) {
      return res.status(400).json({ message: "Amount cannot be negative" });
    }

    // 4. Fetch Coupon from Database
    const coupon = await Coupon.findOne({ code });

    // 5. Check if coupon exists (handles null case, prevents null.expiresAt crash)
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

    // 8. Return structured response
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
