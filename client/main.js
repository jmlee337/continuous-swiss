import {Template} from 'meteor/templating';

import {Pairings} from '../lib/collections.js';
import {Players} from '../lib/collections.js';
import {Queue} from '../lib/queue.js';

import './main.html';

Template.body.helpers({
	'unqueued': function() {
    return Players.find({queue: Queue.NONE}, {sort: [['queueTime', 'asc']]});
  },

  'matchmaking': function() {
    return Players.find({queue: Queue.MATCHMAKING}, {sort: [['queueTime', 'asc']]});
  },

  'waiting': function() {
    return Pairings.find({queue: Queue.WAITING}, {sort: [['queueTime', 'asc']]});
  },

  'playing': function() {
    return Pairings.find({queue: Queue.PLAYING}, {sort: [['queueTime', 'asc']]});
  },

  'standings': function() {
    return Players.find({games: {$gt: 0}}).fetch()
        .sort((a, b) => {
          if (a.score !== b.score) {
            return b.score - a.score;
          }
          return b.wins / b.games - a.wins / a.games;
        });
  }
});

Template.body.events({
  'submit .addPlayer': function(event) {
    const playerName = event.target.playerName;
    Meteor.call('addPlayer', playerName.value);
    playerName.value = "";
    return false;
  },

  'click .removePlayer': function(event) {
    Meteor.call('removePlayer', event.target.value);
  },

  'click .clear': function(event) {
    Meteor.call('clearDb');
  },

  'submit .queuePlayer': function(event) {
    Meteor.call('queuePlayer', event.target.playerId.value);
    return false;
  },

  'submit .dequeueMatchmakingPlayer': function(event) {
    Meteor.call('dequeueFromMatchmaking', event.target.playerId.value);
    return false;
  },

  'submit .dequeueWaitingPlayer': function(event) {
    if (event.target.quitter.value === 'player1') {
      Meteor.call('dequeueFromWaiting', event.target.pairingId.value, 1);
    } else if (event.target.quitter.value === 'player2') {
      Meteor.call('dequeueFromWaiting', event.target.pairingId.value, 2);
    }
    return false;
  },

  'submit .winPlayer': function(event) {
    if (event.target.winner.value === 'player1') {
      Meteor.call('submitWinner', event.target.pairingId.value, 1);
    } else if (event.target.winner.value === 'player2') {
      Meteor.call('submitWinner', event.target.pairingId.value, 2);
    }
    return false;
  }
});
