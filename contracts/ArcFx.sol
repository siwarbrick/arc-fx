// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
contract ArcFx {
    struct Conv { address user; string pair; uint256 amount; uint256 rateBps; uint256 at; }
    Conv[] public convs;
    mapping(address => uint256[]) private mineMap;
    mapping(bytes32 => uint256) public rateBps;
    address public owner;
    constructor() { owner = msg.sender; }
    event RateSet(string pair, uint256 bps);
    event Converted(uint256 indexed id, address indexed user, string pair, uint256 amount);
    function setRate(string calldata pair, uint256 bps) external { require(msg.sender == owner, "no"); rateBps[keccak256(bytes(pair))] = bps; emit RateSet(pair, bps); }
    function rateOf(string calldata pair) external view returns (uint256) { return rateBps[keccak256(bytes(pair))]; }
    function convert(string calldata pair) external payable returns (uint256 id) {
        require(msg.value > 0, "zero");
        id = convs.length; convs.push(Conv(msg.sender, pair, msg.value, rateBps[keccak256(bytes(pair))], block.timestamp));
        mineMap[msg.sender].push(id);
        (bool ok,) = payable(owner).call{value: msg.value}(""); require(ok, "fail");
        emit Converted(id, msg.sender, pair, msg.value);
    }
    function get(uint256 id) external view returns (Conv memory) { return convs[id]; }
    function getMine(address u) external view returns (uint256[] memory) { return mineMap[u]; }
    function total() external view returns (uint256) { return convs.length; }
}
