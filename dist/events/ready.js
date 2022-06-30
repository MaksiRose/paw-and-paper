"use strict";
// @ts-check
const { readFileSync, unlinkSync, writeFileSync } = require('fs');
const profileModel = require('../models/profileModel');
const serverModel = require('../models/serverModel');
const { createGuild } = require('../utils/updateGuild');
/**
 * @type {import('../typedef').Event}
 */
const event = {
    name: 'ready',
    once: true,
    /**
     * Emitted when the client becomes ready to start working.
     * @param {import('../paw').client} client
     */
    async execute(client) {
        console.log('Paw and Paper is online!');
        client.user?.setActivity('this awesome RPG :)\nrp help', { type: 'PLAYING' });
        for (const file of ['commands', 'votes', 'servers', 'profiles']) {
            try {
                await require(`../handlers/${file}`).execute(client);
            }
            catch (error) {
                console.error(error);
            }
        }
        const allServers = await client.guilds.fetch();
        for (const [, OAuth2Guild] of allServers) {
            const serverData = /** @type {import('../typedef').ServerSchema} */ (await serverModel.findOneAndUpdate({ serverId: OAuth2Guild.id }, (/** @type {import('../typedef').ServerSchema} */ s) => {
                s.name = OAuth2Guild.name;
            }));
            if (!serverData) {
                const guild = await client.guilds.fetch(OAuth2Guild.id);
                await createGuild(client, guild);
            }
        }
        setInterval(async () => {
            /** @type {import('../typedef').DeleteList} */
            const toDeleteList = JSON.parse(readFileSync('./database/toDeleteList.json', 'utf-8'));
            for (const [filename, deletionTime] of Object.entries(toDeleteList)) {
                if (deletionTime < Date.now() + 3600000) {
                    unlinkSync(`./database/toDelete/${filename}.json`);
                    delete toDeleteList[filename];
                }
            }
            writeFileSync('./database/toDeleteList.json', JSON.stringify(toDeleteList, null, '\t'));
            const userList = /** @type {Array<import('../typedef').ProfileSchema>} */ (await profileModel.find());
            for (const userData of userList) {
                for (const characterData of Object.values(userData.characters)) {
                    for (const profileData of Object.values(characterData.profiles)) {
                        for (const [timestamp, statKind] of Object.entries(profileData.temporaryStatIncrease)) {
                            if (Number(timestamp) < Date.now() - 604800000) {
                                await profileModel.findOneAndUpdate({ uuid: userData.uuid }, (/** @type {import('../typedef').ProfileSchema} */ p) => {
                                    p.characters[characterData._id].profiles[profileData.serverId][statKind] -= 10;
                                    if (p.characters[characterData._id].profiles[profileData.serverId][statKind.replace('max', '').toLowerCase()] > p.characters[characterData._id].profiles[profileData.serverId][statKind]) {
                                        p.characters[characterData._id].profiles[profileData.serverId][statKind.replace('max', '').toLowerCase()] = p.characters[characterData._id].profiles[profileData.serverId][statKind];
                                    }
                                    delete p.characters[characterData._id].profiles[profileData.serverId].temporaryStatIncrease[timestamp];
                                });
                            }
                        }
                    }
                }
            }
        }, 3600000);
    },
};
module.exports = event;
