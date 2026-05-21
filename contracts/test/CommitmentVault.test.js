'use strict';

const { expect }    = require('chai');
const { ethers }    = require('hardhat');
const { loadFixture, time } = require('@nomicfoundation/hardhat-network-helpers');

const DECIMALS = 6;
const ONE_WEEK = 7 * 24 * 60 * 60;

// Parse USDC amounts (6 decimals)
const usdc = (n) => ethers.parseUnits(n.toString(), DECIMALS);

// Deterministic bytes32 from a string — mirrors backend toBytes32()
const toBytes32 = (s) => ethers.keccak256(ethers.toUtf8Bytes(s));

// ── Shared fixture ────────────────────────────────────────────────────────────

async function deployFixture() {
  const [owner, other] = await ethers.getSigners();

  const MockERC20 = await ethers.getContractFactory('MockERC20');
  const mockUSDC  = await MockERC20.deploy('USD Coin', 'USDC', DECIMALS);

  const CommitmentVault = await ethers.getContractFactory('CommitmentVault');
  const vault = await CommitmentVault.deploy(await mockUSDC.getAddress());

  // Fund owner with 10 000 USDC and pre-approve the vault
  await mockUSDC.mint(owner.address, usdc(10_000));
  await mockUSDC.approve(await vault.getAddress(), usdc(10_000));

  return { vault, mockUSDC, owner, other };
}

// Fixture that also pre-deposits 1 000 USDC
async function depositedFixture() {
  const ctx = await loadFixture(deployFixture);
  await ctx.vault.deposit(usdc(1_000));
  return ctx;
}

// ── deposit() ─────────────────────────────────────────────────────────────────

describe('deposit()', () => {
  it('transfers USDC into vault and updates availableBalance', async () => {
    const { vault, mockUSDC } = await loadFixture(deployFixture);
    await vault.deposit(usdc(1_000));
    expect(await mockUSDC.balanceOf(await vault.getAddress())).to.equal(usdc(1_000));
    expect(await vault.availableBalance()).to.equal(usdc(1_000));
  });

  it('emits Deposited', async () => {
    const { vault, owner } = await loadFixture(deployFixture);
    await expect(vault.deposit(usdc(500)))
      .to.emit(vault, 'Deposited')
      .withArgs(owner.address, usdc(500));
  });

  it('reverts for non-owner', async () => {
    const { vault, mockUSDC, other } = await loadFixture(deployFixture);
    await mockUSDC.mint(other.address, usdc(100));
    await mockUSDC.connect(other).approve(await vault.getAddress(), usdc(100));
    await expect(vault.connect(other).deposit(usdc(100)))
      .to.be.revertedWithCustomError(vault, 'OwnableUnauthorizedAccount');
  });
});

// ── executePenalty() ──────────────────────────────────────────────────────────

describe('executePenalty()', () => {
  const CID   = toBytes32('commitment-uuid-1');
  const RHASH = toBytes32('evaluation-uuid-1');

  it('transfers USDC to destination and emits PenaltyExecuted', async () => {
    const { vault, mockUSDC, other } = await loadFixture(depositedFixture);
    await expect(vault.executePenalty(CID, usdc(100), other.address, RHASH))
      .to.emit(vault, 'PenaltyExecuted')
      .withArgs(CID, other.address, usdc(100), RHASH);

    expect(await mockUSDC.balanceOf(other.address)).to.equal(usdc(100));
    expect(await vault.availableBalance()).to.equal(usdc(900));
  });

  it('reverts when available balance is insufficient', async () => {
    const { vault, other } = await loadFixture(depositedFixture);
    await expect(vault.executePenalty(CID, usdc(2_000), other.address, RHASH))
      .to.be.revertedWith('CommitmentVault: insufficient available balance');
  });

  it('reverts for non-owner', async () => {
    const { vault, other } = await loadFixture(depositedFixture);
    await expect(vault.connect(other).executePenalty(CID, usdc(10), other.address, RHASH))
      .to.be.revertedWithCustomError(vault, 'OwnableUnauthorizedAccount');
  });

  it('reverts when paused', async () => {
    const { vault, other } = await loadFixture(depositedFixture);
    await vault.pause();
    await expect(vault.executePenalty(CID, usdc(10), other.address, RHASH))
      .to.be.revertedWithCustomError(vault, 'EnforcedPause');
  });
});

// ── lockReward() ──────────────────────────────────────────────────────────────

describe('lockReward()', () => {
  it('locks funds, emits RewardLocked, reduces availableBalance', async () => {
    const { vault } = await loadFixture(depositedFixture);
    const cid  = toBytes32('c1');
    const unlockTs = (await time.latest()) + ONE_WEEK;

    await expect(vault.lockReward(cid, usdc(200), unlockTs))
      .to.emit(vault, 'RewardLocked')
      .withArgs(cid, usdc(200), unlockTs);

    expect(await vault.lockedBalance()).to.equal(usdc(200));
    expect(await vault.availableBalance()).to.equal(usdc(800));
  });

  it('locked funds are NOT withdrawable before unlock', async () => {
    const { vault } = await loadFixture(depositedFixture);
    const cid = toBytes32('c1');
    await vault.lockReward(cid, usdc(900), (await time.latest()) + ONE_WEEK);
    // Only 100 available — trying to withdraw 200 must revert
    await expect(vault.withdrawUnlocked(usdc(200)))
      .to.be.revertedWith('CommitmentVault: insufficient available balance');
  });

  it('reverts when paused', async () => {
    const { vault } = await loadFixture(depositedFixture);
    await vault.pause();
    const cid = toBytes32('c1');
    await expect(vault.lockReward(cid, usdc(100), (await time.latest()) + ONE_WEEK))
      .to.be.revertedWithCustomError(vault, 'EnforcedPause');
  });

  it('reverts when a lock already exists for that commitmentId', async () => {
    const { vault } = await loadFixture(depositedFixture);
    const cid = toBytes32('c1');
    const ts  = (await time.latest()) + ONE_WEEK;
    await vault.lockReward(cid, usdc(100), ts);
    await expect(vault.lockReward(cid, usdc(100), ts + ONE_WEEK))
      .to.be.revertedWith('CommitmentVault: lock already exists for commitmentId');
  });
});

// ── withdrawUnlocked() ───────────────────────────────────────────────────────

describe('withdrawUnlocked()', () => {
  it('sends USDC to owner and emits Withdrawn', async () => {
    const { vault, mockUSDC, owner } = await loadFixture(depositedFixture);
    const balBefore = await mockUSDC.balanceOf(owner.address);

    await expect(vault.withdrawUnlocked(usdc(400)))
      .to.emit(vault, 'Withdrawn')
      .withArgs(owner.address, usdc(400));

    // Owner balance: had 9 000 after deposit, now gets 400 back
    expect(await mockUSDC.balanceOf(owner.address)).to.equal(balBefore + usdc(400));
    expect(await vault.availableBalance()).to.equal(usdc(600));
  });

  it('reverts when trying to withdraw more than available balance', async () => {
    const { vault } = await loadFixture(depositedFixture);
    const cid = toBytes32('c1');
    await vault.lockReward(cid, usdc(800), (await time.latest()) + ONE_WEEK);
    // Only 200 available
    await expect(vault.withdrawUnlocked(usdc(300)))
      .to.be.revertedWith('CommitmentVault: insufficient available balance');
  });
});

// ── releaseExpiredLock() ──────────────────────────────────────────────────────

describe('releaseExpiredLock()', () => {
  it('releases lock after timestamp, restores availableBalance', async () => {
    const { vault } = await loadFixture(depositedFixture);
    const cid = toBytes32('c1');
    const unlockTs = (await time.latest()) + ONE_WEEK;
    await vault.lockReward(cid, usdc(500), unlockTs);

    await time.increaseTo(unlockTs);

    await expect(vault.releaseExpiredLock(cid))
      .to.emit(vault, 'LockReleased')
      .withArgs(cid, usdc(500));

    expect(await vault.lockedBalance()).to.equal(0n);
    expect(await vault.availableBalance()).to.equal(usdc(1_000));
  });

  it('reverts before unlock timestamp', async () => {
    const { vault } = await loadFixture(depositedFixture);
    const cid = toBytes32('c1');
    await vault.lockReward(cid, usdc(100), (await time.latest()) + ONE_WEEK);
    await expect(vault.releaseExpiredLock(cid))
      .to.be.revertedWith('CommitmentVault: lock not yet expired');
  });

  it('reverts when no lock exists for commitmentId', async () => {
    const { vault } = await loadFixture(depositedFixture);
    await expect(vault.releaseExpiredLock(toBytes32('ghost')))
      .to.be.revertedWith('CommitmentVault: no lock for commitmentId');
  });
});

// ── pause() ───────────────────────────────────────────────────────────────────

describe('pause()', () => {
  it('freezes executePenalty and lockReward', async () => {
    const { vault, other } = await loadFixture(depositedFixture);
    await vault.pause();

    const cid     = toBytes32('c1');
    const rHash   = toBytes32('e1');
    const unlockTs = (await time.latest()) + ONE_WEEK;

    await expect(vault.executePenalty(cid, usdc(10), other.address, rHash))
      .to.be.revertedWithCustomError(vault, 'EnforcedPause');
    await expect(vault.lockReward(cid, usdc(10), unlockTs))
      .to.be.revertedWithCustomError(vault, 'EnforcedPause');
  });

  it('allows operations after unpause', async () => {
    const { vault, other } = await loadFixture(depositedFixture);
    await vault.pause();
    await vault.unpause();

    const cid   = toBytes32('c1');
    const rHash = toBytes32('e1');
    await expect(vault.executePenalty(cid, usdc(10), other.address, rHash))
      .to.not.be.reverted;
  });
});

// ── Full integration flow ─────────────────────────────────────────────────────

describe('full flow: deposit → penalty → lockReward → release → withdraw', () => {
  it('executes the complete lifecycle correctly', async () => {
    const { vault, mockUSDC, other } = await loadFixture(deployFixture);

    // 1. Deposit 1 000 USDC
    await vault.deposit(usdc(1_000));
    expect(await vault.availableBalance()).to.equal(usdc(1_000));

    // 2. Penalty of 200 USDC on failed commitment
    const cid1  = toBytes32('commitment-failed');
    const rHash = toBytes32('evaluation-abc');
    await vault.executePenalty(cid1, usdc(200), other.address, rHash);
    expect(await vault.availableBalance()).to.equal(usdc(800));
    expect(await mockUSDC.balanceOf(other.address)).to.equal(usdc(200));

    // 3. Lock 300 USDC reward on passing commitment
    const cid2     = toBytes32('commitment-passed');
    const unlockTs = (await time.latest()) + 30 * 24 * 60 * 60;
    await vault.lockReward(cid2, usdc(300), unlockTs);
    expect(await vault.availableBalance()).to.equal(usdc(500));
    expect(await vault.lockedBalance()).to.equal(usdc(300));

    // 4. Release lock after 30 days
    await time.increaseTo(unlockTs);
    await vault.releaseExpiredLock(cid2);
    expect(await vault.availableBalance()).to.equal(usdc(800));
    expect(await vault.lockedBalance()).to.equal(0n);

    // 5. Withdraw all available funds
    await vault.withdrawUnlocked(usdc(800));
    expect(await vault.availableBalance()).to.equal(0n);
  });
});
