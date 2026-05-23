-- Add explicit penalty toggle to commitments.
-- When false, the pipeline skips creating a wallet_action on failure
-- even if penalty_wallet and penalty_amount_usdc are configured.
ALTER TABLE commitments
  ADD COLUMN IF NOT EXISTS penalty_enabled BOOLEAN NOT NULL DEFAULT FALSE;
