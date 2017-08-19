import {Meteor} from 'meteor/meteor';

import {Pairings} from '../lib/collections.js';
import {Players} from '../lib/collections.js';
import {Queue} from '../lib/queue.js';

const NUM_SETUPS = 1;
const SCORE_THRESHOLD = 0;

Meteor.methods({
  addPlayer: function(playerName) {
    Players.insert({
      name: playerName,
      score: 0,
      wins: 0,
      losses: 0,
      playersPlayed: [],
      queue: Queue.NONE,
      queueTime: Date.now()
    });
  },

  queuePlayer: function(playerId) {
    const playerToQueue = Players.findOne(playerId);
    if (!playerToQueue) {
      throw new Meteor.Error("BAD_REQUEST", "player not found");
    }

    if (playerToQueue.score >= SCORE_THRESHOLD) {
      // match then wait
      const matchedPlayer = findMatchInMatchmaking(playerToQueue);
      if (matchedPlayer) {
        Players.update(matchedPlayer._id, {$set: {queue: Queue.WAITING, queueTime: Date.now()}});
        Players.update(playerToQueue._id, {$set: {queue: Queue.WAITING, queueTime: Date.now()}});
        Pairings.insert({
          player1Id: matchedPlayer._id,
          player1Name: matchedPlayer.name,
          player2Id: playerToQueue._id,
          player2Name: playerToQueue.name,
          queue: Queue.WAITING,
          queueTime: Date.now()
        });
      } else {
        Players.update(playerToQueue._id, {
          $set: {queue: Queue.MATCHMAKING, queueTime: Date.now()}
        });
      }
    } else {
      // wait then match
      let pairingId = findMatchInWaiting(playerToQueue);
      if (pairingId) {
        Pairings.update(pairingId, {
          $set: {player2Id: playerToQueue._id, player2Name: playerToQueue.name}
        });
      } else {
        Pairings.insert({
          player1Id: playerToQueue._id,
          player1Name: playerToQueue.name,
          queue: Queue.WAITING,
          queueTime: Date.now()
        });
      }
      Players.update(playerToQueue._id, {$set: {queue: Queue.WAITING, queueTime: Date.now()}});
    }

    // it's possible we moved a pairing to the front of the waiting queue
    tryPromoteWaitingPair();
  },

  dequeueFromMatchmaking: function(playerId) {
    Players.update(playerId, {$set: {queue: Queue.NONE, queueTime: Date.now()}});
  },

  // playerNumber: 1 or 2 (player 1/player 2)
  submitWinner: function(pairingId, playerNumber) {
    if (!(playerNumber === 1 || playerNumber === 2)) {
      throw new Meteor.Error("BAD_REQUEST", "player number not 1 or 2");
    }
    const pairing = Pairings.findOne(pairingId);
    if (!pairing) {
      throw new Meteor.Error("BAD_REQUEST", "pairing not found");
    }

    const player1Id = pairing.player1Id;
    const player2Id = pairing.player2Id;
    if (playerNumber === 1) {
      giveWin(player1Id, player2Id);
      giveLoss(player2Id, player1Id);
    } else {
      giveLoss(player1Id, player2Id);
      giveWin(player2Id, player1Id);
    }
    Pairings.remove(pairingId);

    tryPromoteWaitingPair();
  },

	clearDb: function() {
		Players.remove({});
    Pairings.remove({});
	},
});

// Player
function findMatchInMatchmaking(queuingPlayer) {
  const matchedPlayers = Players.find({
    queue: Queue.MATCHMAKING, score: queuingPlayer.score}, {
    sort: [['queueTime', 'asc']]
  }).fetch();
  for (let i = 0; i < matchedPlayers.length; i++) {
    const matchedPlayer = matchedPlayers[i];
    if (!queuingPlayer.playersPlayed.includes(matchedPlayer._id)) {
      return matchedPlayer;
    }
  }
  return null;
}

// Pairing._id
function findMatchInWaiting(queuingPlayer) {
  const matchedPairings = Pairings.find({
    queue: Queue.WAITING, player2Id: {$exists: false}
  }).fetch();
  for (let i = 0; i < matchedPairings.length; i++) {
    const matchedPairing = matchedPairings[i];
    const matchedPlayer = Players.findOne(matchedPairing.player1Id);
    const scoresMatch = queuingPlayer.score === matchedPlayer.score;
    const havePlayed = queuingPlayer.playersPlayed.includes(matchedPlayer._id);
    if (scoresMatch && !havePlayed) {
      return matchedPairing._id;
    }
  }
  return null;
}

// void
function tryPromoteWaitingPair() {
  if (Pairings.find({queue: Queue.PLAYING}).count() >= NUM_SETUPS) {
    return;
  }

  let pairingToPlay = Pairings.findOne({
    queue: Queue.WAITING,
    player1Id: {$exists: true},
    player2Id: {$exists: true}
  }, {
    sort: [['queueTime', 'asc']]
  });
  if (!pairingToPlay) {
    return;
  }

  Players.update(pairingToPlay.player1Id, {$set: {queue: Queue.PLAYING, queueTime: Date.now()}});
  Players.update(pairingToPlay.player2Id, {$set: {queue: Queue.PLAYING, queueTime: Date.now()}});
  Pairings.update(pairingToPlay._id, {$set: {queue: Queue.PLAYING, queueTime: Date.now()}});

  // there could be more
  tryPromoteWaitingPair();
}

function giveWin(playerId, opponentId) {
  Players.update(playerId, {
    $inc: {score: 1, wins: 1},
    $set: {queue: Queue.NONE, queueTime: Date.now()},
    $addToSet: {playersPlayed: opponentId}
  });
}

function giveLoss(playerId, opponentId) {
  Players.update(playerId, {
    $inc: {score: -1, losses: 1},
    $set: {queue: Queue.NONE, queueTime: Date.now()},
    $addToSet: {playersPlayed: opponentId}
  });
}
