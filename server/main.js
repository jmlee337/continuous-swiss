import {HTTP} from 'meteor/http';
import {Meteor} from 'meteor/meteor';

import {Matches} from '../lib/collections.js';
import {Pairings} from '../lib/collections.js';
import {Players} from '../lib/collections.js';
import {Queue} from '../lib/queue.js';
import {Setups} from '../lib/collections.js';

const URL_BASE = "https://api.smash.gg/";
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

  addFromSmashgg: function(slug) {
    // TODO: something with this eventually I guess.
    const entities =
        HTTP.get(URL_BASE + "tournament/" + slug + "?expand[]=groups&expand[]=phase&expand[]=event")
            .data.entities;
    if (!entities.groups) {
      return;
    }
    const groups = entities.groups.filter((group) => {
      return group.groupTypeId === 6;
    });
    for (let i = 0; i < groups.length; i++) {
      const group = groups[i];
      const groupEntities =
          HTTP.get(URL_BASE + "phase_group/" + group.id + "?expand[]=entrants").data.entities;
      if (!groupEntities.entrants) {
        continue;
      }
      const entrantNames = groupEntities.entrants.map((entrant) => {
        return entrant.name;
      })

      const phase = entities.phase.filter((phase) => {
        return phase.id === group.phaseId; 
      })[0];

      const event = entities.event.filter((event) => {
        return event.id === phase.eventId;
      })[0];

      console.log(entities.tournament.name);
      console.log(event.name);
      console.log(phase.name);
      console.log(group.displayIdentifier);
      console.log(entrantNames);
    }
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
    Matches.update(playerToQueue.lastMatchId, {$set: {unfixable: true}});

    // it's possible we moved a pairing to the front of the waiting queue
    tryPromoteWaitingPairing();
  },

  unqueueFromMatchmaking: function(playerId) {
    Players.update(playerId, {$set: {queue: Queue.NONE, queueTime: Date.now()}});
  },

  // quitterNumber: 1 or 2 (player 1/player 2)
  unqueueFromWaiting: function(pairingId, quitterNumber) {
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
      const matchId = Matches.insert({
        winnerId: pairing.player1Id,
        winnerName: pairing.player1Name,
        loserId:  pairing.player2Id,
        loserName: pairing.player2Name,
        time: Date.now()
      });
      giveWin(pairing.player1Id,  pairing.player2Id, matchId);
      giveLoss(pairing.player2Id, pairing.player1Id, matchId);
    } else {
      const matchId = Matches.insert({
        winnerId:  pairing.player2Id,
        winnerName: pairing.player2Name,
        loserId: pairing.player1Id,
        loserName: pairing.player1Name,
        time: Date.now()
      });
      giveLoss(pairing.player1Id,  pairing.player2Id, matchId);
      giveWin(pairing.player2Id, pairing.player1Id, matchId);
    }
    Pairings.remove(pairingId);
    Setups.update(pairing.setupId, {$unset: {pairingId: ""}});

    tryPromoteWaitingPairing();
  },

  fixMatch: function(matchId) {
    const match = Matches.findOne(matchId);
    if (!match) {
      throw new Meteor.Error("BAD_REQUEST", "match not found");
    }
    if (match.unfixable) {
      throw new Meteor.Error("PRECONDITION_FAILED", "match is unfixable");
    }
    if (Players.findOne(match.winnerId).queue !== Queue.NONE) {
      throw new Meteor.Error("PRECONDITION_FAILED", "winner not unqueued");
    }
    if (Players.findOne(match.loserId).queue !== Queue.NONE) {
      throw new Meteor.Error("PRECONDITION_FAILED", "loser not unqueued");
    }

    Players.update(match.winnerId, {$inc: {wins: -1, losses: 1, score: -2}});
    Players.update(match.loserId, {$inc: {wins: 1, losses: -1, score: 2}});
    Matches.update(matchId, {$set: {
      winnerId: match.loserId,
      winnerName: match.loserName,
      loserId: match.winnerId,
      loserName: match.winnerName
    }});
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

function giveWin(playerId, opponentId, matchId) {
  Players.update(playerId, {
    $inc: {score: 1, wins: 1, games: 1},
    $set: {lastMatchId: matchId, queue: Queue.NONE, queueTime: Date.now()},
    $addToSet: {playersPlayed: opponentId}
  });
}

function giveLoss(playerId, opponentId, matchId) {
  Players.update(playerId, {
    $inc: {score: -1, losses: 1, games: 1},
    $set: {lastMatchId: matchId, queue: Queue.NONE, queueTime: Date.now()},
    $addToSet: {playersPlayed: opponentId}
  });
}
