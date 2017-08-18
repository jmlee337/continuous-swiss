import {Mongo} from 'meteor/mongo';

/**
 * name: the name of this player.
 * score: this player's score.
 * queue: the queue this player is in.
 * queueTime: the time that this player enetered the current queue, used for ordering.
 */
export const Players = new Mongo.Collection('players');

/**
 * player1Id: the _id of the player.
 * player1Name: the name of the player.
 * player2id: the _id of the player.
 * player2name: the name of the player.
 * queue: the queue this pairing is in. Only Queue.MATCHMAKING or Queue.PLAYING.
 * queueTime: the time that this pairing entered the current queue, used for ordering.
 */
export const Pairings = new Mongo.Collection('pairings');
