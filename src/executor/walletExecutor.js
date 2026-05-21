'use strict';

require('dotenv').config();
const { ethers } = require('ethers');
const pool = require('../db');

// Minimal ABI — only the functions the executor calls on CommitmentVault
const VAULT_ABI = [
  'function executePenalty(bytes32 commitmentId, uint256 amount, address destination, bytes32 reasonHash) external',
  'function lockReward(bytes32 commitmentId, uint256 amount, uint256 unlockTimestamp) external',
];

// Lazy singletons — created on first call so missing env vars surface at
// runtime (not at module load), keeping unit tests importable.
let _provider = null;
let _signer   = null;
let _vault    = null;

function getProvider() {
  if (!_provider) {
    const rpc = process.env.BASE_RPC_URL;
    if (!rpc) throw new Error('BASE_RPC_URL is not set');
    _provider = new ethers.JsonRpcProvider(rpc);
  }
  return _provider;
}

function getSigner() {
  if (!_signer) {
    const key = process.env.EXECUTOR_PRIVATE_KEY;
    if (!key) throw new Error('EXECUTOR_PRIVATE_KEY is not set');
    _signer = new ethers.Wallet(key, getProvider());
  }
  return _signer;
}

function getVault() {
  if (!_vault) {
    const address = process.env.COMMITMENT_VAULT_ADDRESS;
    if (!address) throw new Error('COMMITMENT_VAULT_ADDRESS is not set');
    _vault = new ethers.Contract(address, VAULT_ABI, getSigner());
  }
  return _vault;
}

/**
 * Deterministic bytes32 from a UUID string.
 * Both commitment IDs and evaluation IDs are hashed this way so the
 * on-chain event can be linked back to the DB row by re-computing the hash.
 */
function toBytes32(str) {
  return ethers.keccak256(ethers.toUtf8Bytes(str));
}

/**
 * Build and send the chain transaction for a single wallet_action row.
 * Returns the transaction receipt.
 *
 * @param {object} action  Row from wallet_actions (with commitment_id, evaluation_id, metadata, …)
 */
async function executeAction(action) {
  const vault = getVault();
  const commitmentId = toBytes32(action.commitment_id);

  if (action.action_type === 'penalty') {
    const reasonHash = toBytes32(action.evaluation_id);
    const amount     = ethers.parseUnits(action.amount_usdc.toString(), 6);

    const tx = await vault.executePenalty(
      commitmentId,
      amount,
      action.destination_wallet,
      reasonHash
    );
    return tx.wait();
  }

  if (action.action_type === 'reward') {
    const metadata = action.metadata || {};
    if (!metadata.unlock_timestamp) {
      throw new Error(`wallet_action ${action.id}: missing metadata.unlock_timestamp`);
    }

    const amount          = ethers.parseUnits(action.amount_usdc.toString(), 6);
    const unlockTimestamp = BigInt(metadata.unlock_timestamp);

    const tx = await vault.lockReward(commitmentId, amount, unlockTimestamp);
    return tx.wait();
  }

  throw new Error(`wallet_action ${action.id}: unknown action_type "${action.action_type}"`);
}

/**
 * Fetch all pending (non-dry-run) wallet_actions and execute them in order.
 *
 * State machine per action:
 *   pending → submitted (tx sent, tx_hash stored)
 *           → confirmed (receipt received)
 *     OR    → failed    (error saved; no automatic retry)
 *
 * We mark 'submitted' before awaiting the receipt so a process crash after
 * tx broadcast doesn't cause a double-send on the next run.
 *
 * @returns {Promise<Array<{id, ok, tx_hash?, error?}>>}
 */
async function processPending() {
  const { rows: actions } = await pool.query(
    `SELECT * FROM wallet_actions
     WHERE status = 'pending' AND dry_run = false
     ORDER BY created_at ASC`
  );

  if (!actions.length) {
    console.log('[executor] no pending actions');
    return [];
  }

  console.log(`[executor] processing ${actions.length} pending action(s)`);

  const results = [];

  for (const action of actions) {
    try {
      // Mark submitted before awaiting receipt — protects against double-send
      await pool.query(
        `UPDATE wallet_actions SET status = 'submitted', executed_at = NOW() WHERE id = $1`,
        [action.id]
      );

      const receipt = await executeAction(action);

      await pool.query(
        `UPDATE wallet_actions SET status = 'confirmed', tx_hash = $2 WHERE id = $1`,
        [action.id, receipt.hash]
      );

      console.log(`[executor] confirmed action=${action.id} tx=${receipt.hash}`);
      results.push({ id: action.id, ok: true, tx_hash: receipt.hash });
    } catch (err) {
      await pool.query(
        `UPDATE wallet_actions SET status = 'failed', error_message = $2 WHERE id = $1`,
        [action.id, err.message]
      );
      console.error(`[executor] failed action=${action.id}: ${err.message}`);
      results.push({ id: action.id, ok: false, error: err.message });
    }
  }

  return results;
}

// Expose for testing
module.exports = { processPending, toBytes32, executeAction };
