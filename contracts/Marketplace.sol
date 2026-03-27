// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title Marketplace
 * @notice On-chain job board with 3 listing tiers.
 *
 * Users: BUSINESS (posts JOBs) | MEMBER (posts SKILLs, applies to JOBs)
 * Social links (X + Gmail) stored on-chain for trust/verification.
 *
 * Tiers:
 *   NORMAL    — free (gas only), newest first
 *   HOT       — 1 USDC, 1.5× larger in UI
 *   SUPER_HOT — configurable USDC, 2.25× larger, pinned & featured
 */
contract Marketplace is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    address public constant USDC = 0x3600000000000000000000000000000000000000;
    uint256 public constant HOT_FEE = 1e18;
    uint256 public superHotFee = 5e18;
    address public feeCollector;

    enum UserType    { BUSINESS, MEMBER }
    enum ListingTier { NORMAL, HOT, SUPER_HOT }
    enum ListingType { JOB, SKILL }

    struct Profile {
        address  wallet;
        UserType userType;
        string   name;
        string   xHandle;
        string   gmailAddress;
        string   bio;
        uint256  registeredAt;
        bool     exists;
    }

    struct Listing {
        uint256     id;
        address     owner;
        ListingType listingType;
        ListingTier tier;
        string      title;
        string      description;
        string      tags;
        uint256     budget;
        uint256     createdAt;
        uint256     expiresAt;
        bool        active;
    }

    struct Application {
        uint256 listingId;
        address applicant;
        string  message;
        uint256 appliedAt;
        bool    accepted;
    }

    mapping(address => Profile) public profiles;

    uint256 private _nextListingId = 1;
    uint256 private _nextAppId     = 1;

    mapping(uint256 => Listing)     public listings;
    mapping(uint256 => Application) public applications;
    mapping(uint256 => uint256[])   public listingApplications;

    uint256[] public superHotListings;
    uint256[] public hotListings;
    uint256[] public normalListings;

    event ProfileRegistered(address indexed wallet, UserType userType, string name);
    event ProfileUpdated(address indexed wallet);
    event ListingPosted(uint256 indexed id, address indexed owner, ListingTier tier, ListingType lType);
    event ListingDeactivated(uint256 indexed id);
    event Applied(uint256 indexed listingId, uint256 applicationId, address indexed applicant);
    event ApplicationAccepted(uint256 indexed listingId, uint256 applicationId);

    constructor(address _feeCollector) Ownable(msg.sender) { feeCollector = _feeCollector; }

    // ── Profile ───────────────────────────────────────────────────────────────

    function register(UserType userType, string calldata name, string calldata xHandle, string calldata gmail, string calldata bio) external {
        require(!profiles[msg.sender].exists, "Already registered");
        require(bytes(name).length > 0, "Name required");
        profiles[msg.sender] = Profile({ wallet: msg.sender, userType: userType, name: name, xHandle: xHandle, gmailAddress: gmail, bio: bio, registeredAt: block.timestamp, exists: true });
        emit ProfileRegistered(msg.sender, userType, name);
    }

    function updateProfile(string calldata name, string calldata xHandle, string calldata gmail, string calldata bio) external {
        require(profiles[msg.sender].exists, "Not registered");
        Profile storage p = profiles[msg.sender];
        p.name = name; p.xHandle = xHandle; p.gmailAddress = gmail; p.bio = bio;
        emit ProfileUpdated(msg.sender);
    }

    // ── Listings ──────────────────────────────────────────────────────────────

    function postListing(ListingTier tier, string calldata title, string calldata description, string calldata tags, uint256 budget, uint256 durationDays) external nonReentrant returns (uint256 listingId) {
        require(profiles[msg.sender].exists, "Register first");
        require(bytes(title).length > 0 && bytes(description).length > 0, "Missing fields");

        ListingType lType = profiles[msg.sender].userType == UserType.BUSINESS ? ListingType.JOB : ListingType.SKILL;

        if (tier == ListingTier.HOT)       IERC20(USDC).safeTransferFrom(msg.sender, feeCollector, HOT_FEE);
        else if (tier == ListingTier.SUPER_HOT) IERC20(USDC).safeTransferFrom(msg.sender, feeCollector, superHotFee);

        listingId = _nextListingId++;
        uint256 expiry = durationDays > 0 ? block.timestamp + (durationDays * 1 days) : 0;

        listings[listingId] = Listing({ id: listingId, owner: msg.sender, listingType: lType, tier: tier, title: title, description: description, tags: tags, budget: budget, createdAt: block.timestamp, expiresAt: expiry, active: true });

        if (tier == ListingTier.SUPER_HOT)    superHotListings.push(listingId);
        else if (tier == ListingTier.HOT)     hotListings.push(listingId);
        else                                  normalListings.push(listingId);

        emit ListingPosted(listingId, msg.sender, tier, lType);
    }

    function deactivateListing(uint256 id) external {
        require(listings[id].owner == msg.sender, "Not owner");
        listings[id].active = false;
        emit ListingDeactivated(id);
    }

    // ── Applications ──────────────────────────────────────────────────────────

    function applyToListing(uint256 listingId, string calldata message) external nonReentrant {
        require(profiles[msg.sender].exists, "Register first");
        require(profiles[msg.sender].userType == UserType.MEMBER, "Members only");
        Listing storage l = listings[listingId];
        require(l.active, "Not active");
        require(l.listingType == ListingType.JOB, "Jobs only");
        require(l.owner != msg.sender, "Own listing");
        if (l.expiresAt > 0) require(block.timestamp <= l.expiresAt, "Expired");

        uint256 appId = _nextAppId++;
        applications[appId] = Application({ listingId: listingId, applicant: msg.sender, message: message, appliedAt: block.timestamp, accepted: false });
        listingApplications[listingId].push(appId);
        emit Applied(listingId, appId, msg.sender);
    }

    function acceptApplication(uint256 applicationId) external {
        Application storage app = applications[applicationId];
        require(listings[app.listingId].owner == msg.sender, "Not listing owner");
        app.accepted = true;
        emit ApplicationAccepted(app.listingId, applicationId);
    }

    // ── Views ─────────────────────────────────────────────────────────────────

    function getSuperHotListings(uint256 offset, uint256 limit) external view returns (uint256[] memory ids, uint256 total) { return _paginate(superHotListings, offset, limit); }
    function getHotListings(uint256 offset, uint256 limit)      external view returns (uint256[] memory ids, uint256 total) { return _paginate(hotListings, offset, limit); }
    function getNormalListings(uint256 offset, uint256 limit)   external view returns (uint256[] memory ids, uint256 total) { return _paginate(normalListings, offset, limit); }
    function getListingApplications(uint256 id) external view returns (uint256[] memory) { return listingApplications[id]; }

    function _paginate(uint256[] storage arr, uint256 offset, uint256 limit) internal view returns (uint256[] memory ids, uint256 total) {
        total = arr.length;
        if (offset >= total) return (new uint256[](0), total);
        uint256 end = total - offset;
        uint256 start = end > limit ? end - limit : 0;
        uint256 count = end - start;
        ids = new uint256[](count);
        for (uint256 i = 0; i < count; i++) ids[i] = arr[start + (count - 1 - i)];
    }

    // ── Admin ─────────────────────────────────────────────────────────────────

    function setSuperHotFee(uint256 fee) external onlyOwner { superHotFee = fee; }
    function setFeeCollector(address fc) external onlyOwner { feeCollector = fc; }
}
