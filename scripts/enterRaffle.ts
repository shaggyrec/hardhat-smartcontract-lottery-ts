import { ethers } from 'hardhat';
import { Raffle } from '../typechain-types';

async function enterRaffle() {
    const raffle = await ethers.getContract<Raffle>('Raffle');
    const entranceFee = await raffle.getEntranceFee();
    await raffle.enterRaffle({ value: entranceFee + BigInt(1) });
    console.log('Entered!');
}

enterRaffle()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
