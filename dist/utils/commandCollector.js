"use strict";
// @ts-check
const disableAllComponents = require('./disableAllComponents');
/** @type {Object<string, Function>} */
const activeCommandsObject = {};
/**
 * Adds a Function as a value to the key of the user and guild ID. The function removes components and deletes itself when called.
 * @param {string} userId
 * @param {string} guildId
 * @param {import('discord.js').Message} botReply
 */
function createCommandCollector(userId, guildId, botReply) {
    module.exports.activeCommandsObject['nr' + userId + guildId] = async () => {
        delete activeCommandsObject['nr' + userId + guildId];
        await botReply
            .edit({
            components: disableAllComponents(botReply.components),
        })
            .catch((error) => {
            if (error.httpStatus !== 404) {
                throw new Error(error);
            }
        });
    };
}
module.exports = {
    activeCommandsObject,
    createCommandCollector,
};
