
import { ethers } from "hardhat";

async function main() {
    const name = process.argv[2] || "MyNFT";
    const symbol = process.argv[3] || "MNFT";
    console.log("Deploying NFTWithCollections...");
    console.log(`Name: ${name}, Symbol: ${symbol}`);

    const NFTWithCollections = await ethers.getContractFactory("NFTWithCollections");
    const nftWithCollections = await NFTWithCollections.deploy(name, symbol);

    // Wait for the deployment transaction to be mined
    const deploymentTx = nftWithCollections.deploymentTransaction();
    if (!deploymentTx) {
        throw new Error("Deployment transaction is null");
    }

    const receipt = await deploymentTx.wait();
    if (!receipt) {
        throw new Error("Failed to get transaction receipt");
    }

    console.log("NFTWithCollections deployed successfully!");
    console.log("Deployed Contract Address:", await nftWithCollections.getAddress());
    console.log("Gas Used:", receipt.gasUsed.toString());
}

main().catch((error) => {
    console.error("Deployment failed:", error);
    process.exitCode = 1;
});