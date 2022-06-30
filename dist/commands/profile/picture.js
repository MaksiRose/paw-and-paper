"use strict";
// @ts-check
const { MessageEmbed } = require('discord.js');
const { error_color } = require('../../../config.json');
const profileModel = require('../../models/profileModel');
const { hasName } = require('../../utils/checkAccountCompletion');
const startCooldown = require('../../utils/startCooldown');
module.exports.name = 'picture';
module.exports.aliases = ['pic', 'pfp', 'avatar'];
/**
 *
 * @param {import('../../paw').client} client
 * @param {import('discord.js').Message} message
 * @param {Array<string>} argumentsArray
 * @param {import('../../typedef').ProfileSchema | null} userData
 * @returns {Promise<void>}
 */
module.exports.sendMessage = async (client, message, argumentsArray, userData) => {
    const characterData = userData ? userData.characters[userData.currentCharacter[message.guildId || 'DM']] : null;
    if (!hasName(message, characterData)) {
        return;
    }
    userData = await startCooldown(message);
    const firstAttachment = message.attachments.first();
    if (!firstAttachment) {
        await message
            .reply({
            embeds: [new MessageEmbed({
                    color: /** @type {`#${string}`} */ (error_color),
                    title: 'Please send an image to set as your characters profile picture!',
                })],
            failIfNotExists: false,
        })
            .catch((error) => {
            if (error.httpStatus !== 404) {
                throw new Error(error);
            }
        });
        return;
    }
    const ImageLink = firstAttachment.url;
    if (!ImageLink.endsWith('.png') && !ImageLink.endsWith('.jpeg') && !ImageLink.endsWith('.jpg') && !ImageLink.endsWith('.raw') && !ImageLink.endsWith('.webp')) {
        await message
            .reply({
            embeds: [new MessageEmbed({
                    color: /** @type {`#${string}`} */ (error_color),
                    title: 'This image extension is not supported! Please send a .png, .jp(e)g, .raw or .webp image.',
                })],
            failIfNotExists: false,
        })
            .catch((error) => {
            if (error.httpStatus !== 404) {
                throw new Error(error);
            }
        });
        return;
    }
    userData = /** @type {import('../../typedef').ProfileSchema} */ (await profileModel.findOneAndUpdate({ uuid: userData.uuid }, (/** @type {import('../../typedef').ProfileSchema} */ p) => {
        p.characters[p.currentCharacter[message.guild?.id || 'DM']].avatarURL = ImageLink;
    }));
    await message
        .reply({
        embeds: [new MessageEmbed({
                color: characterData.color,
                author: { name: characterData.name, icon_url: ImageLink },
                title: `Profile picture for ${characterData.name} set!`,
                image: { url: ImageLink },
            })],
        failIfNotExists: false,
    })
        .catch((error) => {
        if (error.httpStatus !== 404) {
            throw new Error(error);
        }
    });
    return;
};
