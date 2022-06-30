"use strict";
// @ts-check
const { readdirSync } = require('fs');
const serverModel = require('../models/serverModel');
const { deleteGuild } = require('../utils/updateGuild');
/**
 * Updates all server accounts
 * @param {import('../paw').client} client
 */
module.exports.execute = async (client) => {
    const files = readdirSync('./database/servers').filter(file => file.endsWith('.json'));
    for (const file of files) {
        const serverData = /** @type {import('../typedef').ServerSchema | null} */ (await serverModel
            .findOneAndUpdate({ uuid: file.replace('.json', '') }, (/** @type {import('../typedef').ServerSchema} */ s) => {
            s.currentlyVisiting = null;
        }));
        if (serverData) {
            await client.guilds
                .fetch(serverData.serverId)
                .catch(error => {
                if (error.httpStatus === 403) {
                    deleteGuild(serverData.serverId);
                }
                else {
                    console.error(error);
                }
            });
        }
    }
};
