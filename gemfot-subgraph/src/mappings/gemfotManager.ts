import { BigInt, Bytes, log } from '@graphprotocol/graph-ts';
import {
  PoolCreated,
  PoolScheduled,
  PoolPremine,
  PremineBurned,
  PoolSwap,
} from '../../generated/GemFotManager/GemFotManager';
import { Launch, Swap } from '../../generated/schema';
import { getOrCreateCreator, getOrCreateProtocol, ZERO_BI } from '../utils/entities';

export function handlePoolCreated(event: PoolCreated): void {
  let id = event.params._poolId.toHexString();
  let params = event.params._params;

  let creator = getOrCreateCreator(params.creator);
  let protocol = getOrCreateProtocol();

  let launch = new Launch(id);
  launch.poolId = event.params._poolId;
  launch.memecoin = event.params._memecoin;
  launch.memecoinTreasury = event.params._memecoinTreasury;
  launch.tokenId = event.params._tokenId;
  launch.currencyFlipped = event.params._currencyFlipped;

  launch.name = params.name;
  launch.symbol = params.symbol;
  launch.tokenUri = params.tokenUri;

  launch.creator = creator.id;
  launch.creatorFeeAllocation = BigInt.fromI32(params.creatorFeeAllocation);

  launch.initialTokenFairLaunch = params.initialTokenFairLaunch;
  launch.fairLaunchDuration = params.fairLaunchDuration;
  launch.fairLaunchStartsAt = ZERO_BI;
  launch.fairLaunchEndsAt = ZERO_BI;
  launch.fairLaunchClosed = false;

  launch.targetMarketCap = params.usdcMarketCap;
  launch.multiple = BigInt.fromI32(params.multiple);
  launch.initialPriceIndex = ZERO_BI;

  launch.premineAmount = params.premineAmount;
  launch.premineBurned = false;

  launch.revenue = ZERO_BI;
  launch.remainingSupply = params.initialTokenFairLaunch;
  launch.soldSupply = ZERO_BI;
  launch.buyCount = ZERO_BI;

  launch.flaunchesAt = params.launchAt;
  launch.createdAtTimestamp = event.block.timestamp;
  launch.createdAtBlock = event.block.number;
  launch.transactionHash = event.transaction.hash;

  launch.save();

  creator.launchCount = creator.launchCount.plus(BigInt.fromI32(1));
  creator.save();

  protocol.launchCount = protocol.launchCount.plus(BigInt.fromI32(1));
  protocol.save();
}

export function handlePoolScheduled(event: PoolScheduled): void {
  let launch = Launch.load(event.params._poolId.toHexString());
  if (launch == null) return;
  launch.scheduledAt = event.params._launchesAt;
  launch.flaunchesAt = event.params._launchesAt;
  launch.save();
}

export function handlePoolPremine(event: PoolPremine): void {
  let launch = Launch.load(event.params._poolId.toHexString());
  if (launch == null) return;
  launch.premineAmount = event.params._premineAmount;
  launch.save();
}

export function handlePremineBurned(event: PremineBurned): void {
  let launch = Launch.load(event.params._poolId.toHexString());
  if (launch == null) return;
  launch.premineBurned = true;
  launch.save();
}

export function handlePoolSwap(event: PoolSwap): void {
  let launchId = event.params.poolId.toHexString();
  let launch = Launch.load(launchId);
  if (launch == null) {
    log.warning('PoolSwap for unknown launch {}', [launchId]);
    return;
  }

  let id = event.transaction.hash.toHexString() + '-' + event.logIndex.toString();
  let swap = new Swap(id);
  swap.launch = launch.id;
  swap.sender = event.transaction.from as Bytes;
  swap.flAmount0 = event.params.flAmount0;
  swap.flAmount1 = event.params.flAmount1;
  swap.flFee0 = event.params.flFee0;
  swap.flFee1 = event.params.flFee1;
  swap.ispAmount0 = event.params.ispAmount0;
  swap.ispAmount1 = event.params.ispAmount1;
  swap.ispFee0 = event.params.ispFee0;
  swap.ispFee1 = event.params.ispFee1;
  swap.uniAmount0 = event.params.uniAmount0;
  swap.uniAmount1 = event.params.uniAmount1;
  swap.uniFee0 = event.params.uniFee0;
  swap.uniFee1 = event.params.uniFee1;
  swap.timestamp = event.block.timestamp;
  swap.blockNumber = event.block.number;
  swap.transactionHash = event.transaction.hash;
  swap.save();
}
