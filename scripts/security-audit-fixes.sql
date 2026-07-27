-- Security audit fixes (run against Neon/Postgres before or with deploy)
-- 1) Prevent Razorpay payment-id replay on payments table
--    (Postgres UNIQUE allows multiple NULLs — safe for pending rows)

CREATE UNIQUE INDEX IF NOT EXISTS pay_razorpay_payment_id_uq
  ON payments (razorpay_payment_id)
  WHERE razorpay_payment_id IS NOT NULL;
