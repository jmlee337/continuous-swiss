import {FlowRouter} from 'meteor/kadira:flow-router';
import {Ladders} from '/lib/collections.js';
import {Matches} from '/lib/collections.js';
import {Pairings} from '/lib/collections.js';
import {Players} from '/lib/collections.js';
import {Queue} from '/lib/queue.js';
import {ReactiveDict} from 'meteor/reactive-dict';
import {Result} from '/lib/result.js';
import {Setups} from '/lib/collections.js';
import {SeedsOptions} from '/lib/seeds.js';
import {StandingsSelector} from '/lib/standings.js';
import {TimeSync} from 'meteor/mizzao:timesync';
import {Template} from 'meteor/templating';

import format from 'format-duration';
import {modeFn} from '/lib/mode.js';
import {standingsSortFn} from '/lib/standings.js';

import './ladderAdmin.html';

Template.ladderAdmin.onCreated(function() {
  this.dict = new ReactiveDict();
  this.dict.set('poolIndex', 0);
  let handles = [];

  this.autorun(() => {
    handles.forEach((handle) => {
      handle.stop();
    });
    handles = [];

    handles.push(this.subscribe('ladder', FlowRouter.getParam('slug'), () => {
      const ladder = Ladders.findOne();
      this.dict.set('name', ladder.name);

      handles.push(this.subscribe('players', ladder._id));
      handles.push(this.subscribe('pairings', ladder._id));
      handles.push(this.subscribe('setups', ladder._id));
      handles.push(this.subscribe('matches', ladder._id));
    }));
  });
});

Template.ladderAdmin.helpers({
  'ladderName': function() {
    return Template.instance().dict.get('name');
  },

  'started': function() {
    const ladder = Ladders.findOne();
    return ladder ? Ladders.findOne().started : false;
  },

  'smashggImport': function() {
    const smashggImport = Template.instance().dict.get('smashggImport');
    return smashggImport ? {
      name: smashggImport.name,
      pool: smashggImport.pools[Template.instance().dict.get('poolIndex')],
    } : undefined;
  },

  'players': function() {
    return Players.find({}, SeedsOptions);
  },

  'getSeed': function(seed) {
    return seed < Number.MAX_SAFE_INTEGER ? seed + 1 : undefined;
  },

  'selected': function(thisTier, selectedTier) {
    if (thisTier === selectedTier) {
      return 'selected';
    }
  },

  'finished': function() {
    return Players.find(
        {queue: Queue.FINISHED}, {sort: [['queueTime', 'desc']]});
  },

  'unqueued': function() {
    return Players.find({queue: Queue.NONE}).fetch().sort((a, b) => {
      if ((a.games > 0 && b.games > 0) ||
          (a.games === 0 && b.games === 0)) {
        return a.queueTime - b.queueTime;
      }
      if (a.games === 0) {
        return 1;
      }
      if (b.games === 0) {
        return -1;
      }
    });
  },

  'matchmaking': function() {
    return Players.find(
        {queue: Queue.MATCHMAKING}, {sort: [['queueTime', 'asc']]});
  },

  'waiting': function() {
    return Players.find({queue: Queue.WAITING}, {sort: [['queueTime', 'asc']]});
  },

  'playing': function() {
    return Pairings.find({}, {sort: [['queueTime', 'asc']]});
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

  'matchesObj': function() {
    return JSON.stringify(
        Matches.find({}, {sort: [['time', 'asc']]}).fetch().map((match) => {
          return {
            winner: match.winnerName,
            loser: match.loserName,
            forfeited: match.forfeited,
            time: match.time,
          };
        }));
  },

  'hasBonuses': function(bonuses, games) {
    return bonuses > games;
  },

  'isFrozen': function(queue) {
    return queue === Queue.FROZEN;
  },

  'shouldHighlight': function(queueTime) {
    return TimeSync.serverTime(undefined, 10000) - queueTime < 120000;
  },

  'elapsedTimeString': function(queueTime) {
    return format(TimeSync.serverTime(undefined, 1000) - queueTime);
  },

  'durationString': function(durationMs) {
    return format(durationMs);
  },

  'percentiles': function() {
    const PERCENTILES = [10, 50, 90];
    const durations = Matches.find({}, {sort: [['duration', 'asc']]})
        .map((match) => {
          return match.duration;
        });
    const length = durations.length;

    const percentileFn = function(p) {
      if (length === 0) return 0;
      if (p <= 0) return durations[0];
      if (p >= 100) return durations[length - 1];

      const index = (length - 1) * p / 100;
      const lower = Math.floor(index);
      const upper = lower + 1;
      const weight = index % 1;
      if (upper >= length) {
        return format(durations[lower]);
      }
      const ms = durations[lower] * (1 - weight) + durations[upper] * weight;
      return format(ms);
    };

    return PERCENTILES.map((p) => {
      const kString = 'p' + p;
      return {k: kString, v: percentileFn(p)};
    });
  },

  'prettifyResults': function(results) {
    return results.reduce((resultsStr, result) => {
      if (result === Result.WIN) {
        return resultsStr + 'W';
      } else {
        return resultsStr + 'L';
      }
    }, '');
  },

  'open': function() {
    return !Ladders.findOne().closed;
  },

  'canQueue': function(playerId) {
    if (Ladders.findOne().closed) {
      return false;
    }
    const modeGames = modeFn(Players.find({queue: {$ne: Queue.NONE}}).fetch());
    return Players.findOne(playerId).games <= modeGames + 1;
  },
});

Template.ladderAdmin.events({
  'submit .addPlayer': function(event) {
    const playerName = event.target.playerName;
    Meteor.call('addPlayer', Ladders.findOne()._id, playerName.value);
    playerName.value = '';
    return false;
  },

  'click .removePlayer': function(event) {
    Meteor.call('removePlayer', Ladders.findOne()._id, event.target.value);
  },

  'click .addSetup': function(event) {
    Meteor.call('addSetup', Ladders.findOne()._id);
  },

  'click .removeSetup': function(event) {
    Meteor.call('removeSetup', Ladders.findOne()._id, event.target.value);
  },

  'submit .importFromSmashgg': function(event, templateInstance) {
    Meteor.call('importFromSmashgg', event.target.slug.value, (err, res) => {
      if (err || !res) {
        if (err.error === 'NOT_FOUND') {
          res = {
            name: 'Slug: "' + event.target.slug.value + '" not found.',
            pools: [],
          };
        } else {
          res = {
            name: err.reason + ': ' + err.details,
            pools: [],
          };
        }
      }
      templateInstance.dict.set('smashggImport', res);
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

    Meteor.call('addAllPlayers', Ladders.findOne()._id, entrants, (err) => {
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

  'click .raiseSeed': function(event) {
    Meteor.call('raiseSeed', Ladders.findOne()._id, event.target.value);
  },

  'click .lowerSeed': function(event) {
    Meteor.call('lowerSeed', Ladders.findOne()._id, event.target.value);
  },

  'change .tier': function(event) {
    const value = event.target.value;
    const tier = value && parseInt(value) ? parseInt(value): 0;
    Meteor.call('setTier', Ladders.findOne()._id, event.target.name, tier);
  },

  'click .startLadder': function(event) {
    Meteor.call('startLadder', Ladders.findOne()._id);
  },

  'click .closeLadder': function(event) {
    Meteor.call('setLadderClosed', Ladders.findOne()._id, true);
  },

  'click .openLadder': function(event) {
    Meteor.call('setLadderClosed', Ladders.findOne()._id, false);
  },

  'click .manualPromote': function(event) {
    Meteor.call('manualPromote', Ladders.findOne()._id);
  },

  'click .queuePlayer': function(event) {
    Meteor.call('queuePlayer', Ladders.findOne()._id, event.target.value);
  },

  'click .unqueue': function(event) {
    Meteor.call('unqueue', Ladders.findOne()._id, event.target.value);
  },

  'submit .winPlayer': function(event) {
    const ladderId = Ladders.findOne()._id;
    if (event.target.winner.value === 'player1') {
      Meteor.call('submitWinner', ladderId, event.target.pairingId.value, 1);
    } else if (event.target.winner.value === 'player2') {
      Meteor.call('submitWinner', ladderId, event.target.pairingId.value, 2);
    } else if (event.target.winner.value === 'player1Forfeit') {
      Meteor.call('submitForfeit', ladderId, event.target.pairingId.value, 1);
    } else if (event.target.winner.value === 'player2Forfeit') {
      Meteor.call('submitForfeit', ladderId, event.target.pairingId.value, 2);
    }
    return false;
  },

  'click .freezeMatch': function(event) {
    Meteor.call('freezeMatch', Ladders.findOne()._id, event.target.value);
  },

  'click .fixMatch': function(event) {
    Meteor.call('fixMatch', Ladders.findOne()._id, event.target.value);
  },

  'click .freezePlayer': function(event) {
    Meteor.call('cullPlayer', Ladders.findOne()._id, event.target.value);
  },

  'click .unfreezePlayer': function(event) {
    Meteor.call('reinstatePlayer', Ladders.findOne()._id, event.target.value);
  },
});
