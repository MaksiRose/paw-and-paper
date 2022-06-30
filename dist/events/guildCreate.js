"use strict";
// @ts-check
const { createGuild } = require('../utils/updateGuild');
/**
 * @type {import('../typedef').Event}
 */
const event = {
    name: 'guildCreate',
    once: false,
    /**
     * Emitted whenever the client joins a guild.
     * @param {import('../paw').client} client
     * @param {import('discord.js').Guild} guild
     */
    async execute(client, guild) {
        console.log(`\x1b[44m${guild.name} (${guild.id})\x1b[0m successfully added the bot - It is now in ${client.guilds.cache.size} servers`);
        await createGuild(client, guild);
    },
};
module.exports = event;
