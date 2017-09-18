import {Ladders} from '/lib/collections.js';
import {Matches} from '/lib/collections.js';
import {Pairings} from '/lib/collections.js';
import {Players} from '/lib/collections.js';
import {Queue} from '/lib/queue.js';
import {Result} from '/lib/result.js';
import {Setups} from '/lib/collections.js';

// void
export function tryPromote(ladderId) {
  const setup =
      Setups.findOne(
          {ladderId: ladderId, pairingId: {$exists: false}},
          {sort: [['number', 'asc']]});
  if (!setup) {
    return;
  }

  const players =
      Players.find(
          {ladderId: ladderId, queue: Queue.WAITING},
          {sort: [['queueTime', 'asc']]})
      .fetch()
      .concat(
          Players.find(
              {ladderId: ladderId, queue: Queue.MATCHMAKING},
              {sort: [['queueTime', 'asc']]})
          .fetch());

  const numSeeds = Ladders.findOne(ladderId).numSeeds;
  for (let i = 0; i < players.length; i++) {
    const player = players[i];
    const match =
        Players.find(
            {
              ladderId: ladderId,
              queue: Queue.MATCHMAKING,
              score: player.score,
              _id: {$ne: player._id},
            })
        .fetch()
        .filter((match) => {
          return !player.opponents.includes(match._id) &&
              !seedExcludesFn(numSeeds, player, match);
        }).sort((a, b) => {
          // 1st: nearest to the same round as the player
          const playerGames = player.games + player.bonuses;
          const aGamesDiff = Math.abs(a.games - playerGames);
          const bGamesDiff = Math.abs(b.games - playerGames);
          if (aGamesDiff !== bGamesDiff) {
            return aGamesDiff - bGamesDiff;
          }

          // 2nd: nearest to the optimal matched seed
          if (player.seed !== Number.MAX_SAFE_INTEGER &&
              a.seed !== Number.MAX_SAFE_INTEGER &&
              b.seed !== Number.MAX_SAFE_INTEGER) {
            const wantedSeed = seedWantsFn(numSeeds, player);
            const aSeedDiff = 
                Array.isArray(wantedSeed) ?
                    Math.min(
                        Math.abs(a.seed - wantedSeed[0]),
                        Math.abs(a.seed - wantedSeed[1])) :
                    Math.abs(a.seed - wantedSeed);
            const bSeedDiff = 
                Array.isArray(wantedSeed) ?
                    Math.min(
                        Math.abs(b.seed - wantedSeed[0]),
                        Math.abs(b.seed - wantedSeed[1])) :
                    Math.abs(b.seed - wantedSeed);
            if (aSeedDiff !== bSeedDiff) {
              return aSeedDiff - bSeedDiff;
            }
          }

          // 3rd: first in queue
          return a.queueTime - b.queueTime;
        })[0];
    if (match) {
      const now = Date.now();
      Players.update(
          player._id, {$set: {queue: Queue.PLAYING, queueTime: now}});
      Players.update(match._id, {$set: {queue: Queue.PLAYING, queueTime: now}});
      Matches.update(player.lastMatchId, {$set: {unfixable: true}});
      Matches.update(match.lastMatchId, {$set: {unfixable: true}});
      const pairingId = Pairings.insert({
        ladderId: ladderId,
        player1Id: player._id,
        player1Name: player.name,
        player1Bonus: player.bonuses > player.games,
        player1Seed: player.seed,
        player2Id: match._id,
        player2Name: match.name,
        player2Bonus: match.bonuses > match.games,
        player2Seed: match.seed,
        queueTime: now,
        setupId: setup._id,
        setupNumber: setup.number,
      });
      Setups.update(setup._id, {$set: {pairingId: pairingId}});

      tryPromote(ladderId);
      return;
    }
  }
}

function seedExcludesFn(numSeeds, player1, player2) {
  const seed1 = player1.seed;
  const seed2 = player2.seed;
  if (seed1 === Number.MAX_SAFE_INTEGER || seed2 === Number.MAX_SAFE_INTEGER) {
    return false;
  }

  const divisor = Math.pow(2, Math.min(player1.games, player2.games) + 1);
  const segLength = numSeeds / divisor;
  if (segLength < 2) {
    return false;
  }

  return getSegIndexFn(seed1, segLength) === getSegIndexFn(seed2, segLength);
}

function seedWantsFn(numSeeds, player) {
  const seed = player.seed;
  if (seed === Number.MAX_SAFE_INTEGER) {
    return -1;
  }

  const numSegs = Math.pow(2, player.games);
  const segLength = numSeeds / numSegs;
  if (segLength < 2) {
    return -1;
  }

  const segIndex = getSegIndexFn(seed, segLength);
  if (Array.isArray(segIndex)) {
    const first = Math.ceil(segLength * segIndex[0]);
    const last = Math.floor(segLength * (segIndex[1] + 1)) - 1;
    return [first, last];
  } else {
    // Simplification of:
    // const segBegin = Math.ceil(segLength * segIndex);
    // const offset = seed - segBegin;
    // const oppositeOffset = Math.floor(segLength) - offset - 1;
    // return segBegin + oppositeOffset;
    const segBegin = Math.ceil(segLength * segIndex);
    return 2 * segBegin + Math.floor(segLength) - seed - 1;
  }
}

function getSegIndexFn(seed, segLength) {
  const index = Math.floor(seed / segLength);
  const remainder = seed % segLength;
  if (segLength - remainder < 1) {
    // seed sits on the partition between two segments
    return [index, index + 1];
  }
  return index;
}

export function giveWinAndLoss(
    ladderId,
    winnerId,
    winnerName,
    winnerBonus,
    winnerSeed,
    loserId,
    loserName,
    loserBonus,
    loserSeed,
    forfeited,
    queueTime) {
  const nowMs = Date.now();
  const matchId = Matches.insert({
    ladderId: ladderId,
    winnerId: winnerId,
    winnerName: winnerName,
    winnerBonus: winnerBonus,
    winnerSeed: winnerSeed,
    loserId: loserId,
    loserName: loserName,
    loserBonus: loserBonus,
    loserSeed: loserSeed,
    forfeited: forfeited,
    time: nowMs,
    duration: nowMs - queueTime,
  });
  const canSwap =
      winnerSeed !== Number.MAX_SAFE_INTEGER &&
      loserSeed !== Number.MAX_SAFE_INTEGER;
  Players.update(loserId, {
    $inc: {score: loserBonus ? -1 : 0, losses: 1, games: 1},
    $set: {
      seed: canSwap ? Math.max(winnerSeed, loserSeed) : loserSeed,
      lastMatchId: matchId,
      queue: forfeited ? Queue.NONE : Queue.FINISHED,
      queueTime: nowMs,
    },
    $push: {results: Result.LOSS, opponents: winnerId},
  });
  Players.update(winnerId, {
    $inc: {score: 1, wins: 1, games: 1},
    $set: {
      seed: canSwap ? Math.min(winnerSeed, loserSeed) : winnerSeed,
      lastMatchId: matchId,
      queue: Queue.FINISHED,
      queueTime: nowMs,
    },
    $push: {results: Result.WIN, opponents: loserId},
  });
}

export function getOrderedSeededPlayerIds(ladderId) {
  return Players.find(
      {ladderId: ladderId, seed: {$lt: Number.MAX_SAFE_INTEGER}},
      {sort: [['seed', 'asc']]})
      .fetch()
      .map((player) => {
        return player._id;
      });
}
