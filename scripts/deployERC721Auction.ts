import { ethers } from "hardhat";

async function main() {
    const ERC721Auction = await ethers.getContractFactory("ERC721Auction");
    const auction = await ERC721Auction.deploy();

    // Get the deployment transaction
    const deploymentTx = auction.deploymentTransaction();
    if (!deploymentTx) {
        throw new Error("Deployment transaction is null");
    }

    // Wait for the deployment transaction to be mined
    const receipt = await deploymentTx.wait();
    if (!receipt) {
        throw new Error("Failed to get transaction receipt");
    }

    // Log the deployed contract address
    console.log(`ERC721Auction deployed to: ${await auction.getAddress()}`);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});