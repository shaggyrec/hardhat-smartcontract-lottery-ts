import 'hardhat/types/config';
import { BigNumber } from 'ethers';
import { EtherscanUserConfig } from '@nomiclabs/hardhat-etherscan/dist/src/types';

declare module 'hardhat/types/config' {
    export interface HttpNetworkUserConfig {
        blockConfirmations?: number;
        vrfCoordinator?: string;
        entranceFee: BigNumber;
        gasLane: string;
        subscriptionId?: string;
        callbackGasLimit: string;
        interval: number;
    }

    export interface HardhatNetworkUserConfig {
        blockConfirmations?: number;
        entranceFee: BigNumber;
        gasLane: string;
        subscriptionId?: string;
        callbackGasLimit?: string;
        interval: number;
    }

    export interface HardhatUserConfig {
        developmentChains: string[];
        organizerFee: number;
        etherscan: EtherscanUserConfig;
    }

    export interface HttpNetworkConfig {
        blockConfirmations: number;
        vrfCoordinator: string;
        entranceFee: BigNumber;
        gasLane: string;
        subscriptionId: string;
        callbackGasLimit: string;
        interval: number;
    }

    export interface HardhatNetworkConfig {
        blockConfirmations: number;
        vrfCoordinator?: string;
        entranceFee: BigNumber;
        gasLane: string;
        subscriptionId: string;
        callbackGasLimit: string;
        interval: number;
    }

    export interface HardhatConfig {
        developmentChains: string[];
        organizerFee: number;
    }
}
