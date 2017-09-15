import {Ladders} from '/lib/collections.js';
import {Matches} from '/lib/collections.js';
import {Meteor} from 'meteor/meteor';
import {Pairings} from '/lib/collections.js';
import {Players} from '/lib/collections.js';
import {Queue} from '/lib/queue.js';
import {Result} from '/lib/result.js';
import {Setups} from '/lib/collections.js';

export function queuePlayerCommon(ladderId, playerId, setUnfixable) {
  const player = Players.findOne(playerId);
  if (!player) {
    throw new Meteor.Error('BAD_REQUEST', 'player not found');
  }

  if (player.games === 0) {
    const firstPlace = Players.findOne(
      {ladderId: ladderId, bonuses: 0, score: {$gt: 0}},
      {sort: [['score', 'desc']]});
    if (firstPlace) {
      const bonuses = Math.floor(firstPlace.score / 2);
      if (bonuses > 0) {
        player.score = bonuses;
        player.bonuses = bonuses;
        Players.update(playerId, {$set: {score: bonuses, bonuses: bonuses}});
      }
    }
  } else {
    const minGames = Players.find({queue: {$ne: Queue.NONE}})
        .fetch()
        .reduce((min, player) => {
          const games = player.games;
          return Math.min(
              min, player.queue === Queue.FINISHED ? games - 1 : games);
        }, Number.MAX_SAFE_INTEGER);
    if (player.games > minGames + 1) {
      throw new Meteor.Error('PRECONDITION_FAILED', 'player is too far ahead');
    }
  }

  if (setUnfixable) {
    Matches.update(player.lastMatchId, {$set: {unfixable: true}});
  }

  let destinationQueue = Queue.MATCHMAKING;
  if (player.games >= player.bonuses) {
    // normal queue: go to matchmaking first, promote to waiting if match found.
    const matchedPlayer = findMatchInMatchmaking(ladderId, player);
    if (matchedPlayer) {
      // match with matchmaking player if possible.
      destinationQueue = Queue.WAITING;
      addNewPairingWithMatchedPlayer(ladderId, player, matchedPlayer);
    } else {
      const pairingId = findMatchInWaiting(ladderId, player);
      if (pairingId) {
        // fall-forward: match with waiting unpaired player if possible.
        destinationQueue = Queue.WAITING;
        addPlayerToPairing(player, pairingId);
      }
      // insert as matchmaking player.
    }
  } else {
    // priority queue: go to waiting immediately and find a match later.
    const pairingId = findMatchInWaiting(ladderId, player);
    if (pairingId) {
      // match with waiting unpaired player if possible.
      addPlayerToPairing(player, pairingId);
    } else {
      const matchedPlayer = findMatchInMatchmaking(ladderId, player);
      if (matchedPlayer) {
        // fall-back: match with matchmaking player if possible.
        addNewPairingWithMatchedPlayer(ladderId, player, matchedPlayer);
      } else {
        // insert as waiting unpaired player.
        Pairings.insert({
          ladderId: ladderId,
          score: player.score,
          player1Id: player._id,
          player1Name: player.name,
          player1Bonus: player.bonuses > player.games,
          player1Seed: player.seed,
          queue: Queue.WAITING,
          queueTime: Date.now(),
        });
      }
    }
    destinationQueue = Queue.WAITING;
  }
  Players.update(
      player._id, {$set: {queue: destinationQueue, queueTime: Date.now()}});
  if (destinationQueue === Queue.WAITING) {
    tryPromoteWaitingPairing(ladderId);
  }
}

// Player
function findMatchInMatchmaking(ladderId, queuingPlayer) {
  const players = Players.find({
    ladderId: ladderId, queue: Queue.MATCHMAKING, score: queuingPlayer.score,
  }, {
    sort: [['queueTime', 'asc']],
  }).fetch();

  for (let i = 0; i < players.length; i++) {
    const waitingPlayer = players[i];
    if (canMatch(ladderId, queuingPlayer, waitingPlayer)) {
      return waitingPlayer;
    }
  }
  return undefined;
}

// Pairing._id
function findMatchInWaiting(ladderId, queuingPlayer) {
  const pairings = Pairings.find({
    ladderId: ladderId,
    queue: Queue.WAITING,
    score: queuingPlayer.score,
    player2Id: {$exists: false},
  }, {
    sort: [['queueTime', 'asc']],
  }).fetch();

  for (let i = 0; i < pairings.length; i++) {
    const pairing = pairings[i];
    const waitingPlayer = Players.findOne(pairing.player1Id);
    if (canMatch(ladderId, queuingPlayer, waitingPlayer)) {
      return pairing._id;
    }
  }
  return undefined;
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
  if (remainder < 1 && remainder > 0) {
    return index - 1;
  }
  return index;
}

function addPlayerToPairing(player, pairingId) {
  Pairings.update(pairingId, {
    $set: {
      player2Id: player._id,
      player2Name: player.name,
      player2Bonus: player.bonuses > player.games,
      player2Seed: player.seed,
    },
  });
}

function addNewPairingWithMatchedPlayer(ladderId, player, matchedPlayer) {
  Players.update(
      matchedPlayer._id, {$set: {queue: Queue.WAITING, queueTime: Date.now()}});
  Pairings.insert({
    ladderId: ladderId,
    score: matchedPlayer.score,
    player1Id: matchedPlayer._id,
    player1Name: matchedPlayer.name,
    player1Bonus: matchedPlayer.bonuses > matchedPlayer.games,
    player1Seed: matchedPlayer.seed,
    player2Id: player._id,
    player2Name: player.name,
    player2Bonus: player.bonuses > player.games,
    player2Seed: player.seed,
    queue: Queue.WAITING,
    queueTime: Date.now(),
  });
}

// void
export function tryPromoteWaitingPairing(ladderId) {
  const setups = Setups.find({
    ladderId: ladderId, pairingId: {$exists: false},
  }, {
    sort: [['number', 'asc']],
  }).fetch();
  const pairings = Pairings.find({
    ladderId: ladderId,
    queue: Queue.WAITING,
    player1Id: {$exists: true},
    player2Id: {$exists: true},
  }, {
    sort: [['queueTime', 'asc']],
  }).fetch();
  const length = Math.min(setups.length, pairings.length);

  for (let i = 0; i < length; i++) {
    const setup = setups[i];
    const pairing = pairings[i];

    Players.update(
        pairing.player1Id,
        {$set: {queue: Queue.PLAYING, queueTime: Date.now()}});
    Players.update(
        pairing.player2Id,
        {$set: {queue: Queue.PLAYING, queueTime: Date.now()}});
    Pairings.update(
        pairing._id,
        {$set: {
          queue: Queue.PLAYING,
          queueTime: Date.now(),
          setupId: setup._id,
          setupNumber: setup.number,
        }});
    Setups.update(setup._id, {$set: {pairingId: pairing._id}});
  }
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
