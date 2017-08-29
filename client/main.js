import {FlowRouter} from 'meteor/kadira:flow-router';
import {Ladders} from '../lib/collections.js';
import {Matches} from '../lib/collections.js';
import {Pairings} from '../lib/collections.js';
import {Players} from '../lib/collections.js';
import {Queue} from '../lib/queue.js';
import {ReactiveDict} from 'meteor/reactive-dict';
import {Setups} from '../lib/collections.js';
import {Template} from 'meteor/templating';

import {StandingsSelector} from '../lib/standings.js';
import {standingsSortFn} from '../lib/standings.js';

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
  this.dict.set('poolIndex', 0);
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
    const ladder = Ladders.findOne(Template.instance().dict.get('id'));
    return ladder ? ladder.started : false;
  },

  'smashggImport': function() {
    const smashggImport = Template.instance().dict.get('smashggImport');
    return smashggImport ? {
      name: smashggImport.name,
      pool: smashggImport.pools[Template.instance().dict.get('poolIndex')],
    } : undefined;
  },

  'players': function() {
    return Players.find({}, {sort: [['seed', 'desc']]});
  },

  'unqueued': function() {
    return Players.find({queue: Queue.NONE}, {sort: [['queueTime', 'asc']]});
  },

  'matchmaking': function() {
    return Players.find(
        {queue: Queue.MATCHMAKING}, {sort: [['queueTime', 'asc']]});
  },

  'waiting': function() {
    return Pairings.find(
        {queue: Queue.WAITING}, {sort: [['queueTime', 'asc']]});
  },

  'playing': function() {
    return Pairings.find(
        {queue: Queue.PLAYING}, {sort: [['queueTime', 'asc']]});
  },

  'standings': function() {
    return Players.find({queue: Queue.FROZEN}, {sort: [['queueTime', 'asc']]})
        .fetch()
        .concat(Players.find(StandingsSelector).fetch().sort(standingsSortFn));
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

  'isFrozen': function(queue) {
    return queue === Queue.FROZEN;
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

  'submit .importFromSmashgg': function(event, templateInstance) {
    Meteor.call('importFromSmashgg', event.target.slug.value, (err, res) => {
      if (err) {

      } else if (res) {
        templateInstance.dict.set('smashggImport', res);
      }
    });
    return false;
  },

  'click .addAll': function(event, templateInstance) {
    const smashggImport = templateInstance.dict.get('smashggImport');
    if (!smashggImport) {
      return;
    }
    const entrants =
        smashggImport.pools[templateInstance.dict.get('poolIndex')].entrants;
    if (entrants.length === 0) {
      return;
    }

    const ladderId = templateInstance.dict.get('id');
    Meteor.call('addAllPlayers', ladderId, entrants, (err) => {
      if (!err) {
        templateInstance.dict.set('smashggImport', undefined);
        templateInstance.dict.set('poolIndex', 0);
      }
    });
  },

  'click .incPoolIndex': function(event, templateInstance) {
    const smashggImport = templateInstance.dict.get('smashggImport');
    if (!smashggImport) {
      return;
    }
    let nextPoolIndex = templateInstance.dict.get('poolIndex') + 1;
    if (nextPoolIndex >= smashggImport.pools.length) {
      nextPoolIndex = 0;
    }
    templateInstance.dict.set('poolIndex', nextPoolIndex);
  },

  'click .incrementSeed': function(event, templateInstance) {
    Meteor.call(
      'incrementSeed', templateInstance.dict.get('id'), event.target.value, 1);
  },

  'click .decrementSeed': function(event, templateInstance) {
    Meteor.call(
      'incrementSeed', templateInstance.dict.get('id'), event.target.value, -1);
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

  'click .freezePlayer': function(event, templateInstance) {
    Meteor.call(
        'cullPlayer', templateInstance.dict.get('id'), event.target.value);
  },

  'click .unfreezePlayer': function(event, templateInstance) {
    Meteor.call(
        'reinstatePlayer', templateInstance.dict.get('id'), event.target.value);
  },
});
