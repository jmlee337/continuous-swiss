import {Mongo} from 'meteor/mongo';

/**
 * name: the name of this player.
 * score: this player's score.
 * wins: the number of wins this player has.
 * losses: the nubmer of losses this player has.
 * games: the number of games this player has played.
 * playersPlayed: an array of the player ids of the players this player has played.
 * queue: the queue this player is in.
 * queueTime: the time that this player enetered the current queue, used for ordering.
 */
export const Players = new Mongo.Collection('players');

/**
 * score: the mutual score of the players in this pairing.
 * player1Id: the _id of the player.
 * player1Name: the name of the player.
 * player2id: the _id of the player.
 * player2name: the name of the player.
 * queue: the queue this pairing is in. Only Queue.MATCHMAKING or Queue.PLAYING.
 * queueTime: the time that this pairing entered the current queue, used for ordering.
 * setupId: the _id of the setup if this pairing is playing.
 * setupNumber: the number of the setup if this pairing is playing.
 */
export const Pairings = new Mongo.Collection('pairings');

/**
 * number: the number of this setup.
 * pairingId: the _id of the pairing playing on this setup if any.
 */
export const Setups = new Mongo.Collection('setups');
