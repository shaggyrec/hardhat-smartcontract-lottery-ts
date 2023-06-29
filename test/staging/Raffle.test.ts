import { assert, expect } from 'chai';
import { Contract } from 'ethers';
import { network, ethers, getNamedAccounts } from 'hardhat';
import config from '../../hardhat.config';
import { Raffle } from '../../typechain-types';

const { developmentChains} = config;

developmentChains.includes(network.name)
    ? describe.skip
    : describe('Raffle Staging Tests', function () {
        let raffle: Raffle;
        let raffleEntranceFee: bigint;
        let deployer: string;

        beforeEach(async function () {
            deployer = (await getNamedAccounts()).deployer;
            raffle = await ethers.getContract<Raffle & Contract>('Raffle', deployer);
            raffleEntranceFee = await raffle.getEntranceFee();
        });

        describe('fulfillRandomWords', function () {
            it.skip('works with live Chainlink Keepers and Chainlink VRF, we get a random winner', async function () {
                const startingTimeStamp = await raffle.getLatestTimestamp();
                const accounts = await ethers.getSigners();

                // eslint-disable-next-line no-async-promise-executor
                await new Promise<void>(async (resolve, reject) => {
                    // setup listener before we enter the raffle
                    // Just in case the blockchain moves REALLY fast
                    raffle.once(raffle.getEvent('WinnerPicked'), async () => {
                        console.log('WinnerPicked event fired!');
                        try {
                            // add our asserts here
                            const recentWinner = await raffle.getRecentWinner();
                            const raffleState = await raffle.getRaffleState();
                            const winnerEndingBalance = await ethers.provider.getBalance(await accounts[0].getAddress());
                            const endingTimeStamp = await raffle.getLatestTimestamp();

                            await expect(raffle.getPlayer(0)).to.be.reverted;
                            assert.equal(
                                recentWinner.toString(),
                                accounts[0].address
                            );
                            assert.equal(raffleState.toString(), '0');
                            assert.equal(
                                winnerEndingBalance.toString(),
                                (winnerStartingBalance + raffleEntranceFee).toString()
                            );
                            assert(endingTimeStamp > startingTimeStamp);
                            resolve();
                        } catch (error) {
                            console.log(error);
                            reject(error);
                        }
                    });

                    const tx = await raffle.enterRaffle({
                        value: raffleEntranceFee,
                    });
                    await tx.wait(1);
                    const winnerStartingBalance = await ethers.provider.getBalance(await accounts[0].getAddress());
                });
            }).timeout(200000);
        });
    });
