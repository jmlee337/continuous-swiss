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
          return canMatch(ladderId, player, match);
        }).sort((a, b) => {
          if (player.queue === Queue.WAITING) {
            return a.games - b.games;
          } else {
            const aGamesDiff = Math.abs(a.games - player.games);
            const bGamesDiff = Math.abs(b.games - player.games);
            if (aGamesDiff !== bGamesDiff) {
              return aGamesDiff - bGamesDiff;
            }
          }
          // TODO: maybe sort by closeness to desired seed before this.
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

function canMatch(ladderId, player1, player2) {
  return !player1.opponents.includes(player2._id) &&
    !seedExcludes(ladderId, player1, player2);
}

function seedExcludes(ladderId, player1, player2) {
  const seed1 = player1.seed;
  const seed2 = player2.seed;
  if (seed1 === Number.MAX_SAFE_INTEGER || seed2 === Number.MAX_SAFE_INTEGER) {
    return false;
  }

  const divisor = Math.pow(2, Math.min(player1.games, player2.games) + 1);
  const segLength = Ladders.findOne(ladderId).numSeeds / divisor;
  if (segLength < 2) {
    return false;
  }
  return getSegIndexFn(seed1, segLength) === getSegIndexFn(seed2, segLength);
}

function getSegIndexFn(seed, segLength) {
  const index = Math.floor(seed / segLength);
  const remainder = seed % segLength;
  if (segLength - remainder < 1) {
    // seed sits on a segment partition, so it's not a part of any segment
    return undefined;
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
