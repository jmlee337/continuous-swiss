import {HTTP} from 'meteor/http';
import {Meteor} from 'meteor/meteor';

import {check} from 'meteor/check';

const URL_BASE = 'https://api.smash.gg/';
const TOURNAMENT_BASE = URL_BASE + 'tournament/';
const TOURNAMENT_QUERY = '?expand[]=groups&expand[]=phase&expand[]=event';
const GROUP_BASE = URL_BASE + 'phase_group/';
const GROUP_QUERY = '?expand[]=entrants';

Meteor.methods({
  importFromSmashgg: function(slug) {
    check(slug, String);

    const tournamentUrl = TOURNAMENT_BASE + slug + TOURNAMENT_QUERY;
    let tournamentRes;
    try {
      tournamentRes = HTTP.get(tournamentUrl);
      if (!tournamentRes.data.entities) {
        throw new Error('No entities');
      }
    } catch (e) {
      if (e.response) {
        if (e.response.statusCode === 404) {
          throw new Meteor.Error('NOT_FOUND', 'tournament not found');
        } else if (statusCode) {
          throw new Meteor.Error(
              'INTERNAL',
              'unexpected status from smash.gg',
              statusCode.toString());
        }
      }
      throw new Meteor.Error('INTERNAL', 'unexpected error', e.toString());
    }

    const smashggImport = {
      name: tournamentRes.data.entities.tournament.name,
      pools: [],
    };

    if (!tournamentRes.data.entities.groups) {
      return smashggImport;
    }
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
});
