// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title  CommitmentVault
 * @notice Custody contract for USDC-backed commitment enforcement.
 *
 *         The owner (backend) is the sole oracle.  The contract knows nothing
 *         about study goals, metrics, or evaluation logic — it is a custody
 *         box with three levers: penalize, lock-reward, withdraw.
 *
 *         Owner is set to msg.sender at deploy time (OpenZeppelin Ownable v5).
 *         Same key that deploys signs every executePenalty / lockReward call.
 */
contract CommitmentVault is Ownable, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    IERC20 public immutable usdc;

    /// Running total of USDC held in active reward locks.
    uint256 public lockedBalance;

    struct LockedReward {
        uint256 amount;
        uint256 unlockTimestamp;
    }

    /// One active lock per commitmentId. Reset on releaseExpiredLock.
    mapping(bytes32 => LockedReward) public lockedRewards;

    // ── Events ────────────────────────────────────────────────────────────────

    event Deposited(address indexed from, uint256 amount);

    event PenaltyExecuted(
        bytes32 indexed commitmentId,
        address indexed destination,
        uint256 amount,
        bytes32 reasonHash          // keccak256(evaluationId) — links tx to DB record
    );

    event RewardLocked(
        bytes32 indexed commitmentId,
        uint256 amount,
        uint256 unlockTimestamp
    );

    event LockReleased(bytes32 indexed commitmentId, uint256 amount);

    event Withdrawn(address indexed to, uint256 amount);

    // ── Constructor ───────────────────────────────────────────────────────────

    constructor(address _usdc) Ownable(msg.sender) {
        require(_usdc != address(0), "CommitmentVault: zero USDC address");
        usdc = IERC20(_usdc);
    }

    // ── View ──────────────────────────────────────────────────────────────────

    /// @return Total vault balance minus active reward locks.
    function availableBalance() public view returns (uint256) {
        uint256 total = usdc.balanceOf(address(this));
        return total > lockedBalance ? total - lockedBalance : 0;
    }

    // ── Owner mutations ───────────────────────────────────────────────────────

    /**
     * @notice Pull USDC from the owner wallet into the vault.
     *         Caller must approve this contract on the USDC token first.
     */
    function deposit(uint256 amount) external onlyOwner {
        require(amount > 0, "CommitmentVault: amount must be > 0");
        usdc.safeTransferFrom(msg.sender, address(this), amount);
        emit Deposited(msg.sender, amount);
    }

    /**
     * @notice Transfer USDC to a penalty destination on commitment failure.
     * @param commitmentId  keccak256(UTF-8 commitment UUID) from the backend DB.
     * @param amount        USDC amount in 6-decimal precision.
     * @param destination   Wallet receiving the penalty.
     * @param reasonHash    keccak256(UTF-8 evaluationId) — immutable audit link.
     */
    function executePenalty(
        bytes32 commitmentId,
        uint256 amount,
        address destination,
        bytes32 reasonHash
    ) external onlyOwner nonReentrant whenNotPaused {
        require(amount > 0, "CommitmentVault: amount must be > 0");
        require(destination != address(0), "CommitmentVault: zero destination");
        require(availableBalance() >= amount, "CommitmentVault: insufficient available balance");

        usdc.safeTransfer(destination, amount);
        emit PenaltyExecuted(commitmentId, destination, amount, reasonHash);
    }

    /**
     * @notice Lock USDC as a reward that cannot be withdrawn until unlockTimestamp.
     * @param commitmentId    keccak256(UTF-8 commitment UUID).
     * @param amount          USDC amount to lock (6-decimal precision).
     * @param unlockTimestamp Unix timestamp after which releaseExpiredLock may be called.
     */
    function lockReward(
        bytes32 commitmentId,
        uint256 amount,
        uint256 unlockTimestamp
    ) external onlyOwner nonReentrant whenNotPaused {
        require(amount > 0, "CommitmentVault: amount must be > 0");
        require(unlockTimestamp > block.timestamp, "CommitmentVault: unlock must be in the future");
        require(availableBalance() >= amount, "CommitmentVault: insufficient available balance");
        require(
            lockedRewards[commitmentId].amount == 0,
            "CommitmentVault: lock already exists for commitmentId"
        );

        lockedBalance += amount;
        lockedRewards[commitmentId] = LockedReward({ amount: amount, unlockTimestamp: unlockTimestamp });
        emit RewardLocked(commitmentId, amount, unlockTimestamp);
    }

    /**
     * @notice Release an expired reward lock, returning funds to the available balance.
     *         Call this before withdrawUnlocked to access previously locked funds.
     */
    function releaseExpiredLock(bytes32 commitmentId) external onlyOwner {
        LockedReward storage lock = lockedRewards[commitmentId];
        require(lock.amount > 0, "CommitmentVault: no lock for commitmentId");
        require(block.timestamp >= lock.unlockTimestamp, "CommitmentVault: lock not yet expired");

        uint256 amount = lock.amount;
        lockedBalance -= amount;
        delete lockedRewards[commitmentId];
        emit LockReleased(commitmentId, amount);
    }

    /**
     * @notice Withdraw USDC from the available (non-locked) balance to the owner wallet.
     */
    function withdrawUnlocked(uint256 amount) external onlyOwner nonReentrant {
        require(amount > 0, "CommitmentVault: amount must be > 0");
        require(availableBalance() >= amount, "CommitmentVault: insufficient available balance");

        usdc.safeTransfer(owner(), amount);
        emit Withdrawn(owner(), amount);
    }

    function pause()   external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }
}
