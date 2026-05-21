'use strict';

require('@nomicfoundation/hardhat-toolbox');
require('dotenv').config({ path: '../.env' });

const { subtask }  = require('hardhat/config');
const { TASK_COMPILE_SOLIDITY_GET_SOLC_BUILD } = require('hardhat/builtin-tasks/task-names');
const path = require('path');

// In the sandboxed CI environment, soliditylang.org is blocked.
// Override the compiler resolution subtask to use the bundled solcjs package
// instead of trying to download a native binary.
subtask(TASK_COMPILE_SOLIDITY_GET_SOLC_BUILD, async (_args, _hre, runSuper) => {
  return {
    compilerPath: path.resolve(__dirname, 'node_modules/solc/soljson.js'),
    isSolcJs:    true,
    version:     '0.8.26',
    longVersion: '0.8.26+commit.8a97fa7a',
  };
});

const PRIVATE_KEY          = process.env.EXECUTOR_PRIVATE_KEY    || '0x' + '0'.repeat(64);
const BASE_RPC_URL         = process.env.BASE_RPC_URL             || 'https://mainnet.base.org';
const BASE_SEPOLIA_RPC_URL = process.env.BASE_SEPOLIA_RPC_URL     || 'https://sepolia.base.org';
const BASESCAN_API_KEY     = process.env.BASESCAN_API_KEY         || '';

module.exports = {
  solidity: {
    version: '0.8.26',
    settings: {
      optimizer: { enabled: true, runs: 200 },
    },
  },

  networks: {
    hardhat: {},
    baseSepolia: {
      url:      BASE_SEPOLIA_RPC_URL,
      accounts: [PRIVATE_KEY],
      chainId:  84532,
    },
    base: {
      url:      BASE_RPC_URL,
      accounts: [PRIVATE_KEY],
      chainId:  8453,
    },
  },

  etherscan: {
    apiKey: {
      baseSepolia: BASESCAN_API_KEY,
      base:        BASESCAN_API_KEY,
    },
    customChains: [
      {
        network:  'baseSepolia',
        chainId:  84532,
        urls: {
          apiURL:     'https://api-sepolia.basescan.org/api',
          browserURL: 'https://sepolia.basescan.org',
        },
      },
      {
        network:  'base',
        chainId:  8453,
        urls: {
          apiURL:     'https://api.basescan.org/api',
          browserURL: 'https://basescan.org',
        },
      },
    ],
  },
};
