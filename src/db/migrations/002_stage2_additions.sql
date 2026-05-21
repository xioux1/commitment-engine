-- Stage 2 additions: reward configuration on commitments,
-- metadata on wallet_actions for executor parameters.

ALTER TABLE commitments
  ADD COLUMN IF NOT EXISTS reward_amount_usdc  NUMERIC(18, 6),
  ADD COLUMN IF NOT EXISTS reward_lock_days    INT NOT NULL DEFAULT 30;

-- Stores executor-specific params per action type.
-- For 'reward' actions: { "unlock_timestamp": <unix seconds> }
ALTER TABLE wallet_actions
  ADD COLUMN IF NOT EXISTS metadata JSONB;
