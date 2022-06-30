"use strict";
// @ts-check
const { error_color, default_color } = require('../../../config.json');
const serverModel = require('../../models/serverModel');
const isInGuild = require('../../utils/isInGuild');
module.exports.name = 'allowvisits';
/**
 *
 * @param {import('../../paw').client} client
 * @param {import('discord.js').Message} message
 * @param {Array<string>} argumentsArray
 * @returns {Promise<void>}
 */
module.exports.sendMessage = async (client, message, argumentsArray) => {
    if (!isInGuild(message)) {
        return;
    }
    if (!message.member || !message.member.permissions.has('ADMINISTRATOR')) {
        await message
            .reply({
            embeds: [{
                    color: /** @type {`#${string}`} */ (error_color),
                    title: 'Only administrators of a server can use this command!',
                }],
            failIfNotExists: false,
        })
            .catch((error) => {
            if (error.httpStatus !== 404) {
                throw new Error(error);
            }
        });
        return;
    }
    if (argumentsArray[0] === 'off') {
        await serverModel.findOneAndUpdate({ serverId: message.guild.id }, (/** @type {import('../../typedef').ServerSchema} */ s) => {
            s.visitChannelId = null;
        });
        await message
            .reply({
            embeds: [{
                    color: /** @type {`#${string}`} */ (default_color),
                    author: { name: message.guild.name, icon_url: message.guild.iconURL() || undefined },
                    description: 'Visits have successfully been turned off!',
                }],
            failIfNotExists: false,
        })
            .catch((error) => {
            if (error.httpStatus !== 404) {
                throw new Error(error);
            }
        });
        return;
    }
    const firstMentionedUser = message.mentions.channels.first();
    if (firstMentionedUser) {
        if (firstMentionedUser.isText() === false) {
            await message
                .reply({
                embeds: [{
                        color: /** @type {`#${string}`} */ (error_color),
                        description: 'Please mention a text channel.',
                        footer: { text: 'The channel you mention will be the channel through which two packs can communicate.' },
                    }],
                failIfNotExists: false,
            })
                .catch((error) => {
                if (error.httpStatus !== 404) {
                    throw new Error(error);
                }
            });
            return;
        }
        await serverModel.findOneAndUpdate({ serverId: message.guild.id }, (/** @type {import('../../typedef').ServerSchema} */ s) => {
            s.visitChannelId = firstMentionedUser.id;
        });
        await message
            .reply({
            embeds: [{
                    color: /** @type {`#${string}`} */ (default_color),
                    author: { name: message.guild.name, icon_url: message.guild.iconURL() || undefined },
                    description: `Visits are now possible in ${firstMentionedUser.toString()}!`,
                }],
            failIfNotExists: false,
        })
            .catch((error) => {
            if (error.httpStatus !== 404) {
                throw new Error(error);
            }
        });
        return;
    }
    await message
        .reply({
        embeds: [{
                color: /** @type {`#${string}`} */ (error_color),
                description: 'Please mention a channel to turn visits on, or type `rp allowvisits off` to turn visits off.',
                footer: { text: 'The channel you mention will be the channel through which two packs can communicate.' },
            }],
        failIfNotExists: false,
    })
        .catch((error) => {
        if (error.httpStatus !== 404) {
            throw new Error(error);
        }
    });
    return;
};
