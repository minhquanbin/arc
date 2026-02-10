// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Minimal on-chain scheduler: payer approves this contract to pull USDC.
/// Anyone can execute when due; the contract transfers to recipients.
interface IERC20 {
  function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

contract RecurringPayments {
  /// @dev If your token doesn't return a boolean on transferFrom, set this to true.
  /// ARC USDC is expected to be standard ERC20 (returns bool), so default false.
  bool public immutable permissiveToken;

  constructor(bool permissiveToken_) {
    permissiveToken = permissiveToken_;
  }

  struct Schedule {
    address payer;
    address token;
    string name;
    uint64 intervalSeconds;
    uint64 nextRun;
    bool active;
    address[] recipients;
    uint256[] amounts;
  }

  uint256 public scheduleCount;
  mapping(uint256 => Schedule) private schedules;

  event ScheduleCreated(
    uint256 indexed scheduleId,
    address indexed payer,
    address indexed token,
    string name
  );
  event ScheduleExecuted(uint256 indexed scheduleId, uint64 nextRun);
  event ScheduleToggled(uint256 indexed scheduleId, bool active);
  event ScheduleDeleted(uint256 indexed scheduleId);

  error NotPayer();
  error NotActive();
  error TooEarly(uint64 nextRun);
  error BadParams();

  function getSchedule(uint256 scheduleId)
    external
    view
    returns (
      address payer,
      address token,
      string memory name,
      uint64 intervalSeconds,
      uint64 nextRun,
      bool active,
      address[] memory recipients,
      uint256[] memory amounts
    )
  {
    Schedule storage s = schedules[scheduleId];
    return (s.payer, s.token, s.name, s.intervalSeconds, s.nextRun, s.active, s.recipients, s.amounts);
  }

  function createSchedule(
    address token,
    string calldata name,
    address[] calldata recipients,
    uint256[] calldata amounts,
    uint64 intervalSeconds,
    uint64 firstRun
  ) external returns (uint256 scheduleId) {
    if (token == address(0)) revert BadParams();
    if (recipients.length == 0) revert BadParams();
    if (recipients.length != amounts.length) revert BadParams();
    if (intervalSeconds == 0) revert BadParams();
    if (firstRun < block.timestamp) revert BadParams();

    scheduleId = ++scheduleCount;

    Schedule storage s = schedules[scheduleId];
    s.payer = msg.sender;
    s.token = token;
    s.name = name;
    s.intervalSeconds = intervalSeconds;
    s.nextRun = firstRun;
    s.active = true;

    s.recipients = recipients;
    s.amounts = amounts;

    emit ScheduleCreated(scheduleId, msg.sender, token, name);
  }

  function toggleActive(uint256 scheduleId, bool active) external {
    Schedule storage s = schedules[scheduleId];
    if (s.payer != msg.sender) revert NotPayer();
    s.active = active;
    emit ScheduleToggled(scheduleId, active);
  }

  function deleteSchedule(uint256 scheduleId) external {
    Schedule storage s = schedules[scheduleId];
    if (s.payer != msg.sender) revert NotPayer();
    delete schedules[scheduleId];
    emit ScheduleDeleted(scheduleId);
  }

  function execute(uint256 scheduleId) external {
    Schedule storage s = schedules[scheduleId];
    if (!s.active) revert NotActive();
    if (block.timestamp < s.nextRun) revert TooEarly(s.nextRun);

    // Optional: restrict who can execute. Keeping permissionless execution is better for automation.
    // If you want only payer can execute, uncomment the next line.
    // if (msg.sender != s.payer) revert NotPayer();

    // Effects first (avoid double execution within same block if token is weird)
    uint64 next = uint64(block.timestamp) + s.intervalSeconds;
    s.nextRun = next;

    IERC20 t = IERC20(s.token);
    uint256 len = s.recipients.length;
    for (uint256 i = 0; i < len; i++) {
      if (permissiveToken) {
        // Some ERC20s don't return a value; a low-level call avoids abi decoding issues.
        (bool ok, bytes memory data) = address(t).call(
          abi.encodeWithSelector(IERC20.transferFrom.selector, s.payer, s.recipients[i], s.amounts[i])
        );
        require(ok && (data.length == 0 || abi.decode(data, (bool))), "TRANSFER_FROM_FAILED");
      } else {
        require(t.transferFrom(s.payer, s.recipients[i], s.amounts[i]), "TRANSFER_FROM_FAILED");
      }
    }

    emit ScheduleExecuted(scheduleId, next);
  }
}