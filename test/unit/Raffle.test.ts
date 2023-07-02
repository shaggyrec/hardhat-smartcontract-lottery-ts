import { assert, expect } from 'chai';
import { EventLog } from 'ethers';
import { network, deployments, ethers } from 'hardhat';
import config from '../../hardhat.config';
import { Raffle, VRFCoordinatorV2Mock } from '../../typechain-types';
import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';

const { developmentChains, networks: networkConfig } = config;

!developmentChains.includes(network.name)
    ? describe.skip
    : describe('Raffle Unit Tests',function () {
        let raffle: Raffle;
        let raffleContract: Raffle;
        let vrfCoordinatorV2Mock: VRFCoordinatorV2Mock;
        let raffleEntranceFee: bigint;
        let interval: number;
        let player: SignerWithAddress;
        let accounts: SignerWithAddress[];
        let raffleAddress: string;

        beforeEach(async () => {
            accounts = await ethers.getSigners(); // could also do with getNamedAccounts
            player = accounts[1];
            await deployments.fixture(['mocks', 'raffle']);
            vrfCoordinatorV2Mock = await ethers.getContract('VRFCoordinatorV2Mock');
            raffleContract = await ethers.getContract('Raffle');
            raffle = raffleContract.connect(player);
            raffleEntranceFee = await raffle.getEntranceFee();
            interval = Number(await raffle.getInterval());
            raffleAddress = await raffle.getAddress();
        });

        describe('constructor', function() {
            it('initializes the raffle correctly', async () => {
                // Ideally, we'd separate these out so that only 1 assert per "it" block
                // And ideally, we'd make this check everything
                const raffleState = (await raffle.getRaffleState()).toString();
                assert.equal(raffleState, '0');
                assert.equal(
                    interval.toString(),
                    networkConfig && networkConfig[network.name]?.interval.toString()
                );
            });
        });

        describe('enterRaffle', function() {
            it('reverts when you don\'t pay enough', async () => {
                await expect(raffle.enterRaffle()).to.be.revertedWithCustomError(
                    raffle,
                    'Raffle__NotEnoughEthToEnter'
                );
            });
            it('records player when they enter', async () => {
                await raffle.enterRaffle({ value: raffleEntranceFee });
                const contractPlayer = await raffle.getPlayer(0);
                assert.equal(player.address, contractPlayer);
            });
            it('emits event on enter', async () => {
                await expect(raffle.enterRaffle({ value: raffleEntranceFee })).to.emit(
                    raffle,
                    'RaffleEnter'
                );
            });
            it('doesn\'t allow entrance when raffle is calculating', async () => {
                await raffle.enterRaffle({ value: raffleEntranceFee });
                await network.provider.send('evm_increaseTime', [interval + 1]);
                await network.provider.request({ method: 'evm_mine', params: [] });
                // we pretend to be a keeper for a second
                await raffle.performUpkeep('0x');
                await expect(raffle.enterRaffle({ value: raffleEntranceFee })).to.be.revertedWithCustomError(
                    raffle,
                    'Raffle__NotOpen'
                );
            });
        });
        describe('checkUpkeep', function() {
            it('returns false if people haven\'t sent any ETH', async () => {
                await network.provider.send('evm_increaseTime', [interval + 1]);
                await network.provider.request({ method: 'evm_mine', params: [] });

                const { upkeepNeeded } = await raffle.checkUpkeep.staticCall('0x');
                assert(!upkeepNeeded);
            });
            it('returns false if raffle isn\'t open', async () => {
                await raffle.enterRaffle({ value: raffleEntranceFee });
                await network.provider.send('evm_increaseTime', [interval + 1]);
                await network.provider.request({ method: 'evm_mine', params: [] });
                await raffle.performUpkeep('0x');
                const raffleState = await raffle.getRaffleState();
                const { upkeepNeeded } = await raffle.checkUpkeep.staticCall('0x');
                assert.equal(raffleState.toString() == '1', !upkeepNeeded);
            });
            it('returns false if enough time hasn\'t passed', async () => {
                await raffle.enterRaffle({ value: raffleEntranceFee });
                await network.provider.send('evm_increaseTime', [interval - 2]);
                await network.provider.request({ method: 'evm_mine', params: [] });
                const { upkeepNeeded } = await raffle.checkUpkeep.staticCall('0x');
                assert(!upkeepNeeded);
            });
            it('returns true if enough time has passed, has players, eth, and is open', async () => {
                await raffle.enterRaffle({ value: raffleEntranceFee });
                await network.provider.send('evm_increaseTime', [interval + 1]);
                await network.provider.request({ method: 'evm_mine', params: [] });
                const { upkeepNeeded } = await raffle.checkUpkeep.staticCall('0x');
                assert(upkeepNeeded);
            });
        });

        describe('performUpkeep', function() {
            it('can only run if checkupkeep is true', async () => {
                await raffle.enterRaffle({ value: raffleEntranceFee });
                await network.provider.send('evm_increaseTime', [interval + 1]);
                await network.provider.request({ method: 'evm_mine', params: [] });
                const tx = await raffle.performUpkeep('0x');
                assert(tx);
            });
            it('reverts if checkup is false', async () => {
                await expect(raffle.performUpkeep('0x')).to.be.revertedWithCustomError(
                    raffle,
                    'Raffle__UpkeepNotNeeded'
                );
            });
            it('updates the raffle state and emits a requestId', async () => {
                // Too many asserts in this test!
                await raffle.enterRaffle({ value: raffleEntranceFee });
                await network.provider.send('evm_increaseTime', [interval + 1]);
                await network.provider.request({ method: 'evm_mine', params: [] });
                const txResponse = await raffle.performUpkeep('0x');
                const txReceipt = await txResponse.wait(1);
                const raffleState = await raffle.getRaffleState();
                const requestId = (txReceipt?.logs[1] as EventLog).args!.requestId;
                assert(requestId > 0);
                assert(raffleState == BigInt(1));
            });
        });
        describe('fulfillRandomWords', function() {
            beforeEach(async () => {
                await raffle.enterRaffle({ value: raffleEntranceFee });
                await network.provider.send('evm_increaseTime', [interval + 1]);
                await network.provider.request({ method: 'evm_mine', params: [] });
            });
            it('can only be called after performupkeep', async () => {
                await expect(
                    vrfCoordinatorV2Mock.fulfillRandomWords(0, await raffle.getAddress())
                ).to.be.revertedWith('nonexistent request');
                await expect(
                    vrfCoordinatorV2Mock.fulfillRandomWords(1, await raffle.getAddress())
                ).to.be.revertedWith('nonexistent request');
            });
            // This test is too big...
            it('picks a winner, resets, and sends money', async () => {
                const additionalEntrances = 3;
                const startingIndex = 2;
                for (let i = startingIndex; i < startingIndex + additionalEntrances; i++) {
                    raffle = raffleContract.connect(accounts[i]);
                    await raffle.enterRaffle({ value: raffleEntranceFee });
                }
                const startingTimeStamp = await raffle.getLatestTimestamp();

                // This will be more important for our staging tests...
                // eslint-disable-next-line no-async-promise-executor
                await new Promise<void>(async (resolve, reject) => {
                    raffle.on(raffle.getEvent('WinnerPicked'), async () => {
                        console.log('WinnerPicked fired');
                        // assert throws an error if it fails, so we need to wrap
                        // it in a try/catch so that the promise returns event
                        // if it fails.
                        try {
                            // Now lets get the ending values...
                            const recentWinner = await raffle.getRecentWinner();
                            const raffleState = await raffle.getRaffleState();
                            const winnerBalance = await ethers.provider.getBalance(await accounts[2].getAddress());
                            const deployerBalance = await ethers.provider.getBalance(await accounts[0].getAddress());
                            const endingTimeStamp = await raffle.getLatestTimestamp();
                            await expect(raffle.getPlayer(0)).to.be.reverted;
                            const contractBalance = BigInt(raffleEntranceFee) * BigInt(additionalEntrances) + BigInt(raffleEntranceFee);
                            const organizerFee = (contractBalance * BigInt(config.organizerFee) / BigInt(100));
                            assert.equal(recentWinner.toString(), accounts[2].address);
                            assert.equal(raffleState, BigInt(0));
                            assert.equal(
                                winnerBalance.toString(),
                                (startingBalance + contractBalance - organizerFee).toString()
                            );
                            assert(deployerBalance > deployerStartingBalance);
                            assert(deployerBalance - deployerStartingBalance <= organizerFee);
                            assert(endingTimeStamp > startingTimeStamp);
                            resolve();
                        } catch (e) {
                            reject(e);
                        }
                    });

                    const tx = await raffle.performUpkeep('0x');
                    const txReceipt = await tx.wait(1);
                    const startingBalance = await ethers.provider.getBalance(await accounts[2].getAddress());
                    const deployerStartingBalance =  await ethers.provider.getBalance(await accounts[0].getAddress());
                    await vrfCoordinatorV2Mock.fulfillRandomWords(
                        (txReceipt!.logs![1] as EventLog).args.requestId,
                        raffleAddress
                    );
                    // have to do it manually until raffle.on doesn't work properly in hardhat
                    await raffle.emit(raffle.getEvent('WinnerPicked'), '');
                });
            });
        });
    });
