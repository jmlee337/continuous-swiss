import {FlowRouter} from 'meteor/kadira:flow-router';
import {ReactiveDict} from 'meteor/reactive-dict';
import {Template} from 'meteor/templating';

import {Ladders} from '../lib/collections.js';
import {Matches} from '../lib/collections.js';
import {Pairings} from '../lib/collections.js';
import {Players} from '../lib/collections.js';
import {Queue} from '../lib/queue.js';
import {Setups} from '../lib/collections.js';

import './main.html';

Template.laddersPage.onCreated(function() {
  this.subscribe('ladders');
});

Template.laddersPage.helpers({
  'ladders': function() {
    return Ladders.find({});
  },
});

Template.laddersPage.events({
  'submit .createLadder': function(event) {
    Meteor.call('createLadder', event.target.ladderName.value, (err, slug) => {
      if (err) {

      } else if (slug) {
        FlowRouter.go('/ladder/' + slug);
      }
    });
    return false;
  },

  'click .clearDb': function(event) {
    Meteor.call('clearDb');
  },
});

Template.ladderPage.onCreated(function() {
  this.dict = new ReactiveDict();
  const handle = this.subscribe('ladders');
  this.slug = () => FlowRouter.getParam('slug');

  this.autorun(() => {
    if (handle.ready()) {
      const ladder = Ladders.findOne({slug: this.slug()});
      if (ladder) {
        this.dict.set('name', ladder.name);
        this.dict.set('id', ladder._id);

        this.subscribe('players', ladder._id);
        this.subscribe('pairings', ladder._id);
        this.subscribe('setups', ladder._id);
        this.subscribe('matches', ladder._id);
      }
    }
  });
});

Template.ladderPage.helpers({
  'ladderName': function() {
    return Template.instance().dict.get('name');
  },

  'started': function() {
    return Ladders.findOne(Template.instance().dict.get('id')).started;
  },

  'players': function() {
    return Players.find();
  },

  'unqueued': function() {
    return Players.find({queue: Queue.NONE}, {sort: [['queueTime', 'asc']]});
  },

  'matchmaking': function() {
    return Players.find({
      queue: Queue.MATCHMAKING,
    }, {
      sort: [['queueTime', 'asc']],
    });
  },

  'waiting': function() {
    return Pairings.find({
      queue: Queue.WAITING,
    }, {
      sort: [['queueTime', 'asc']],
    });
  },

  'playing': function() {
    return Pairings.find({
      queue: Queue.PLAYING,
    }, {
      sort: [['queueTime', 'asc']],
    });
  },

  'standings': function() {
    return Players.find({games: {$gt: 0}}).fetch()
        .sort((a, b) => {
          if (a.score !== b.score) {
            return b.score - a.score;
          }
          return b.wins / b.games - a.wins / a.games;
        });
  },

  'setups': function() {
    return Setups.find({}, {sort: [['number', 'asc']]});
  },

  'matches': function() {
    return Matches.find({}, {sort: [['time', 'desc']]});
  },

  'hasBonuses': function(bonuses, games) {
    return bonuses > games;
  },
});

Template.ladderPage.events({
  'submit .addPlayer': function(event, templateInstance) {
    const playerName = event.target.playerName;
    Meteor.call('addPlayer', templateInstance.dict.get('id'), playerName.value);
    playerName.value = '';
    return false;
  },

  'click .removePlayer': function(event, templateInstance) {
    Meteor.call(
        'removePlayer', templateInstance.dict.get('id'), event.target.value);
  },

  'click .addSetup': function(event, templateInstance) {
    Meteor.call('addSetup', templateInstance.dict.get('id'));
  },

  'click .removeSetup': function(event, templateInstance) {
    Meteor.call(
        'removeSetup', templateInstance.dict.get('id'), event.target.value);
  },

  'click .startLadder': function(event, templateInstance) {
    Meteor.call('startLadder', templateInstance.dict.get('id'));
  },

  'click .queuePlayer': function(event, templateInstance) {
    Meteor.call(
        'queuePlayer', templateInstance.dict.get('id'), event.target.value);
  },

  'click .unqueueMatchmaking': function(event, templateInstance) {
    Meteor.call(
        'unqueueFromMatchmaking',
        templateInstance.dict.get('id'),
        event.target.value);
  },

  'submit .unqueueWaiting': function(event, templateInstance) {
    if (event.target.quitter.value === 'player1') {
      Meteor.call(
          'unqueueFromWaiting',
          templateInstance.dict.get('id'),
          event.target.pairingId.value, 1);
    } else if (event.target.quitter.value === 'player2') {
      Meteor.call(
          'unqueueFromWaiting',
          templateInstance.dict.get('id'),
          event.target.pairingId.value, 2);
    }
    return false;
  },

  'submit .winPlayer': function(event, templateInstance) {
    if (event.target.winner.value === 'player1') {
      Meteor.call(
          'submitWinner',
          templateInstance.dict.get('id'),
          event.target.pairingId.value,
          1);
    } else if (event.target.winner.value === 'player2') {
      Meteor.call(
          'submitWinner',
          templateInstance.dict.get('id'),
          event.target.pairingId.value,
          2);
    }
    return false;
  },

  'click .fixMatch': function(event, templateInstance) {
    Meteor.call(
        'fixMatch', templateInstance.dict.get('id'), event.target.value);
  },
});
