// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

interface IArbitratorNFT {
    function isArbitrator(address addr) external view returns (bool);
    function getHighestTier(address[] calldata arbitrators) external view returns (uint256);
    function recordInvoiceCompleted(address a) external;
    function recordDisputeStart(address a) external;
    function recordDisputeResolved(address a) external;
}

/**
 * @title InvoiceEscrow
 * @notice Escrow-based invoice system with milestone payments and dispute resolution.
 *
 * Flow:
 *  1. Client createInvoice() — locks totalAmount + clientDisputeDeposit (5%, min 50 USDC)
 *  2. Vendor acceptInvoice() — locks vendorDisputeDeposit (same amount)
 *  3. Vendor submitMilestone() when work phase is done
 *  4. Client approveMilestone() → USDC released to vendor (minus arb fee + platform fee)
 *     OR client silent 7 days → Vendor claimMilestoneAutoRelease()
 *  5. Either party openDispute() on any SUBMITTED milestone
 *  6. All arbitrators voteDispute() → unanimous verdict executes payout
 */
contract InvoiceEscrow is ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;

    // ── Constants ──────────────────────────────────────────────────────────────

    address public constant USDC = 0x3600000000000000000000000000000000000000;
    uint256 public constant AUTO_RELEASE_PERIOD = 7 days;
    uint256 public constant MIN_DISPUTE_FEE = 50e18;   // 50 USDC (18 dec)
    uint256 public constant DISPUTE_FEE_BPS = 500;     // 5%
    uint256 public constant BPS_BASE = 10_000;
    uint256 public constant MIN_ARBITRATORS = 3;
    uint256 public constant MAX_ARBITRATORS = 5;

    // ── Types ─────────────────────────────────────────────────────────────────

    enum InvoiceStatus  { CREATED, ACTIVE, COMPLETED, CANCELLED, DISPUTED }
    enum MilestoneStatus{ PENDING, SUBMITTED, APPROVED, AUTO_RELEASED, DISPUTED, RESOLVED }

    struct Milestone {
        string  description;
        uint256 amount;
        uint256 startDate;
        uint256 dueDate;
        uint256 submittedAt;
        MilestoneStatus status;
    }

    struct DisputeVote {
        mapping(address => bool) hasVoted;
        mapping(address => bool) voteFavorClient;
        uint256 voteCount;
        bool    resolved;
        bool    clientWins;
    }

    struct Invoice {
        uint256      id;
        address      client;
        address      vendor;
        address[]    arbitrators;
        string       content;
        uint256      totalAmount;
        uint256      clientDisputeDeposit;
        uint256      vendorDisputeDeposit;
        uint256      createdAt;
        InvoiceStatus status;
        Milestone[]  milestones;
    }

    // ── Storage ───────────────────────────────────────────────────────────────

    IArbitratorNFT public arbitratorNFT;
    address public feeCollector;
    uint256 public platformFeeBps = 100; // 1%

    uint256 private _nextId = 1;
    mapping(uint256 => Invoice) private _invoices;
    mapping(uint256 => mapping(uint256 => DisputeVote)) private _votes;

    // ── Events ────────────────────────────────────────────────────────────────

    event InvoiceCreated(uint256 indexed id, address indexed client, address indexed vendor, uint256 totalAmount, uint256 milestoneCount);
    event InvoiceAccepted(uint256 indexed id);
    event MilestoneSubmitted(uint256 indexed invoiceId, uint256 milestoneIndex);
    event MilestoneApproved(uint256 indexed invoiceId, uint256 milestoneIndex, uint256 amount);
    event MilestoneAutoReleased(uint256 indexed invoiceId, uint256 milestoneIndex);
    event DisputeOpened(uint256 indexed invoiceId, uint256 milestoneIndex, address by);
    event ArbitratorVoted(uint256 indexed invoiceId, uint256 milestoneIndex, address arbitrator, bool favorClient);
    event DisputeResolved(uint256 indexed invoiceId, uint256 milestoneIndex, bool clientWins);
    event InvoiceCancelled(uint256 indexed id);
    event InvoiceCompleted(uint256 indexed id);

    // ── Constructor ───────────────────────────────────────────────────────────

    constructor(address _arbitratorNFT, address _feeCollector) Ownable(msg.sender) {
        arbitratorNFT = IArbitratorNFT(_arbitratorNFT);
        feeCollector  = _feeCollector;
    }

    // ── Modifiers ─────────────────────────────────────────────────────────────

    modifier onlyClient(uint256 id)     { require(_invoices[id].client == msg.sender,  "Not client"); _; }
    modifier onlyVendor(uint256 id)     { require(_invoices[id].vendor == msg.sender,  "Not vendor"); _; }
    modifier exists(uint256 id)         { require(_invoices[id].id != 0, "Not found"); _; }
    modifier onlyArbitrator(uint256 id) { require(_isArbitrator(id, msg.sender), "Not arbitrator"); _; }

    // ── Core ──────────────────────────────────────────────────────────────────

    /**
     * @notice Client creates invoice, locking total + dispute deposit.
     */
    function createInvoice(
        address vendor,
        address[] calldata arbitrators,
        string calldata content,
        string[] calldata milestoneDescs,
        uint256[] calldata milestoneAmounts,
        uint256[] calldata milestoneStarts,
        uint256[] calldata milestoneDues
    ) external nonReentrant returns (uint256 invoiceId) {
        require(vendor != address(0) && vendor != msg.sender, "Bad vendor");
        require(arbitrators.length >= MIN_ARBITRATORS && arbitrators.length <= MAX_ARBITRATORS, "3-5 arbs");
        require(milestoneDescs.length == milestoneAmounts.length &&
                milestoneAmounts.length == milestoneStarts.length &&
                milestoneStarts.length  == milestoneDues.length, "Array mismatch");
        require(milestoneAmounts.length > 0, "No milestones");

        for (uint256 i = 0; i < arbitrators.length; i++)
            require(arbitratorNFT.isArbitrator(arbitrators[i]), "Invalid arbitrator");

        uint256 total = 0;
        for (uint256 i = 0; i < milestoneAmounts.length; i++) {
            require(milestoneAmounts[i] > 0, "Zero amount");
            total += milestoneAmounts[i];
        }

        uint256 deposit = _disputeDeposit(total);
        IERC20(USDC).safeTransferFrom(msg.sender, address(this), total + deposit);

        invoiceId = _nextId++;
        Invoice storage inv = _invoices[invoiceId];
        inv.id = invoiceId;
        inv.client = msg.sender;
        inv.vendor = vendor;
        inv.content = content;
        inv.totalAmount = total;
        inv.clientDisputeDeposit = deposit;
        inv.createdAt = block.timestamp;
        inv.status = InvoiceStatus.CREATED;

        for (uint256 i = 0; i < arbitrators.length; i++) inv.arbitrators.push(arbitrators[i]);
        for (uint256 i = 0; i < milestoneAmounts.length; i++) {
            inv.milestones.push(Milestone({
                description: milestoneDescs[i],
                amount:      milestoneAmounts[i],
                startDate:   milestoneStarts[i],
                dueDate:     milestoneDues[i],
                submittedAt: 0,
                status:      MilestoneStatus.PENDING
            }));
        }

        emit InvoiceCreated(invoiceId, msg.sender, vendor, total, milestoneAmounts.length);
    }

    /**
     * @notice Vendor accepts invoice and locks dispute deposit.
     */
    function acceptInvoice(uint256 invoiceId) external nonReentrant exists(invoiceId) onlyVendor(invoiceId) {
        Invoice storage inv = _invoices[invoiceId];
        require(inv.status == InvoiceStatus.CREATED, "Wrong state");

        uint256 deposit = _disputeDeposit(inv.totalAmount);
        inv.vendorDisputeDeposit = deposit;
        IERC20(USDC).safeTransferFrom(msg.sender, address(this), deposit);
        inv.status = InvoiceStatus.ACTIVE;

        emit InvoiceAccepted(invoiceId);
    }

    /**
     * @notice Vendor submits milestone as done.
     */
    function submitMilestone(uint256 invoiceId, uint256 idx) external exists(invoiceId) onlyVendor(invoiceId) {
        Invoice storage inv = _invoices[invoiceId];
        require(inv.status == InvoiceStatus.ACTIVE, "Not active");
        require(idx < inv.milestones.length, "Bad index");
        require(inv.milestones[idx].status == MilestoneStatus.PENDING, "Not pending");

        inv.milestones[idx].status      = MilestoneStatus.SUBMITTED;
        inv.milestones[idx].submittedAt = block.timestamp;
        emit MilestoneSubmitted(invoiceId, idx);
    }

    /**
     * @notice Client approves milestone → releases payment to vendor.
     */
    function approveMilestone(uint256 invoiceId, uint256 idx) external nonReentrant exists(invoiceId) onlyClient(invoiceId) {
        Milestone storage ms = _invoices[invoiceId].milestones[idx];
        require(ms.status == MilestoneStatus.SUBMITTED, "Not submitted");

        ms.status = MilestoneStatus.APPROVED;
        _releaseMilestone(invoiceId, idx);
        emit MilestoneApproved(invoiceId, idx, ms.amount);
        _checkCompletion(invoiceId);
    }

    /**
     * @notice Vendor claims payment after 7-day silence (auto-release).
     */
    function claimMilestoneAutoRelease(uint256 invoiceId, uint256 idx) external nonReentrant exists(invoiceId) onlyVendor(invoiceId) {
        Milestone storage ms = _invoices[invoiceId].milestones[idx];
        require(ms.status == MilestoneStatus.SUBMITTED, "Not submitted");
        require(block.timestamp >= ms.submittedAt + AUTO_RELEASE_PERIOD, "Period not elapsed");

        ms.status = MilestoneStatus.AUTO_RELEASED;
        _releaseMilestone(invoiceId, idx);
        emit MilestoneAutoReleased(invoiceId, idx);
        _checkCompletion(invoiceId);
    }

    /**
     * @notice Either party opens dispute on a submitted milestone.
     */
    function openDispute(uint256 invoiceId, uint256 idx) external exists(invoiceId) {
        Invoice storage inv = _invoices[invoiceId];
        require(msg.sender == inv.client || msg.sender == inv.vendor, "Not a party");
        require(inv.status == InvoiceStatus.ACTIVE, "Not active");
        require(inv.milestones[idx].status == MilestoneStatus.SUBMITTED, "Not submitted");

        inv.milestones[idx].status = MilestoneStatus.DISPUTED;
        inv.status = InvoiceStatus.DISPUTED;

        for (uint256 i = 0; i < inv.arbitrators.length; i++)
            arbitratorNFT.recordDisputeStart(inv.arbitrators[i]);

        emit DisputeOpened(invoiceId, idx, msg.sender);
    }

    /**
     * @notice Arbitrator votes. All must vote unanimously.
     * @param favorClient true = refund client, false = pay vendor
     */
    function voteDispute(uint256 invoiceId, uint256 idx, bool favorClient)
        external nonReentrant exists(invoiceId) onlyArbitrator(invoiceId)
    {
        Invoice storage inv = _invoices[invoiceId];
        require(inv.status == InvoiceStatus.DISPUTED, "Not disputed");
        require(inv.milestones[idx].status == MilestoneStatus.DISPUTED, "Milestone not disputed");

        DisputeVote storage v = _votes[invoiceId][idx];
        require(!v.hasVoted[msg.sender], "Already voted");
        require(!v.resolved, "Resolved");

        v.hasVoted[msg.sender]         = true;
        v.voteFavorClient[msg.sender]  = favorClient;
        v.voteCount++;

        emit ArbitratorVoted(invoiceId, idx, msg.sender, favorClient);

        if (v.voteCount == inv.arbitrators.length) {
            bool unanimous = true;
            bool first = v.voteFavorClient[inv.arbitrators[0]];
            for (uint256 i = 1; i < inv.arbitrators.length; i++) {
                if (v.voteFavorClient[inv.arbitrators[i]] != first) { unanimous = false; break; }
            }
            if (unanimous) {
                v.resolved   = true;
                v.clientWins = first;
                inv.milestones[idx].status = MilestoneStatus.RESOLVED;
                _executeVerdict(invoiceId, idx, first);
                emit DisputeResolved(invoiceId, idx, first);
                _checkCompletion(invoiceId);
            }
        }
    }

    /**
     * @notice Client cancels invoice before vendor accepts.
     */
    function cancelInvoice(uint256 invoiceId) external nonReentrant exists(invoiceId) onlyClient(invoiceId) {
        Invoice storage inv = _invoices[invoiceId];
        require(inv.status == InvoiceStatus.CREATED, "Can only cancel CREATED");
        inv.status = InvoiceStatus.CANCELLED;
        IERC20(USDC).safeTransfer(inv.client, inv.totalAmount + inv.clientDisputeDeposit);
        emit InvoiceCancelled(invoiceId);
    }

    // ── Internal ──────────────────────────────────────────────────────────────

    function _releaseMilestone(uint256 invoiceId, uint256 idx) internal {
        Invoice storage inv = _invoices[invoiceId];
        uint256 amount = inv.milestones[idx].amount;
        uint256 arbFee = _arbFee(invoiceId, amount);
        uint256 platFee = (amount * platformFeeBps) / BPS_BASE;
        uint256 vendorAmt = amount - arbFee - platFee;

        if (arbFee > 0) {
            uint256 perArb = arbFee / inv.arbitrators.length;
            for (uint256 i = 0; i < inv.arbitrators.length; i++) {
                IERC20(USDC).safeTransfer(inv.arbitrators[i], perArb);
                arbitratorNFT.recordInvoiceCompleted(inv.arbitrators[i]);
            }
        }
        if (platFee > 0) IERC20(USDC).safeTransfer(feeCollector, platFee);
        IERC20(USDC).safeTransfer(inv.vendor, vendorAmt);
    }

    function _executeVerdict(uint256 invoiceId, uint256 idx, bool clientWins) internal {
        Invoice storage inv = _invoices[invoiceId];
        uint256 amount = inv.milestones[idx].amount;
        uint256 disputeFee = _disputeDeposit(amount);
        uint256 perArb = disputeFee / inv.arbitrators.length;

        for (uint256 i = 0; i < inv.arbitrators.length; i++) {
            IERC20(USDC).safeTransfer(inv.arbitrators[i], perArb);
            arbitratorNFT.recordDisputeResolved(inv.arbitrators[i]);
        }

        if (clientWins) {
            IERC20(USDC).safeTransfer(inv.client, amount);
            if (inv.clientDisputeDeposit > disputeFee)
                IERC20(USDC).safeTransfer(inv.client, inv.clientDisputeDeposit - disputeFee);
        } else {
            uint256 platFee = (amount * platformFeeBps) / BPS_BASE;
            if (platFee > 0) IERC20(USDC).safeTransfer(feeCollector, platFee);
            IERC20(USDC).safeTransfer(inv.vendor, amount - platFee);
            if (inv.vendorDisputeDeposit > disputeFee)
                IERC20(USDC).safeTransfer(inv.vendor, inv.vendorDisputeDeposit - disputeFee);
        }

        inv.status = InvoiceStatus.ACTIVE;
    }

    function _checkCompletion(uint256 invoiceId) internal {
        Invoice storage inv = _invoices[invoiceId];
        if (inv.status == InvoiceStatus.COMPLETED) return;
        for (uint256 i = 0; i < inv.milestones.length; i++) {
            MilestoneStatus s = inv.milestones[i].status;
            if (s != MilestoneStatus.APPROVED && s != MilestoneStatus.AUTO_RELEASED && s != MilestoneStatus.RESOLVED)
                return;
        }
        inv.status = InvoiceStatus.COMPLETED;
        if (inv.clientDisputeDeposit > 0) {
            IERC20(USDC).safeTransfer(inv.client, inv.clientDisputeDeposit);
            inv.clientDisputeDeposit = 0;
        }
        if (inv.vendorDisputeDeposit > 0) {
            IERC20(USDC).safeTransfer(inv.vendor, inv.vendorDisputeDeposit);
            inv.vendorDisputeDeposit = 0;
        }
        emit InvoiceCompleted(invoiceId);
    }

    function _disputeDeposit(uint256 amount) internal pure returns (uint256) {
        uint256 fee = (amount * DISPUTE_FEE_BPS) / BPS_BASE;
        return fee < MIN_DISPUTE_FEE ? MIN_DISPUTE_FEE : fee;
    }

    function _arbFee(uint256 invoiceId, uint256 amount) internal view returns (uint256) {
        uint256 tier = arbitratorNFT.getHighestTier(_invoices[invoiceId].arbitrators);
        uint256 bps  = tier == 2 ? 100 : tier == 1 ? 70 : 50;
        return (amount * bps) / BPS_BASE;
    }

    function _isArbitrator(uint256 id, address addr) internal view returns (bool) {
        address[] storage arbs = _invoices[id].arbitrators;
        for (uint256 i = 0; i < arbs.length; i++) if (arbs[i] == addr) return true;
        return false;
    }

    // ── Views ─────────────────────────────────────────────────────────────────

    function getInvoice(uint256 invoiceId) external view exists(invoiceId) returns (
        address client, address vendor, address[] memory arbitrators,
        string memory content, uint256 totalAmount, InvoiceStatus status,
        uint256 createdAt, uint256 milestoneCount
    ) {
        Invoice storage inv = _invoices[invoiceId];
        return (inv.client, inv.vendor, inv.arbitrators, inv.content,
                inv.totalAmount, inv.status, inv.createdAt, inv.milestones.length);
    }

    function getMilestone(uint256 invoiceId, uint256 idx) external view exists(invoiceId) returns (
        string memory description, uint256 amount, uint256 startDate,
        uint256 dueDate, uint256 submittedAt, MilestoneStatus status
    ) {
        Milestone storage ms = _invoices[invoiceId].milestones[idx];
        return (ms.description, ms.amount, ms.startDate, ms.dueDate, ms.submittedAt, ms.status);
    }

    // ── Admin ─────────────────────────────────────────────────────────────────

    function setFeeCollector(address fc) external onlyOwner { feeCollector = fc; }
    function setPlatformFeeBps(uint256 bps) external onlyOwner { require(bps <= 300, "Max 3%"); platformFeeBps = bps; }
}
