// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";

contract Marketplace is ReentrancyGuard {
    uint256 private _itemCount; // Manual counter for items
    uint256 private _soldItemCount; // Manual counter for sold items

    address payable public owner;
    uint256 public listingPrice = 0.025 ether; // Initial listing price

    struct MarketplaceItem {
        uint256 itemId;
        address nftContract;
        uint256 tokenId;
        address payable seller;
        address payable owner;
        uint256 price;
        bool sold;
    }

    mapping(uint256 => MarketplaceItem) private idToMarketplaceItem;

    event MarketplaceItemCreated(
        uint256 indexed itemId,
        address indexed nftContract,
        uint256 indexed tokenId,
        address seller,
        address owner,
        uint256 price,
        bool sold
    );

    event MarketplaceItemSold(
        uint256 indexed itemId,
        address indexed buyer,
        uint256 price
    );

    event MarketplaceItemRemoved(uint256 indexed itemId, address indexed seller);

    constructor() payable {
        owner = payable(msg.sender);
    }

    // Function to update listing price (only owner)
    function updateListingPrice(uint256 newPrice) external {
        require(msg.sender == owner, "Only the owner can update the listing price");
        listingPrice = newPrice;
    }

    // Get current listing price
    function getListingPrice() public view returns (uint256) {
        return listingPrice;
    }

    // Place an item for sale on the marketplace
    function createMarketplaceItem(
        address nftContract,
        uint256 tokenId,
        uint256 price
    ) external payable nonReentrant {
        require(price > 0, "Price must be greater than zero");
        require(msg.value == listingPrice, "Listing price not met");

        IERC721 nft = IERC721(nftContract);

        // Ensure the sender owns the token and has approved the marketplace
        require(nft.ownerOf(tokenId) == msg.sender, "Only the owner can list the token");
        require(
            nft.isApprovedForAll(msg.sender, address(this)) || 
            nft.getApproved(tokenId) == address(this),
            "Marketplace not approved"
        );

        _itemCount++; // Increment the item counter
        uint256 itemId = _itemCount;

        // Create the marketplace item
        idToMarketplaceItem[itemId] = MarketplaceItem({
            itemId: itemId,
            nftContract: nftContract,
            tokenId: tokenId,
            seller: payable(msg.sender),
            owner: payable(address(0)),
            price: price,
            sold: false
        });

        // Transfer the NFT to the marketplace
        nft.transferFrom(msg.sender, address(this), tokenId);

        emit MarketplaceItemCreated(itemId, nftContract, tokenId, msg.sender, address(0), price, false);
    }

    // Purchase a marketplace item
    function createMarketplaceSale(address nftContract, uint256 itemId)
        external
        payable
        nonReentrant
    {
        MarketplaceItem storage item = idToMarketplaceItem[itemId];

        require(msg.value == item.price, "Please submit the asking price");
        require(!item.sold, "Item is already sold");

        IERC721 nft = IERC721(nftContract);

        // Ensure the marketplace is still approved to transfer the NFT
        require(
            nft.isApprovedForAll(item.seller, address(this)) || 
            nft.getApproved(item.tokenId) == address(this),
            "Marketplace not approved"
        );

        // Transfer payment to the seller
        item.seller.transfer(msg.value);

        // Transfer ownership of the NFT to the buyer
        nft.transferFrom(address(this), msg.sender, item.tokenId);

        // Update item details
        item.owner = payable(msg.sender);
        item.sold = true;
        _soldItemCount++; // Increment the sold item counter

        // Pay the marketplace owner the listing fee
        payable(owner).transfer(listingPrice);

        emit MarketplaceItemSold(itemId, msg.sender, item.price);
    }

    // Remove an unsold item from the marketplace
    function removeMarketplaceItem(uint256 itemId) external nonReentrant {
        MarketplaceItem storage item = idToMarketplaceItem[itemId];

        require(item.seller == msg.sender, "Only the seller can remove the item");
        require(!item.sold, "Cannot remove a sold item");

        IERC721 nft = IERC721(item.nftContract);

        // Transfer the NFT back to the seller
        nft.transferFrom(address(this), msg.sender, item.tokenId);

        // Refund the listing price to the seller
        payable(msg.sender).transfer(listingPrice);

        // Remove the item from the marketplace
        delete idToMarketplaceItem[itemId];
        _itemCount--; // Decrement the item count

        emit MarketplaceItemRemoved(itemId, msg.sender);
    }

    // Fetch all unsold items
    function fetchUnsoldItems() external view returns (MarketplaceItem[] memory) {
        uint256 unsoldItemCount = 0;

        // First pass: Count unsold items
        for (uint256 i = 1; i <= _itemCount; i++) {
            if (idToMarketplaceItem[i].owner == address(0) && idToMarketplaceItem[i].itemId != 0) {
                unsoldItemCount++;
            }
        }

        // Second pass: Populate the array
        MarketplaceItem[] memory items = new MarketplaceItem[](unsoldItemCount);
        uint256 currentIndex = 0;

        for (uint256 i = 1; i <= _itemCount; i++) {
            if (idToMarketplaceItem[i].owner == address(0) && idToMarketplaceItem[i].itemId != 0) {
                items[currentIndex] = idToMarketplaceItem[i];
                currentIndex++;
            }
        }

        return items;
    }

    // Fetch items owned by the user
    function fetchMyItems() external view returns (MarketplaceItem[] memory) {
        uint256 itemCount = 0;
        uint256 currentIndex = 0;

        for (uint256 i = 1; i <= _itemCount; i++) {
            if (idToMarketplaceItem[i].owner == msg.sender) {
                itemCount++;
            }
        }

        MarketplaceItem[] memory items = new MarketplaceItem[](itemCount);

        for (uint256 i = 1; i <= _itemCount; i++) {
            if (idToMarketplaceItem[i].owner == msg.sender) {
                items[currentIndex] = idToMarketplaceItem[i];
                currentIndex++;
            }
        }

        return items;
    }

    // Fetch items created by the user
    function fetchItemsCreated() external view returns (MarketplaceItem[] memory) {
        uint256 itemCount = 0;
        uint256 currentIndex = 0;

        for (uint256 i = 1; i <= _itemCount; i++) {
            if (idToMarketplaceItem[i].seller == msg.sender) {
                itemCount++;
            }
        }

        MarketplaceItem[] memory items = new MarketplaceItem[](itemCount);

        for (uint256 i = 1; i <= _itemCount; i++) {
            if (idToMarketplaceItem[i].seller == msg.sender) {
                items[currentIndex] = idToMarketplaceItem[i];
                currentIndex++;
            }
        }

        return items;
    }
}