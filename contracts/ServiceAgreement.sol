// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title ServiceAgreement
 * @notice ERC-721 NFT representing a signed service agreement.
 *
 * Flow:
 *  1. Client creates agreement hash off-chain (SHA256 of JSON fields)
 *  2. Client signs EIP-712 typed message
 *  3. Vendor signs EIP-712 typed message
 *  4. Either party calls mintAgreement() with both signatures
 *  5. Contract verifies both signatures -> mints NFT -> stores IPFS CID
 *
 * The NFT tokenURI points to IPFS JSON containing full contract details.
 * Arbitrators can read the full agreement via IPFS gateway.
 */
contract ServiceAgreement is ERC721URIStorage, EIP712, Ownable {
    using ECDSA for bytes32;

    // ?? Types ??????????????????????????????????????????????????????????????

    struct Agreement {
        uint256 tokenId;
        address client;
        address vendor;
        bytes32 contentHash;   // SHA256 of the full JSON content
        string  ipfsCID;       // IPFS CID pointing to full contract JSON
        uint256 createdAt;
        bool    clientSigned;
        bool    vendorSigned;
        uint256 invoiceId;     // linked InvoiceEscrow invoiceId (0 if not linked)
    }

    // EIP-712 type hash
    bytes32 public constant AGREEMENT_TYPEHASH = keccak256(
        "AgreementSignature(address client,address vendor,bytes32 contentHash,uint256 nonce)"
    );

    // ?? Storage ????????????????????????????????????????????????????????????

    uint256 private _nextTokenId = 1;

    mapping(uint256 => Agreement) public agreements;

    // Track nonces per address to prevent replay attacks
    mapping(address => uint256) public nonces;

    // contentHash => tokenId (to prevent duplicate agreements)
    mapping(bytes32 => uint256) public hashToTokenId;

    // ?? Events ?????????????????????????????????????????????????????????????

    event AgreementMinted(
        uint256 indexed tokenId,
        address indexed client,
        address indexed vendor,
        bytes32 contentHash,
        string ipfsCID
    );
    event AgreementLinkedToInvoice(uint256 indexed tokenId, uint256 invoiceId);

    // ?? Constructor ????????????????????????????????????????????????????????

    constructor()
        ERC721("ArcInvoice Service Agreement", "AISA")
        EIP712("ArcInvoice", "1")
        Ownable(msg.sender)
    {}

    // ?? Core ???????????????????????????????????????????????????????????????

    /**
     * @notice Mint a Service Agreement NFT after collecting both signatures.
     * @param client        Client wallet address
     * @param vendor        Vendor wallet address
     * @param contentHash   SHA256 hash of the full agreement JSON
     * @param ipfsCID       IPFS CID where full agreement JSON is stored
     * @param clientSig     EIP-712 signature from client
     * @param vendorSig     EIP-712 signature from vendor
     * @param clientNonce   Nonce used by client when signing
     * @param vendorNonce   Nonce used by vendor when signing
     */
    function mintAgreement(
        address client,
        address vendor,
        bytes32 contentHash,
        string calldata ipfsCID,
        bytes calldata clientSig,
        bytes calldata vendorSig,
        uint256 clientNonce,
        uint256 vendorNonce
    ) external returns (uint256 tokenId) {
        require(client != address(0) && vendor != address(0), "Invalid addresses");
        // allow same address for testnet testing
        require(bytes(ipfsCID).length > 0, "IPFS CID required");
        require(hashToTokenId[contentHash] == 0, "Agreement already minted");

        // Verify client signature
        bytes32 clientDigest = _hashTypedDataV4(keccak256(abi.encode(
            AGREEMENT_TYPEHASH, client, vendor, contentHash, clientNonce
        )));
        require(clientDigest.recover(clientSig) == client, "Invalid client signature");
        require(clientNonce == nonces[client], "Invalid client nonce");

        // Verify vendor signature
        bytes32 vendorDigest = _hashTypedDataV4(keccak256(abi.encode(
            AGREEMENT_TYPEHASH, client, vendor, contentHash, vendorNonce
        )));
        require(vendorDigest.recover(vendorSig) == vendor, "Invalid vendor signature");
        require(vendorNonce == nonces[vendor], "Invalid vendor nonce");

        // Increment nonces
        nonces[client]++;
        nonces[vendor]++;

        // Mint
        tokenId = _nextTokenId++;
        _safeMint(client, tokenId);
        _setTokenURI(tokenId, string(abi.encodePacked("ipfs://", ipfsCID)));

        agreements[tokenId] = Agreement({
            tokenId:     tokenId,
            client:      client,
            vendor:      vendor,
            contentHash: contentHash,
            ipfsCID:     ipfsCID,
            createdAt:   block.timestamp,
            clientSigned: true,
            vendorSigned: true,
            invoiceId:   0
        });

        hashToTokenId[contentHash] = tokenId;

        emit AgreementMinted(tokenId, client, vendor, contentHash, ipfsCID);
    }

    /**
     * @notice Link an agreement NFT to an InvoiceEscrow invoice.
     * Only the client (token owner) can link.
     */
    function linkToInvoice(uint256 tokenId, uint256 invoiceId) external {
        require(ownerOf(tokenId) == msg.sender, "Not token owner");
        require(agreements[tokenId].invoiceId == 0, "Already linked");
        agreements[tokenId].invoiceId = invoiceId;
        emit AgreementLinkedToInvoice(tokenId, invoiceId);
    }

    // ?? Views ??????????????????????????????????????????????????????????????

    function getAgreement(uint256 tokenId) external view returns (Agreement memory) {
        return agreements[tokenId];
    }

    function getAgreementByHash(bytes32 contentHash) external view returns (uint256) {
        return hashToTokenId[contentHash];
    }

    /**
     * @notice Returns the EIP-712 digest that both parties must sign.
     */
    function getAgreementDigest(
        address client,
        address vendor,
        bytes32 contentHash,
        uint256 signerNonce
    ) external view returns (bytes32) {
        return _hashTypedDataV4(keccak256(abi.encode(
            AGREEMENT_TYPEHASH, client, vendor, contentHash, signerNonce
        )));
    }

    function totalSupply() external view returns (uint256) {
        return _nextTokenId - 1;
    }
}