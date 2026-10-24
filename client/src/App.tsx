import React, { useState, useEffect } from 'react';

interface Coupon {
  id: string;
  code: string;
  discount: number;
  expiryDate: string;
  createdAt: string;
  isExpired?: boolean;
}

export const App: React.FC = () => {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  // Form state
  const [code, setCode] = useState<string>('');
  const [discount, setDiscount] = useState<number | string>(20);
  const [expiryDate, setExpiryDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().split('T')[0];
  });

  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);

  const fetchCoupons = async () => {
    setLoading(true);
    try {
      const res = await fetch('/coupons');
      const data = await res.json();
      if (res.ok && data.data) {
        setCoupons(data.data);
      } else {
        setMessage({ type: 'error', text: data.message || 'Failed to fetch coupons' });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Network error fetching coupons' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCoupons();
  }, []);

  const handleCreateCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    if (!code.trim()) {
      setMessage({ type: 'error', text: 'Coupon code is required' });
      return;
    }

    const numDiscount = Number(discount);
    if (isNaN(numDiscount) || numDiscount < 1 || numDiscount > 90) {
      setMessage({ type: 'error', text: 'Discount percent must be between 1 and 90' });
      return;
    }

    if (!expiryDate) {
      setMessage({ type: 'error', text: 'Expiry date is required' });
      return;
    }

    setSubmitting(true);
    try {
      const fullExpiryDate = new Date(`${expiryDate}T23:59:59.000Z`).toISOString();
      const res = await fetch('/coupons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: code.trim().toUpperCase(),
          discount: numDiscount,
          expiryDate: fullExpiryDate,
        }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setMessage({
          type: 'success',
          text: `Coupon "${data.data.code}" created successfully with ${data.data.discount}% discount.`,
        });
        setCode('');
        setDiscount(20);
        fetchCoupons();
      } else {
        setMessage({
          type: 'error',
          text: data.message || 'Failed to create coupon',
        });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Error connecting to server' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="container">
      <h1>Coupon Management</h1>
      <p>A simple React page to create discount coupons and list them.</p>

      {/* Message Banner */}
      {message && (
        <div className={`message ${message.type === 'success' ? 'message-success' : 'message-error'}`}>
          {message.text}
        </div>
      )}

      {/* Create Coupon Form */}
      <div className="section">
        <h2>Create Coupon</h2>
        <form onSubmit={handleCreateCoupon}>
          <div className="form-group">
            <label htmlFor="code">Coupon Code:</label>
            <input
              id="code"
              type="text"
              placeholder="e.g. SAVE20"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              required
            />
            <div className="helper-text">Alphanumeric, hyphens, and underscores. Converted to uppercase.</div>
          </div>

          <div className="form-group">
            <label htmlFor="discount">Discount Percent (1 to 90):</label>
            <input
              id="discount"
              type="number"
              min="1"
              max="90"
              placeholder="e.g. 20"
              value={discount}
              onChange={(e) => setDiscount(e.target.value)}
              required
            />
            <div className="helper-text">Must be a number from 1 to 90.</div>
          </div>

          <div className="form-group">
            <label htmlFor="expiryDate">Expiry Date:</label>
            <input
              id="expiryDate"
              type="date"
              value={expiryDate}
              onChange={(e) => setExpiryDate(e.target.value)}
              required
            />
            <div className="helper-text">Must be a date in the future.</div>
          </div>

          <button type="submit" disabled={submitting}>
            {submitting ? 'Creating...' : 'Create Coupon'}
          </button>
        </form>
      </div>

      {/* Coupons List Table */}
      <div className="section">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2>All Coupons ({coupons.length})</h2>
          <button type="button" className="btn-secondary" onClick={fetchCoupons} disabled={loading}>
            {loading ? 'Refreshing...' : 'Refresh List'}
          </button>
        </div>

        {coupons.length === 0 ? (
          <p>No coupons found. Create one using the form above.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Code</th>
                <th>Discount</th>
                <th>Expiry Date</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {coupons.map((coupon) => {
                const isExpired = coupon.isExpired ?? new Date(coupon.expiryDate).getTime() <= Date.now();
                const formattedDate = new Date(coupon.expiryDate).toLocaleDateString();

                return (
                  <tr key={coupon.id || coupon.code}>
                    <td><strong>{coupon.code}</strong></td>
                    <td>{coupon.discount}%</td>
                    <td>{formattedDate}</td>
                    <td>
                      {isExpired ? (
                        <span className="badge-expired">Expired</span>
                      ) : (
                        <span className="badge-active">Active</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default App;
