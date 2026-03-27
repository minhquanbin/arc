// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title ArbitratorNFT
 * @notice ERC-1155 tiered NFT. Max 10 globally.
 * ID 0 = Gold (200 USDC) | 1 = Diamond (1,000 USDC + 10 invoices)
 *    2 = Platinum (5,000 USDC + 20 invoices + 5 disputes)
 *
 * Fees per invoice:  Gold 0.5% | Diamond 0.7% | Platinum 1%
 * Dispute fee:       5% of milestone (paid by loser, split equally)
 */
contract ArbitratorNFT is ERC1155, Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    address public constant USDC = 0x3600000000000000000000000000000000000000;

    uint256 public constant GOLD     = 0;
    uint256 public constant DIAMOND  = 1;
    uint256 public constant PLATINUM = 2;
    uint256 public constant MAX_TOTAL_NFTS    = 10;
    uint256 public constant GOLD_PRICE        = 200e18;
    uint256 public constant DIAMOND_PRICE     = 1_000e18;
    uint256 public constant PLATINUM_PRICE    = 5_000e18;
    uint256 public constant DIAMOND_INV_REQ   = 10;
    uint256 public constant PLATINUM_INV_REQ  = 20;
    uint256 public constant PLATINUM_DISP_REQ = 5;

    uint256 public totalMinted;
    address public invoiceEscrow;
    address public treasury;

    struct Stats {
        uint256 invoiceCount;
        uint256 disputeCount;
        uint256 activeDisputes;
        bool    suspended;
        bool    exists;
    }
    mapping(address => Stats) public stats;

    event GoldMinted(address indexed a);
    event UpgradedToDiamond(address indexed a);
    event UpgradedToPlatinum(address indexed a);
    event ArbitratorSuspended(address indexed a);
    event ArbitratorReinstated(address indexed a);

    constructor(address _treasury)
        ERC1155("https://arc-invoice.io/api/nft/{id}.json")
        Ownable(msg.sender)
    { treasury = _treasury; }

    modifier onlyEscrow() { require(msg.sender == invoiceEscrow, "Only escrow"); _; }

    // ── Mint / Upgrade ────────────────────────────────────────────────────────

    function mintGold() external nonReentrant {
        require(!stats[msg.sender].exists, "Already exists");
        require(totalMinted < MAX_TOTAL_NFTS, "Max reached");
        IERC20(USDC).safeTransferFrom(msg.sender, treasury, GOLD_PRICE);
        _mint(msg.sender, GOLD, 1, "");
        stats[msg.sender].exists = true;
        totalMinted++;
        emit GoldMinted(msg.sender);
    }

    function upgradeToDiamond() external nonReentrant {
        require(balanceOf(msg.sender, GOLD) == 1, "Need Gold NFT");
        require(!stats[msg.sender].suspended, "Suspended");
        require(stats[msg.sender].invoiceCount >= DIAMOND_INV_REQ, "Need 10 invoices");
        IERC20(USDC).safeTransferFrom(msg.sender, treasury, DIAMOND_PRICE);
        _burn(msg.sender, GOLD, 1);
        _mint(msg.sender, DIAMOND, 1, "");
        emit UpgradedToDiamond(msg.sender);
    }

    function upgradeToPlatinum() external nonReentrant {
        require(balanceOf(msg.sender, DIAMOND) == 1, "Need Diamond NFT");
        require(!stats[msg.sender].suspended, "Suspended");
        require(stats[msg.sender].invoiceCount >= PLATINUM_INV_REQ, "Need 20 invoices");
        require(stats[msg.sender].disputeCount >= PLATINUM_DISP_REQ, "Need 5 disputes");
        IERC20(USDC).safeTransferFrom(msg.sender, treasury, PLATINUM_PRICE);
        _burn(msg.sender, DIAMOND, 1);
        _mint(msg.sender, PLATINUM, 1, "");
        emit UpgradedToPlatinum(msg.sender);
    }

    // ── Escrow callbacks ──────────────────────────────────────────────────────

    function recordInvoiceCompleted(address a) external onlyEscrow { if (stats[a].exists) stats[a].invoiceCount++; }
    function recordDisputeStart(address a)     external onlyEscrow { if (stats[a].exists) stats[a].activeDisputes++; }
    function recordDisputeResolved(address a)  external onlyEscrow {
        if (stats[a].exists) {
            if (stats[a].activeDisputes > 0) stats[a].activeDisputes--;
            stats[a].disputeCount++;
        }
    }

    // ── Views ─────────────────────────────────────────────────────────────────

    function isArbitrator(address addr) external view returns (bool) {
        if (stats[addr].suspended) return false;
        return balanceOf(addr, GOLD) == 1 || balanceOf(addr, DIAMOND) == 1 || balanceOf(addr, PLATINUM) == 1;
    }

    function getTier(address addr) external view returns (uint256) {
        if (balanceOf(addr, PLATINUM) == 1) return PLATINUM;
        if (balanceOf(addr, DIAMOND)  == 1) return DIAMOND;
        if (balanceOf(addr, GOLD)     == 1) return GOLD;
        return type(uint256).max;
    }

    function getHighestTier(address[] calldata arbs) external view returns (uint256) {
        uint256 highest = 0;
        for (uint256 i = 0; i < arbs.length; i++) {
            if (balanceOf(arbs[i], PLATINUM) == 1) return PLATINUM;
            if (balanceOf(arbs[i], DIAMOND)  == 1 && highest < DIAMOND) highest = DIAMOND;
        }
        return highest;
    }

    function getStats(address addr) external view returns (
        uint256 invoiceCount, uint256 disputeCount,
        uint256 activeDisputes, bool suspended, uint256 tier
    ) {
        Stats storage s = stats[addr];
        uint256 t;
        if (balanceOf(addr, PLATINUM) == 1)      t = PLATINUM;
        else if (balanceOf(addr, DIAMOND) == 1)  t = DIAMOND;
        else if (balanceOf(addr, GOLD) == 1)     t = GOLD;
        else t = type(uint256).max;
        return (s.invoiceCount, s.disputeCount, s.activeDisputes, s.suspended, t);
    }

    // ── Admin ─────────────────────────────────────────────────────────────────

    function setInvoiceEscrow(address e) external onlyOwner { invoiceEscrow = e; }
    function setTreasury(address t)      external onlyOwner { treasury = t; }
    function setURI(string memory u)     external onlyOwner { _setURI(u); }

    function suspendArbitrator(address a)  external onlyOwner { stats[a].suspended = true;  emit ArbitratorSuspended(a); }
    function reinstateArbitrator(address a) external onlyOwner { stats[a].suspended = false; emit ArbitratorReinstated(a); }

    // ── Transfer lock during active dispute ───────────────────────────────────

    function _update(address from, address to, uint256[] memory ids, uint256[] memory values) internal override {
        if (from != address(0) && to != address(0))
            require(stats[from].activeDisputes == 0, "In active dispute");
        super._update(from, to, ids, values);
    }
}
