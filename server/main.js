import {Meteor} from 'meteor/meteor';

import {Matches} from '../lib/collections.js';
import {Pairings} from '../lib/collections.js';
import {Players} from '../lib/collections.js';
import {Queue} from '../lib/queue.js';
import {Setups} from '../lib/collections.js';

const SCORE_THRESHOLD = 0;

Meteor.methods({
  addSetup: function() {
    const setups = Setups.find({}, {sort: [['number', 'asc']]}).fetch();
    if (setups.length === 0) {
      Setups.insert({number: 1});
    } else if (setups[setups.length - 1].number === setups.length) {
      // if there's no gap in numbering, add the new setup at the end.
      Setups.insert({number: setups.length + 1});
    } else {
      // there's a gap somewhere, find it and fill it.
      for (let i = 0; i < setups.length; i++) {
        if (setups[i].number !== i + 1) {
          Setups.insert({number: i + 1});
          return;
        }
      }
    }
    tryPromoteWaitingPairing();
  },

  removeSetup: function(setupId) {
    Setups.remove(setupId);
  },

  addPlayer: function(playerName) {
    Players.insert({
      name: playerName,
      score: 0,
      wins: 0,
      losses: 0,
      games: 0,
      playersPlayed: [],
      queue: Queue.NONE,
      queueTime: Date.now()
    });
  },

  removePlayer: function(playerId) {
    Players.remove(playerId);
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
          score: matchedPlayer.score,
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
      const pairingId = findMatchInWaiting(playerToQueue);
      if (pairingId) {
        Pairings.update(pairingId, {
          $set: {player2Id: playerToQueue._id, player2Name: playerToQueue.name}
        });
      } else {
        Pairings.insert({
          score: playerToQueue.score,
          player1Id: playerToQueue._id,
          player1Name: playerToQueue.name,
          queue: Queue.WAITING,
          queueTime: Date.now()
        });
      }
      Players.update(playerToQueue._id, {$set: {queue: Queue.WAITING, queueTime: Date.now()}});
    }

    // it's possible we moved a pairing to the front of the waiting queue
    tryPromoteWaitingPairing();
  },

  dequeueFromMatchmaking: function(playerId) {
    Players.update(playerId, {$set: {queue: Queue.NONE, queueTime: Date.now()}});
  },

  // quitterNumber: 1 or 2 (player 1/player 2)
  dequeueFromWaiting: function(pairingId, quitterNumber) {
    if (!(quitterNumber === 1 || quitterNumber === 2)) {
      throw new Meteor.Error("BAD_REQUEST", "quitter number not 1 or 2");
    }
    const pairing = Pairings.findOne(pairingId);
    if (!pairing) {
      throw new Meteor.Error("BAD_REQUEST", "pairing not found");
    }

    if (quitterNumber === 1) {
      Players.update(pairing.player1Id, {$set: {queue: Queue.NONE, queueTime: Date.now()}});
      if (pairing.player2Id) {
        if (pairing.score >= SCORE_THRESHOLD) {
          Players.update(pairing.player2Id, {
            $set: {queue: Queue.MATCHMAKING, queueTime: Date.now()}
          });
          Pairings.remove(pairingId);
        } else {
          Pairings.update(pairingId, {
            $set: {player1Id: pairing.player2Id, player1Name: pairing.player2Name},
            $unset: {player2Id: "", player2Name: ""}
          });
        }
      } else {
        Pairings.remove(pairingId);
      }
    } else {
      Players.update(pairing.player2Id, {$set: {queue: Queue.NONE, queueTime: Date.now()}});
      if (pairing.score >= SCORE_THRESHOLD) {
        Players.update(pairing.player1Id, {
          $set: {queue: Queue.MATCHMAKING, queueTime: Date.now()}
        });
        Pairings.remove(pairingId);
      } else {
        Pairings.update(pairingId, {$unset: {player2Id: "", player2Name: ""}});
      }
    }
  },

  // winnerNumber: 1 or 2 (player 1/player 2)
  submitWinner: function(pairingId, winnerNumber) {
    if (!(winnerNumber === 1 || winnerNumber === 2)) {
      throw new Meteor.Error("BAD_REQUEST", "winner number not 1 or 2");
    }
    const pairing = Pairings.findOne(pairingId);
    if (!pairing) {
      throw new Meteor.Error("BAD_REQUEST", "pairing not found");
    }

    if (winnerNumber === 1) {
      giveWin(pairing.player1Id,  pairing.player2Id);
      giveLoss( pairing.player2Id, pairing.player1Id);
      Matches.insert({
        winnerId: pairing.player1Id,
        winnerName: pairing.player1Name,
        loserId:  pairing.player2Id,
        loserName: pairing.player2Name,
        time: Date.now()
      });
    } else {
      giveLoss(pairing.player1Id,  pairing.player2Id);
      giveWin( pairing.player2Id, pairing.player1Id);
      Matches.insert({
        winnerId:  pairing.player2Id,
        winnerName: pairing.player2Name,
        loserId: pairing.player1Id,
        loserName: pairing.player1Name,
        time: Date.now()
      });
    }
    Pairings.remove(pairingId);
    Setups.update(pairing.setupId, {$unset: {pairingId: ""}});

    tryPromoteWaitingPairing();
  },

	clearDb: function() {
		Players.remove({});
    Pairings.remove({});
    Setups.remove({});
    Matches.remove({});
	},
});

// Player
function findMatchInMatchmaking(queuingPlayer) {
  const matchedPlayers = Players.find({
    queue: Queue.MATCHMAKING, score: queuingPlayer.score
  }, {
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
  const pairings = Pairings.find({
    queue: Queue.WAITING, score: queuingPlayer.score, player2Id: {$exists: false}
  }, {
    sort: [['queueTime', 'asc']]
  }).fetch();
  for (let i = 0; i < pairings.length; i++) {
    const pairing = pairings[i];
    if (!queuingPlayer.playersPlayed.includes(pairing.player1Id)) {
      return pairing._id;
    }
  }
  return null;
}

// void
function tryPromoteWaitingPairing() {
  const setups = Setups.find({pairingId: {$exists: false}}, {sort: [['number', 'asc']]}).fetch();
  const pairings = Pairings.find({
    queue: Queue.WAITING,
    player1Id: {$exists: true},
    player2Id: {$exists: true}
  }, {
    sort: [['queueTime', 'asc']]
  }).fetch();
  const length = Math.min(setups.length, pairings.length);

  for (let i = 0; i < length; i++) {
    const setup = setups[i];
    const pairing = pairings[i];

    Players.update(pairing.player1Id, {$set: {queue: Queue.PLAYING, queueTime: Date.now()}});
    Players.update(pairing.player2Id, {$set: {queue: Queue.PLAYING, queueTime: Date.now()}});
    Pairings.update(pairing._id, {$set: {
      queue: Queue.PLAYING, queueTime: Date.now(), setupId: setup._id, setupNumber: setup.number
    }});
    Setups.update(setup._id, {$set: {pairingId: pairing._id}});
  }


}

function giveWin(playerId, opponentId) {
  Players.update(playerId, {
    $inc: {score: 1, wins: 1, games: 1},
    $set: {queue: Queue.NONE, queueTime: Date.now()},
    $addToSet: {playersPlayed: opponentId}
  });
}

function giveLoss(playerId, opponentId) {
  Players.update(playerId, {
    $inc: {score: -1, losses: 1, games: 1},
    $set: {queue: Queue.NONE, queueTime: Date.now()},
    $addToSet: {playersPlayed: opponentId}
  });
}
