// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Minimal linear streaming escrow: sender deposits tokens to this contract.
/// Recipient can withdraw vested amount at any time.
interface IERC20 {
  function transfer(address to, uint256 amount) external returns (bool);
  function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

contract StreamingPayments {
  struct Stream {
    address sender;
    address recipient;
    address token;
    uint64 start;
    uint64 end;
    uint256 total;
    uint256 claimed;
    bool canceled;
  }

  uint256 public streamCount;
  mapping(uint256 => Stream) public streams;

  event StreamCreated(uint256 indexed streamId, address indexed sender, address indexed recipient, address token);
  event StreamClaimed(uint256 indexed streamId, address indexed to, uint256 amount);
  event StreamCanceled(uint256 indexed streamId, uint256 refund, uint256 payout);

  error BadParams();
  error NotSender();
  error NotRecipient();

  function createStream(
    address token,
    address recipient,
    uint256 total,
    uint64 start,
    uint64 end
  ) external returns (uint256 streamId) {
    if (token == address(0) || recipient == address(0)) revert BadParams();
    if (total == 0) revert BadParams();
    if (end <= start) revert BadParams();
    if (start < block.timestamp) revert BadParams();

    streamId = ++streamCount;

    streams[streamId] = Stream({
      sender: msg.sender,
      recipient: recipient,
      token: token,
      start: start,
      end: end,
      total: total,
      claimed: 0,
      canceled: false
    });

    require(IERC20(token).transferFrom(msg.sender, address(this), total), "TRANSFER_FROM_FAILED");

    emit StreamCreated(streamId, msg.sender, recipient, token);
  }

  function vested(uint256 streamId, uint64 ts) public view returns (uint256) {
    Stream memory s = streams[streamId];
    if (ts <= s.start) return 0;
    if (ts >= s.end) return s.total;

    uint256 elapsed = uint256(ts - s.start);
    uint256 duration = uint256(s.end - s.start);
    return (s.total * elapsed) / duration;
  }

  function claimable(uint256 streamId) public view returns (uint256) {
    Stream memory s = streams[streamId];
    uint256 v = vested(streamId, uint64(block.timestamp));
    if (v <= s.claimed) return 0;
    return v - s.claimed;
  }

  function claim(uint256 streamId) external {
    Stream storage s = streams[streamId];
    if (msg.sender != s.recipient) revert NotRecipient();

    uint256 amt = claimable(streamId);
    require(amt > 0, "NOTHING_TO_CLAIM");

    s.claimed += amt;
    require(IERC20(s.token).transfer(s.recipient, amt), "TRANSFER_FAILED");

    emit StreamClaimed(streamId, s.recipient, amt);
  }

  /// @notice Sender can cancel: recipient gets vested-but-unclaimed; sender refunded the rest.
  function cancel(uint256 streamId) external {
    Stream storage s = streams[streamId];
    if (msg.sender != s.sender) revert NotSender();
    if (s.canceled) revert BadParams();

    s.canceled = true;

    uint256 v = vested(streamId, uint64(block.timestamp));
    uint256 payout = v > s.claimed ? (v - s.claimed) : 0;
    uint256 remaining = s.total - s.claimed - payout;

    if (payout > 0) {
      s.claimed += payout;
      require(IERC20(s.token).transfer(s.recipient, payout), "PAYOUT_FAILED");
    }
    if (remaining > 0) {
      require(IERC20(s.token).transfer(s.sender, remaining), "REFUND_FAILED");
    }

    emit StreamCanceled(streamId, remaining, payout);
  }
}