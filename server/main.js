import {HTTP} from 'meteor/http';
import {Ladders} from '../lib/collections.js';
import {Match} from 'meteor/check';
import {Matches} from '../lib/collections.js';
import {Meteor} from 'meteor/meteor';
import {Pairings} from '../lib/collections.js';
import {Players} from '../lib/collections.js';
import {Queue} from '../lib/queue.js';
import {Setups} from '../lib/collections.js';

import {check} from 'meteor/check';
import slug from 'slug';

slug.defaults.mode ='rfc3986';

const URL_BASE = 'https://api.smash.gg/';
const TOURNAMENT_BASE = URL_BASE + 'tournament/';
const TOURNAMENT_QUERY = '?expand[]=groups&expand[]=phase&expand[]=event';
const GROUP_BASE = URL_BASE + 'phase_group/';
const GROUP_QUERY = '?expand[]=entrants';

Meteor.methods({
  createLadder: function(name) {
    check(name, String);

    const ladderSlug = slug(name);
    if (Ladders.findOne({slug: ladderSlug})) {
      throw new Meteor.Error('BAD_REQUEST', 'name matches existing tournament');
    }
    Ladders.insert({slug: ladderSlug, name: name, started: false});
    return ladderSlug;
  },

  importFromSmashgg: function(slug) {
    check(slug, String);

    const tournamentUrl = TOURNAMENT_BASE + slug + TOURNAMENT_QUERY;
    const tournamentRes = HTTP.get(tournamentUrl);
    if (!tournamentRes.data.entities.groups) {
      return;
    }

    const smashggImport = {
      name: tournamentRes.data.entities.tournament.name,
      pools: [],
    };
    tournamentRes.data.entities.groups.filter((group) => {
      return group.groupTypeId === 6;
    }).forEach((group) => {
      const groupUrl = GROUP_BASE + group.id + GROUP_QUERY;
      const entities = HTTP.get(groupUrl).data.entities;
      if (!entities || !entities.entrants || entities.entrants.length === 0) {
        return;
      }

      const phase = tournamentRes.data.entities.phase.filter((phase) => {
        return phase.id === group.phaseId;
      })[0];
      const event = tournamentRes.data.entities.event.filter((event) => {
        return event.id === phase.eventId;
      })[0];
      const entrantNames = entities.entrants.map((entrant) => {
        return entrant.name;
      });

      smashggImport.pools.push({
        event: event ? event.name : '',
        phase: phase ? phase.name : '',
        group: group.displayIdentifier,
        entrants: entrantNames,
      });
    });

    return smashggImport;
  },

  addAllPlayers: function(ladderId, playerNames) {
    check(ladderId, String);
    check(playerNames, [String]);

    if (Ladders.findOne(ladderId).started) {
      throw new Meteor.Error('PRECONDITION_FAILED', 'ladder already started');
    }
    playerNames.forEach((playerName) => {
      Players.insert({
        ladderId: ladderId,
        name: playerName,
        score: 0,
        wins: 0,
        losses: 0,
        games: 0,
        seed: 0,
        playersPlayed: [],
        bonuses: 0,
        queue: Queue.NONE,
        queueTime: Date.now(),
      });
    });
  },

  incrementSeed: function(ladderId, playerId, n) {
    Players.update(playerId, {$inc: {seed: n}});
  },

  startLadder: function(ladderId) {
    check(ladderId, String);

    Ladders.update(ladderId, {$set: {started: true}});
    const players =
        Players.find({ladderId: ladderId}, {sort: [['seed', 'desc']]}).fetch();
    const ordering = createInitialPairings(players.length);
    console.log(ordering);
    for (let i = 0; i < players.length; i++) {
      queuePlayerCommon(ladderId, players[ordering[i]]._id, false);
    }
  },

  addSetup: function(ladderId) {
    check(ladderId, String);

    const setups =
        Setups.find({ladderId: ladderId}, {sort: [['number', 'asc']]}).fetch();
    if (setups.length === 0) {
      Setups.insert({ladderId: ladderId, number: 1});
    } else if (setups[setups.length - 1].number === setups.length) {
      // if there's no gap in numbering, add the new setup at the end.
      Setups.insert({ladderId: ladderId, number: setups.length + 1});
    } else {
      // there's a gap somewhere, find it and fill it.
      for (let i = 0; i < setups.length; i++) {
        if (setups[i].number !== i + 1) {
          Setups.insert({ladderId: ladderId, number: i + 1});
          return;
        }
      }
    }
    tryPromoteWaitingPairing(ladderId);
  },

  removeSetup: function(ladderId, setupId) {
    check(ladderId, String);
    check(setupId, String);

    Setups.remove(setupId);
  },

  addPlayer: function(ladderId, playerName) {
    check(ladderId, String);
    check(playerName, String);

    let bonuses = 0;
    const firstPlace = Players.find({
      ladderId: ladderId, bonuses: 0,
    }, {
      sort: [['score', 'desc']],
    }).fetch()[0];
    if (firstPlace) {
      bonuses = Math.floor(firstPlace.score / 2);
    }

    Players.insert({
      ladderId: ladderId,
      name: playerName,
      score: bonuses,
      wins: 0,
      losses: 0,
      games: 0,
      seed: 0,
      playersPlayed: [],
      bonuses: bonuses,
      queue: Queue.NONE,
      queueTime: Date.now(),
    });
  },

  removePlayer: function(ladderId, playerId) {
    check(ladderId, String);
    check(playerId, String);

    Players.remove(playerId);
  },

  queuePlayer: function(ladderId, playerId) {
    check(ladderId, String);
    check(playerId, String);

    queuePlayerCommon(ladderId, playerId, true);
  },

  unqueueFromMatchmaking: function(ladderId, playerId) {
    check(ladderId, String);
    check(playerId, String);

    Players.update(
        playerId, {$set: {queue: Queue.NONE, queueTime: Date.now()}});
  },

  // quitterNumber: 1 or 2 (player 1/player 2)
  unqueueFromWaiting: function(ladderId, pairingId, quitterNumber) {
    check(ladderId, String);
    check(pairingId, String);
    check(quitterNumber, Match.Integer);

    if (!(quitterNumber === 1 || quitterNumber === 2)) {
      throw new Meteor.Error('BAD_REQUEST', 'quitter number not 1 or 2');
    }
    const pairing = Pairings.findOne(pairingId);
    if (!pairing) {
      throw new Meteor.Error('BAD_REQUEST', 'pairing not found');
    }

    if (quitterNumber === 1) {
      Players.update(
          pairing.player1Id,
          {$set: {queue: Queue.NONE, queueTime: Date.now()}});
      if (pairing.player2Id) {
        queuePlayerCommon(ladderId, pairing.player2Id, false);
      }
      Pairings.remove(pairingId);
    } else {
      Players.update(
          pairing.player2Id,
          {$set: {queue: Queue.NONE, queueTime: Date.now()}});
      queuePlayerCommon(ladderId, pairing.player1Id, false);
      Pairings.remove(pairingId);
    }
  },

  // winnerNumber: 1 or 2 (player 1/player 2)
  submitWinner: function(ladderId, pairingId, winnerNumber) {
    check(ladderId, String);
    check(pairingId, String);
    check(winnerNumber, Match.Integer);

    if (!(winnerNumber === 1 || winnerNumber === 2)) {
      throw new Meteor.Error('BAD_REQUEST', 'winner number not 1 or 2');
    }
    const pairing = Pairings.findOne(pairingId);
    if (!pairing) {
      throw new Meteor.Error('BAD_REQUEST', 'pairing not found');
    }

    if (winnerNumber === 1) {
      const matchId = Matches.insert({
        ladderId: ladderId,
        winnerId: pairing.player1Id,
        winnerName: pairing.player1Name,
        winnerBonus: pairing.player1Bonus,
        loserId: pairing.player2Id,
        loserName: pairing.player2Name,
        loserBonus: pairing.player2Bonus,
        time: Date.now(),
      });
      giveWin(pairing.player1Id, pairing.player2Id, matchId);
      giveLoss(
          pairing.player2Id, pairing.player1Id, pairing.player2Bonus, matchId);
    } else {
      const matchId = Matches.insert({
        ladderId: ladderId,
        winnerId: pairing.player2Id,
        winnerName: pairing.player2Name,
        winnerBonus: pairing.player2Bonus,
        loserId: pairing.player1Id,
        loserName: pairing.player1Name,
        loserBonus: pairing.player1Bonus,
        time: Date.now(),
      });
      giveLoss(
          pairing.player1Id, pairing.player2Id, pairing.player1Bonus, matchId);
      giveWin(pairing.player2Id, pairing.player1Id, matchId);
    }
    Pairings.remove(pairingId);
    Setups.update(pairing.setupId, {$unset: {pairingId: ''}});

    tryPromoteWaitingPairing(ladderId);
  },

  fixMatch: function(ladderId, matchId) {
    check(ladderId, String);
    check(matchId, String);

    const match = Matches.findOne(matchId);
    if (!match) {
      throw new Meteor.Error('BAD_REQUEST', 'match not found');
    }
    if (match.unfixable) {
      throw new Meteor.Error('PRECONDITION_FAILED', 'match is unfixable');
    }
    if (Players.findOne(match.winnerId).queue !== Queue.NONE) {
      throw new Meteor.Error('PRECONDITION_FAILED', 'winner not unqueued');
    }
    if (Players.findOne(match.loserId).queue !== Queue.NONE) {
      throw new Meteor.Error('PRECONDITION_FAILED', 'loser not unqueued');
    }

    Players.update(
        match.winnerId,
        {$inc: {score: match.winnerBonus ? -2 : -1, wins: -1, losses: 1}});
    Players.update(
        match.loserId,
        {$inc: {score: match.loserBonus ? 2 : 1, wins: 1, losses: -1}});
    Matches.update(matchId, {$set: {
      winnerId: match.loserId,
      winnerName: match.loserName,
      winnerBonus: match.loserBonus,
      loserId: match.winnerId,
      loserName: match.winnerName,
      loserBonus: match.winnerBonus,
    }});
  },

  cullPlayer: function(ladderId, playerId) {
    check(ladderId, String);
    check(playerId, String);

    cullPlayer(playerId);
  },

  reinstatePlayer: function(ladderId, playerId) {
    check(ladderId, String);
    check(playerId, String);

    const player = Players.findOne(playerId);
    if (!player || player.queue !== Queue.FROZEN) {
      throw new Meteor.Error('PRECONDITION_FAILED', 'player not frozen');
    }

    Players.update(
      playerId, {$set: {queue: Queue.NONE, queueTime: Date.now()}});
  },

  clearDb: function() {
    Ladders.remove({});
    Players.remove({});
    Pairings.remove({});
    Setups.remove({});
    Matches.remove({});
  },
});

function createInitialPairings(numPlayers) {
  let nodes = [];
  for(let i = 0; i < numPlayers; i++) {
    nodes.push({value: i});
  }
  const trees = pair(nodes);
  const order = [];
  read(trees[0], order);
  if (trees.length === 2) {
    order.push(trees[1].value);
  }
  return order;
}

function pair(nodes) {
  if (nodes.length === 1) {
    return nodes;
  }

  const newNodes = [];
  const stopIndex = Math.floor(nodes.length / 2);
  const lastIndex = nodes.length - 1;
  for(let i = 0; i < stopIndex; i++) {
    newNodes.push({
      value: nodes[i].value,
      top: nodes[i],
      bottom: nodes[lastIndex - i],
    });
  }

  const recursiveNodes = pair(newNodes);
  if (nodes.length % 2 === 1) {
    recursiveNodes.push(nodes[stopIndex]);
  }
  return recursiveNodes;
}

function read(node, out) {
  if (node.top) {
    read(node.top, out);
    read(node.bottom, out);
  } else {
    out.push(node.value);
  }
}

function queuePlayerCommon(ladderId, playerId, setUnfixable) {
  const player = Players.findOne(playerId);
  if (!player) {
    throw new Meteor.Error('BAD_REQUEST', 'player not found');
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
  return Players.find({
    ladderId: ladderId,
    queue: Queue.MATCHMAKING,
    score: queuingPlayer.score,
  }, {
    sort: [['queueTime', 'asc']],
  }).fetch().filter((matchedPlayer) => {
    return !queuingPlayer.playersPlayed.includes(matchedPlayer._id);
  })[0];
}

// Pairing._id
function findMatchInWaiting(ladderId, queuingPlayer) {
  return Pairings.find({
    ladderId: ladderId,
    queue: Queue.WAITING,
    score: queuingPlayer.score,
    player2Id: {$exists: false},
  }, {
    sort: [['queueTime', 'asc']],
  }).fetch().filter((pairing) => {
    return !queuingPlayer.playersPlayed.includes(pairing.player1Id);
  })[0];
}

function addPlayerToPairing(player, pairingId) {
  Pairings.update(pairingId, {$set: {
    player2Id: player._id,
    player2Name: player.name,
    player2Bonus: player.bonuses > player.games,
  }});
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
    player2Id: player._id,
    player2Name: player.name,
    player2Bonus: player.bonuses > player.games,
    queue: Queue.WAITING,
    queueTime: Date.now(),
  });
}

// void
function tryPromoteWaitingPairing(ladderId) {
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

function giveWin(playerId, opponentId, matchId) {
  Players.update(playerId, {
    $inc: {score: 1, wins: 1, games: 1},
    $set: {lastMatchId: matchId, queue: Queue.NONE, queueTime: Date.now()},
    $addToSet: {playersPlayed: opponentId},
  });
}

function giveLoss(playerId, opponentId, bonus, matchId) {
  Players.update(playerId, {
    $inc: {score: bonus ? -1 : 0, losses: 1, games: 1},
    $set: {lastMatchId: matchId, queue: Queue.NONE, queueTime: Date.now()},
    $addToSet: {playersPlayed: opponentId},
  });
}

function cullPlayer(playerId) {
  Players.update(
    playerId, {$set: {queue: Queue.FROZEN, queueTime: Date.now()}});
}
