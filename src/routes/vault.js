'use strict';

const { Router } = require('express');

const router = Router();

const VAULT_READ_ABI = [
  'function availableBalance() view returns (uint256)',
  'function lockedBalance() view returns (uint256)',
];

// GET /api/vault/balance
// Returns available + locked USDC balances from the on-chain contract.
// Returns zeros (configured: false) when env vars are absent — safe during dev.
router.get('/balance', async (req, res, next) => {
  try {
    const address   = process.env.COMMITMENT_VAULT_ADDRESS;
    const rpcUrl    = process.env.BASE_RPC_URL;
    const chainName = process.env.CHAIN_NAME || 'base';

    // MOCK_VAULT_BALANCE=available,locked  — for local/staging simulation without a deployed contract
    if (process.env.MOCK_VAULT_BALANCE) {
      const [avail = '0', lock = '0'] = process.env.MOCK_VAULT_BALANCE.split(',');
      return res.json({
        available_balance: parseFloat(avail).toFixed(2),
        locked_balance:    parseFloat(lock).toFixed(2),
        chain_name:        chainName,
        configured:        false,
        mock:              true,
      });
    }

    if (!address || !rpcUrl) {
      return res.json({
        available_balance: '0.00',
        locked_balance:    '0.00',
        chain_name:        chainName,
        configured:        false,
      });
    }

    const { ethers } = require('ethers');
    const provider   = new ethers.JsonRpcProvider(rpcUrl);
    const vault      = new ethers.Contract(address, VAULT_READ_ABI, provider);

    const [available, locked] = await Promise.all([
      vault.availableBalance(),
      vault.lockedBalance(),
    ]);

    const fmt = (wei) => Number(ethers.formatUnits(wei, 6)).toFixed(2);

    res.json({
      available_balance: fmt(available),
      locked_balance:    fmt(locked),
      chain_name:        chainName,
      configured:        true,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
