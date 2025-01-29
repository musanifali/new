// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract ERC721Auction is ReentrancyGuard {
    struct Auction {
        uint256 tokenId;
        address nftContract;
        address payable seller;
        uint256 startingBid;
        uint256 highestBid;
        address payable highestBidder;
        uint256 endTime;
        bool active;
    }

    mapping(bytes32 => Auction) public auctions;
    mapping(address => uint256) public pendingWithdrawals;

    event AuctionCreated(
        uint256 indexed tokenId,
        address indexed nftContract,
        uint256 startingBid,
        uint256 endTime
    );

    event BidPlaced(
        uint256 indexed tokenId,
        address indexed nftContract,
        address indexed bidder,
        uint256 amount
    );

    event AuctionFinalized(
        uint256 indexed tokenId,
        address indexed nftContract,
        address indexed winner,
        uint256 winningBid
    );

    event AuctionCancelled(
        uint256 indexed tokenId,
        address indexed nftContract
    );

    // Generate a unique key for each auction based on the NFT contract and token ID
    function getAuctionKey(address nftContract, uint256 tokenId) public pure returns (bytes32) {
        return keccak256(abi.encodePacked(nftContract, tokenId));
    }

    // Create a new auction
    function createAuction(
        address nftContract,
        uint256 tokenId,
        uint256 startingBid,
        uint256 duration
    ) external nonReentrant {
        IERC721 nft = IERC721(nftContract);

        require(nft.ownerOf(tokenId) == msg.sender, "Only the owner can create an auction");
        require(startingBid > 0, "Starting bid must be greater than zero");

        bytes32 auctionKey = getAuctionKey(nftContract, tokenId);
        require(!auctions[auctionKey].active, "Auction already exists for this token");

        nft.transferFrom(msg.sender, address(this), tokenId);

        auctions[auctionKey] = Auction({
            tokenId: tokenId,
            nftContract: nftContract,
            seller: payable(msg.sender),
            startingBid: startingBid,
            highestBid: 0,
            highestBidder: payable(address(0)),
            endTime: block.timestamp + duration,
            active: true
        });

        emit AuctionCreated(tokenId, nftContract, startingBid, block.timestamp + duration);
    }

    // Place a bid on an auction
    function placeBid(address nftContract, uint256 tokenId) external payable nonReentrant {
        bytes32 auctionKey = getAuctionKey(nftContract, tokenId);
        Auction storage auction = auctions[auctionKey];

        require(auction.active, "Auction is not active");
        require(block.timestamp < auction.endTime, "Auction has ended");
        require(msg.value >= auction.startingBid, "Bid must be at least the starting bid");
        require(msg.value > auction.highestBid, "Bid must be higher than the current highest bid");

        // Refund the previous highest bidder
        if (auction.highestBid > 0) {
            pendingWithdrawals[auction.highestBidder] += auction.highestBid;
        }

        // Update the auction details
        auction.highestBid = msg.value;
        auction.highestBidder = payable(msg.sender);

        emit BidPlaced(tokenId, nftContract, msg.sender, msg.value);
    }

    // Finalize an auction
    function finalizeAuction(address nftContract, uint256 tokenId) external nonReentrant {
        bytes32 auctionKey = getAuctionKey(nftContract, tokenId);
        Auction storage auction = auctions[auctionKey];

        require(auction.active, "Auction is not active");
        require(block.timestamp >= auction.endTime, "Auction has not ended");

        IERC721 nft = IERC721(auction.nftContract);

        if (auction.highestBid > 0) {
            nft.transferFrom(address(this), auction.highestBidder, tokenId);
            auction.seller.transfer(auction.highestBid);

            emit AuctionFinalized(tokenId, nftContract, auction.highestBidder, auction.highestBid);
        } else {
            nft.transferFrom(address(this), auction.seller, tokenId);

            emit AuctionFinalized(tokenId, nftContract, auction.seller, 0);
        }

        auction.active = false;
    }

    // Cancel an auction
    function cancelAuction(address nftContract, uint256 tokenId) external nonReentrant {
        bytes32 auctionKey = getAuctionKey(nftContract, tokenId);
        Auction storage auction = auctions[auctionKey];

        require(auction.active, "Auction is not active");
        require(auction.seller == msg.sender, "Only the seller can cancel the auction");
        require(auction.highestBid == 0, "Cannot cancel auction with bids");

        IERC721 nft = IERC721(nftContract);

        nft.transferFrom(address(this), auction.seller, tokenId);

        auction.active = false;

        emit AuctionCancelled(tokenId, nftContract);
    }

    // Withdraw funds from previous bids
    function withdrawFunds() external nonReentrant {
        uint256 amount = pendingWithdrawals[msg.sender];
        require(amount > 0, "No funds to withdraw");

        pendingWithdrawals[msg.sender] = 0;

        payable(msg.sender).transfer(amount);
    }
}
