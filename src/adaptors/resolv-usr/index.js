const sdk = require('@defillama/sdk');
const axios = require('axios');
const utils = require('../utils');
const ethers = require('ethers');

const stUSR = '0x6c8984bc7DBBeDAf4F6b2FD766f16eBB7d10AAb4';
const USR = '0x66a1E37c9b0eAddca17d3662D6c05F4DECf3e110';
const rewardDistributor = '0xbE23BB6D817C08E7EC4Cd0adB0E23156189c1bA9';

const topic0rewardDistributed =
  '0x3863fc447b7dde3f3f5a5ca0b5b06a5fd3570963a1a29918f09036746293f658';

const rewardDistributedInterface = new ethers.utils.Interface([
  'event RewardDistributed(bytes32 indexed idempotencyKey, uint256 totalShares, uint256 totalUSRBefore, uint256 totalUSRAfter, uint256 stakingReward, uint256 feeReward)',
]);

const DAY_IN_MS = 24 * 60 * 60 * 1000;

const getTotalSupply = async (tokenAddress, chain = 'ethereum') => {
  try {
    const { output } = await sdk.api.abi.call({
      target: tokenAddress,
      abi: 'erc20:totalSupply',
      chain,
    });
    return output / 1e18;
  } catch (error) {
    console.error(`Error fetching total supply for ${tokenAddress}:`, error);
    throw error;
  }
};

const getTokenPrice = async (tokenAddress) => {
  try {
    const priceKey = `ethereum:${tokenAddress}`;
    const { data } = await axios.get(
      `https://coins.llama.fi/prices/current/${priceKey}`
    );
    return data.coins[priceKey].price;
  } catch (error) {
    console.error(`Error fetching price for ${tokenAddress}:`, error);
    throw error;
  }
};

const calculateStUSRApy = (logDescription) => {
  const { totalUSRBefore, totalUSRAfter, totalShares } = logDescription.args;
  const sharesRateBefore = totalUSRBefore / totalShares;
  const sharesRateAfter = totalUSRAfter / totalShares;
  return ((sharesRateAfter - sharesRateBefore) / sharesRateBefore) * 365;
};

const stUsrPool = async () => {
  try {
    const totalSupply = await getTotalSupply(stUSR);
    const price = await getTokenPrice(USR);
    const tvl = totalSupply * price;

    const currentBlock = await sdk.api.util.getLatestBlock('ethereum');
    const currentDate = new Date(currentBlock.timestamp * 1000);
    const previousStartOfDay =
      new Date(currentDate).setHours(0, 0, 0, 0) - DAY_IN_MS;

    const [fromBlock] = await utils.getBlocksByTime(
      [previousStartOfDay / 1000],
      'ethereum'
    );
    const toBlock = currentBlock.block;

    const logs = (
      await sdk.api.util.getLogs({
        target: rewardDistributor,
        topic: '',
        fromBlock,
        toBlock,
        keys: [],
        chain: 'ethereum',
        topics: [topic0rewardDistributed],
      })
    ).output.sort((a, b) => a.blockNumber - b.blockNumber);

    let aprBase = 0;
    if (logs.length > 0) {
      const parsedLog = rewardDistributedInterface.parseLog(
        logs[logs.length - 1]
      );
      aprBase = calculateStUSRApy(parsedLog);
    }

    return {
      pool: stUSR,
      symbol: 'stUSR',
      chain: 'ethereum',
      project: 'resolv-usr',
      tvlUsd: tvl,
      apyBase: aprBase * 100,
    };
  } catch (error) {
    console.error('Error fetching stUSR pool data:', error);
    throw error;
  }
};

const apy = async () => {
  try {
    return [await stUsrPool()];
  } catch (error) {
    console.error('Error fetching APYs:', error);
    throw error;
  }
};

module.exports = {
  apy,
  url: 'https://www.resolv.xyz/',
};