// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import "forge-std/Test.sol";
import "../contracts/ArbitratorNFT.sol";
import "../contracts/InvoiceEscrow.sol";

// Minimal ERC-20 mock for testing (18 decimals, like Arc USDC)
contract MockUSDC {
    mapping(address => uint256)                     public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    function mint(address to, uint256 amount) external { balanceOf[to] += amount; }
    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount; return true;
    }
    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        require(allowance[from][msg.sender] >= amount, "Allowance");
        require(balanceOf[from] >= amount, "Balance");
        allowance[from][msg.sender] -= amount;
        balanceOf[from] -= amount;
        balanceOf[to]   += amount;
        return true;
    }
    function transfer(address to, uint256 amount) external returns (bool) {
        require(balanceOf[msg.sender] >= amount, "Balance");
        balanceOf[msg.sender] -= amount;
        balanceOf[to]         += amount;
        return true;
    }
}

/**
 * @notice InvoiceEscrow unit tests.
 *
 * Run: forge test --match-contract InvoiceEscrowTest -vvv
 */
contract InvoiceEscrowTest is Test {
    // We override the USDC constant address in contracts by deploying
    // a mock at that exact address using vm.etch.

    ArbitratorNFT arbNFT;
    InvoiceEscrow escrow;
    MockUSDC      usdc;

    address client    = address(0xC1);
    address vendor    = address(0xB2);
    address arb1      = address(0xA1);
    address arb2      = address(0xA2);
    address arb3      = address(0xA3);
    address treasury  = address(0xFE);
    address feeColl   = address(0xFF);

    uint256 constant USDC_ADDR_SLOT = 0x3600000000000000000000000000000000000000;

    function setUp() public {
        // Deploy mock USDC at the exact address the contracts expect
        usdc = new MockUSDC();
        vm.etch(address(0x3600000000000000000000000000000000000000), address(usdc).code);
        // Point storage to the same slot so balances work
        // (simpler: deploy at placeholder, use deal-like approach)

        arbNFT = new ArbitratorNFT(treasury);
        escrow = new InvoiceEscrow(address(arbNFT), feeColl);
        arbNFT.setInvoiceEscrow(address(escrow));

        // Mint USDC for all parties
        _fund(client,   100_000e18);
        _fund(vendor,   10_000e18);
        _fund(arb1,     1_000e18);
        _fund(arb2,     1_000e18);
        _fund(arb3,     1_000e18);
        _fund(treasury, 0);

        // Mint Gold NFTs for arbitrators
        _mintGold(arb1);
        _mintGold(arb2);
        _mintGold(arb3);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    function _fund(address who, uint256 amount) internal {
        deal(address(0x3600000000000000000000000000000000000000), who, amount);
    }

    function _mintGold(address who) internal {
        vm.startPrank(who);
        IERC20Like(address(0x3600000000000000000000000000000000000000))
            .approve(address(arbNFT), 200e18);
        arbNFT.mintGold();
        vm.stopPrank();
    }

    function _createInvoice() internal returns (uint256 invoiceId) {
        address[] memory arbs = new address[](3);
        arbs[0] = arb1; arbs[1] = arb2; arbs[2] = arb3;

        string[] memory descs = new string[](2);
        descs[0] = "Phase 1 — Design";
        descs[1] = "Phase 2 — Development";

        uint256[] memory amounts = new uint256[](2);
        amounts[0] = 1_000e18;
        amounts[1] = 2_000e18;

        uint256[] memory starts = new uint256[](2);
        starts[0] = block.timestamp;
        starts[1] = block.timestamp + 14 days;

        uint256[] memory dues = new uint256[](2);
        dues[0] = block.timestamp + 14 days;
        dues[1] = block.timestamp + 30 days;

        vm.startPrank(client);
        uint256 total = 3_000e18;
        uint256 deposit = (total * 500) / 10_000; // 5% = 150
        if (deposit < 50e18) deposit = 50e18;

        IERC20Like(address(0x3600000000000000000000000000000000000000))
            .approve(address(escrow), total + deposit);

        invoiceId = escrow.createInvoice(vendor, arbs, "Build DApp", descs, amounts, starts, dues);
        vm.stopPrank();
    }

    // ── Tests ─────────────────────────────────────────────────────────────────

    function test_mintGold() public {
        assertTrue(arbNFT.isArbitrator(arb1));
        assertEq(arbNFT.getTier(arb1), 0); // GOLD
        assertEq(arbNFT.totalMinted(), 3);
    }

    function test_createInvoice() public {
        uint256 id = _createInvoice();
        assertEq(id, 1);

        (address c, address v,,, uint256 total, uint8 status,,) = escrow.getInvoice(id);
        assertEq(c, client);
        assertEq(v, vendor);
        assertEq(total, 3_000e18);
        assertEq(status, 0); // CREATED
    }

    function test_acceptInvoice() public {
        uint256 id = _createInvoice();

        vm.startPrank(vendor);
        uint256 deposit = 150e18; // 5% of 3000
        IERC20Like(address(0x3600000000000000000000000000000000000000))
            .approve(address(escrow), deposit);
        escrow.acceptInvoice(id);
        vm.stopPrank();

        (,,,,, uint8 status,,) = escrow.getInvoice(id);
        assertEq(status, 1); // ACTIVE
    }

    function test_milestoneApproveFlow() public {
        uint256 id = _createInvoice();

        // Vendor accepts
        vm.startPrank(vendor);
        IERC20Like(address(0x3600000000000000000000000000000000000000))
            .approve(address(escrow), 150e18);
        escrow.acceptInvoice(id);

        // Vendor submits milestone 0
        escrow.submitMilestone(id, 0);
        vm.stopPrank();

        // Check submitted
        (,,,,, uint8 ms0Status) = escrow.getMilestone(id, 0);
        assertEq(ms0Status, 1); // SUBMITTED

        // Client approves
        vm.prank(client);
        escrow.approveMilestone(id, 0);

        (,,,,, uint8 ms0StatusAfter) = escrow.getMilestone(id, 0);
        assertEq(ms0StatusAfter, 2); // APPROVED
    }

    function test_autoRelease() public {
        uint256 id = _createInvoice();

        vm.startPrank(vendor);
        IERC20Like(address(0x3600000000000000000000000000000000000000))
            .approve(address(escrow), 150e18);
        escrow.acceptInvoice(id);
        escrow.submitMilestone(id, 0);
        vm.stopPrank();

        // Fast-forward 7 days
        vm.warp(block.timestamp + 7 days + 1);

        vm.prank(vendor);
        escrow.claimMilestoneAutoRelease(id, 0);

        (,,,,, uint8 status) = escrow.getMilestone(id, 0);
        assertEq(status, 3); // AUTO_RELEASED
    }

    function test_disputeAndResolve_clientWins() public {
        uint256 id = _createInvoice();

        // Vendor accepts + submits
        vm.startPrank(vendor);
        IERC20Like(address(0x3600000000000000000000000000000000000000))
            .approve(address(escrow), 150e18);
        escrow.acceptInvoice(id);
        escrow.submitMilestone(id, 0);
        vm.stopPrank();

        // Client opens dispute
        vm.prank(client);
        escrow.openDispute(id, 0);

        // All 3 arbitrators vote client wins
        vm.prank(arb1); escrow.voteDispute(id, 0, true);
        vm.prank(arb2); escrow.voteDispute(id, 0, true);
        vm.prank(arb3); escrow.voteDispute(id, 0, true);

        (,,,,, uint8 status) = escrow.getMilestone(id, 0);
        assertEq(status, 5); // RESOLVED
    }

    function test_cancelInvoice() public {
        uint256 id = _createInvoice();

        uint256 clientBefore = IERC20Like(address(0x3600000000000000000000000000000000000000)).balanceOf(client);

        vm.prank(client);
        escrow.cancelInvoice(id);

        uint256 clientAfter = IERC20Like(address(0x3600000000000000000000000000000000000000)).balanceOf(client);
        // Client got refunded
        assertGt(clientAfter, clientBefore);
    }

    function test_cannotCancelAfterAccept() public {
        uint256 id = _createInvoice();

        vm.startPrank(vendor);
        IERC20Like(address(0x3600000000000000000000000000000000000000))
            .approve(address(escrow), 150e18);
        escrow.acceptInvoice(id);
        vm.stopPrank();

        vm.prank(client);
        vm.expectRevert("Can only cancel CREATED");
        escrow.cancelInvoice(id);
    }

    function test_revertIfNotEnoughArbitrators() public {
        address[] memory arbs = new address[](2); // too few
        arbs[0] = arb1; arbs[1] = arb2;

        string[] memory descs   = new string[](1);  descs[0]   = "Phase 1";
        uint256[] memory amounts = new uint256[](1); amounts[0] = 1_000e18;
        uint256[] memory starts  = new uint256[](1); starts[0]  = block.timestamp;
        uint256[] memory dues    = new uint256[](1); dues[0]    = block.timestamp + 30 days;

        vm.startPrank(client);
        IERC20Like(address(0x3600000000000000000000000000000000000000))
            .approve(address(escrow), 2_000e18);
        vm.expectRevert("3-5 arbs");
        escrow.createInvoice(vendor, arbs, "Work", descs, amounts, starts, dues);
        vm.stopPrank();
    }
}

interface IERC20Like {
    function approve(address, uint256) external returns (bool);
    function balanceOf(address) external view returns (uint256);
}
