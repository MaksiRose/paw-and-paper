"use strict";
/**
 *
 * @param {import('discord.js').Message} message
 * @returns {Array<string>}
 */
module.exports = (message) => {
    const array1 = message.mentions.users.map(u => u.id);
    const array2 = (message.content.match(/<@!?(\d{17,19})>/g) || [])?.map(mention => mention.replace('<@', '').replace('>', '').replace('!', ''));
    return [...new Set([...array1, ...array2])];
};
