'use strict';

const { ethers, network } = require('hardhat');

// Native USDC addresses on Base networks (Circle)
const USDC_MAINNET  = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const USDC_SEPOLIA  = '0x036CbD53842c5426634e7929541eC2318f3dCF7e';

async function main() {
  const [deployer] = await ethers.getSigners();
  const net = network.name;

  console.log(`[deploy] network  : ${net}`);
  console.log(`[deploy] deployer : ${deployer.address}`);

  // Resolve USDC address — deploy MockERC20 on local networks
  let usdcAddress;
  if (net === 'base') {
    usdcAddress = USDC_MAINNET;
  } else if (net === 'baseSepolia') {
    usdcAddress = USDC_SEPOLIA;
  } else {
    console.log('[deploy] local network — deploying MockERC20…');
    const Mock = await ethers.getContractFactory('MockERC20');
    const mock = await Mock.deploy('USD Coin', 'USDC', 6);
    await mock.waitForDeployment();
    usdcAddress = await mock.getAddress();
    console.log(`[deploy] MockERC20 : ${usdcAddress}`);
  }

  console.log(`[deploy] USDC      : ${usdcAddress}`);
  console.log('[deploy] deploying CommitmentVault…');

  const Vault = await ethers.getContractFactory('CommitmentVault');
  const vault = await Vault.deploy(usdcAddress);
  await vault.waitForDeployment();

  const vaultAddress = await vault.getAddress();
  console.log(`[deploy] CommitmentVault : ${vaultAddress}`);

  if (net !== 'hardhat' && net !== 'localhost') {
    console.log('[deploy] waiting 5 confirmations before verify…');
    await vault.deploymentTransaction().wait(5);
    console.log('[deploy] run to verify on Basescan:');
    console.log(`  npx hardhat verify --network ${net} ${vaultAddress} ${usdcAddress}`);
  }

  // Print env var snippet for the backend
  console.log('\n[deploy] add to .env:');
  console.log(`  COMMITMENT_VAULT_ADDRESS=${vaultAddress}`);
  if (net !== 'base' && net !== 'baseSepolia') {
    console.log(`  USDC_ADDRESS=${usdcAddress}`);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
