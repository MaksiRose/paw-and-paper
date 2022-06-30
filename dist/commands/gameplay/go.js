"use strict";
// @ts-check
const profileModel = require('../../models/profileModel');
const startCooldown = require('../../utils/startCooldown');
const { hasCompletedAccount } = require('../../utils/checkAccountCompletion');
const { isInvalid } = require('../../utils/checkValidity');
const { createCommandCollector } = require('../../utils/commandCollector');
const { prefix } = require('../../../config.json');
const { execute } = require('../../events/messageCreate');
const { remindOfAttack } = require('./attack');
const { pronoun, pronounAndPlural } = require('../../utils/getPronouns');
const { MessageSelectMenu, MessageActionRow, MessageButton, MessageEmbed } = require('discord.js');
const disableAllComponents = require('../../utils/disableAllComponents');
const isInGuild = require('../../utils/isInGuild');
module.exports.name = 'go';
module.exports.aliases = ['region'];
/**
 *
 * @param {import('../../paw').client} client
 * @param {import('discord.js').Message} message
 * @param {Array<string>} argumentsArray
 * @param {import('../../typedef').ProfileSchema} userData
 * @param {import('../../typedef').ServerSchema} serverData
 * @param {Array<import('discord.js').MessageEmbed>} embedArray
 * @returns {Promise<void>}
 */
module.exports.sendMessage = async (client, message, argumentsArray, userData, serverData, embedArray) => {
    if (!isInGuild(message)) {
        return;
    }
    const characterData = userData?.characters?.[userData?.currentCharacter?.[message.guild.id]];
    const profileData = characterData?.profiles?.[message.guild.id];
    if (!hasCompletedAccount(message, characterData)) {
        return;
    }
    if (await isInvalid(message, userData, embedArray, module.exports.aliases.concat(module.exports.name))) {
        return;
    }
    userData = await startCooldown(message);
    const messageContent = remindOfAttack(message);
    userData = /** @type {import('../../typedef').ProfileSchema} */ (await profileModel.findOne({ userId: message.author.id }));
    const chosenRegion = argumentsArray.join(' ').toLowerCase();
    const travelComponent = new MessageActionRow({
        components: [new MessageSelectMenu({
                customId: 'pack-travel',
                placeholder: 'Select a region',
                options: [
                    { label: 'sleeping dens', value: 'sleeping_dens', emoji: '💤' },
                    { label: 'food den', value: 'food_den', emoji: '🍖' },
                    { label: 'medicine den', value: 'medicine_den', emoji: '🌿' },
                    { label: 'ruins', value: 'ruins', emoji: '🏛️' },
                    { label: 'lake', value: 'lake', emoji: '🌊' },
                    { label: 'prairie', value: 'prairie', emoji: '🌼' },
                ],
            })],
    });
    const sleepingDenButtons = new MessageActionRow({
        components: [new MessageButton({
                customId: 'execute-rest',
                label: 'Rest',
                style: 'PRIMARY',
            })],
    });
    const foodDenButtons = new MessageActionRow({
        components: [new MessageButton({
                customId: 'execute-inventory',
                label: 'View Inventory',
                style: 'PRIMARY',
            }), new MessageButton({
                customId: 'execute-store',
                label: 'Store food away',
                style: 'PRIMARY',
            })],
    });
    const medicineDenButtons = new MessageActionRow({
        components: [new MessageButton({
                customId: 'execute-heal',
                label: 'Heal',
                style: 'PRIMARY',
            })],
    });
    const lakeButtons = new MessageActionRow({
        components: [new MessageButton({
                customId: 'execute-drink',
                label: 'Drink',
                style: 'PRIMARY',
            })],
    });
    const prairieButtons = new MessageActionRow({
        components: [new MessageButton({
                customId: 'execute-play',
                label: 'Play',
                style: 'PRIMARY',
            })],
    });
    const embed = new MessageEmbed({
        color: characterData.color,
        author: { name: characterData.name, icon_url: characterData.avatarURL },
        description: `You are currently at the ${profileData.currentRegion}! Here are the regions you can go to:`,
        fields: [
            { name: '💤 sleeping dens', value: 'A place to sleep and relax. Go here if you need to refill your energy!' },
            { name: '🍖 food den', value: 'Inspect all the food the pack has gathered, eat some or add to it from your inventory!' },
            { name: '🌿 medicine den', value: 'Go here if you need to be healed. Someone will come and help you.' },
            { name: '🏛️ ruins', value: 'These old stones are a little creepy at night, but at day packmates frequently gather here to talk and meet up.' },
            { name: '🌊 lake', value: 'Not only do some aquatic packmates live here, but it is also the primary source of fresh water, in case someone is thirsty.' },
            { name: '🌼 prairie', value: 'This is where the Younglings go to play! Everyone else can also come here and play with them.' },
        ],
    });
    let botReply;
    if (chosenRegion === 'sleeping dens') {
        await sleepingDen();
        botReply = await message
            .reply({
            content: messageContent,
            embeds: [...embedArray, embed],
            components: [sleepingDenButtons],
            failIfNotExists: false,
        })
            .catch((error) => { throw new Error(error); });
    }
    else if (chosenRegion === 'food den') {
        await foodDen();
        botReply = await message
            .reply({
            content: messageContent,
            embeds: [...embedArray, embed],
            components: [foodDenButtons],
            failIfNotExists: false,
        })
            .catch((error) => { throw new Error(error); });
    }
    else if (chosenRegion === 'medicine den') {
        await medicineDen();
        botReply = await message
            .reply({
            content: messageContent,
            embeds: [...embedArray, embed],
            components: profileData.rank === 'Youngling' || profileData.rank === 'Hunter' ? [] : [medicineDenButtons],
            failIfNotExists: false,
        })
            .catch((error) => { throw new Error(error); });
    }
    else if (chosenRegion === 'ruins') {
        await ruins();
        botReply = await message
            .reply({
            content: messageContent,
            embeds: [...embedArray, embed],
            failIfNotExists: false,
        })
            .catch((error) => { throw new Error(error); });
    }
    else if (chosenRegion === 'lake') {
        await lake();
        botReply = await message
            .reply({
            content: messageContent,
            embeds: [...embedArray, embed],
            components: [lakeButtons],
            failIfNotExists: false,
        })
            .catch((error) => { throw new Error(error); });
    }
    else if (chosenRegion === 'prairie') {
        await prairie();
        botReply = await message
            .reply({
            content: messageContent,
            embeds: [...embedArray, embed],
            components: profileData.rank === 'Youngling' || profileData.rank === 'Apprentice' ? [prairieButtons] : [],
            failIfNotExists: false,
        })
            .catch((error) => { throw new Error(error); });
    }
    else {
        botReply = await message
            .reply({
            content: messageContent,
            embeds: [...embedArray, embed],
            components: [travelComponent],
            failIfNotExists: false,
        })
            .catch((error) => { throw new Error(error); });
    }
    createCommandCollector(message.author.id, message.guild.id, botReply);
    interactionCollector();
    async function interactionCollector() {
        const filter = (/** @type {import('discord.js').MessageComponentInteraction} */ i) => i.user.id == message.author.id;
        /** @type {import('discord.js').MessageComponentInteraction | null} } */
        const interaction = await botReply
            .awaitMessageComponent({ filter, time: 120_000 })
            .catch(() => { return null; });
        if (interaction === null) {
            return await botReply
                .edit({
                components: disableAllComponents(botReply.components),
            })
                .catch((error) => {
                if (error.httpStatus !== 404) {
                    throw new Error(error);
                }
            });
        }
        if (interaction.isSelectMenu()) {
            if (interaction.values[0] === 'sleeping_dens') {
                await sleepingDen();
                await /** @type {import('discord.js').Message} */ (interaction.message)
                    .edit({
                    embeds: [...embedArray, embed],
                    components: [travelComponent, sleepingDenButtons],
                })
                    .catch((error) => {
                    if (error.httpStatus !== 404) {
                        throw new Error(error);
                    }
                });
            }
            if (interaction.values[0] === 'food_den') {
                await foodDen();
                await /** @type {import('discord.js').Message} */ (interaction.message)
                    .edit({
                    embeds: [...embedArray, embed],
                    components: [travelComponent, foodDenButtons],
                })
                    .catch((error) => {
                    if (error.httpStatus !== 404) {
                        throw new Error(error);
                    }
                });
            }
            if (interaction.values[0] === 'medicine_den') {
                await medicineDen();
                await /** @type {import('discord.js').Message} */ (interaction.message)
                    .edit({
                    embeds: [...embedArray, embed],
                    components: [travelComponent, ...profileData.rank === 'Youngling' || profileData.rank === 'Hunter' ? [] : [medicineDenButtons]],
                })
                    .catch((error) => {
                    if (error.httpStatus !== 404) {
                        throw new Error(error);
                    }
                });
            }
            if (interaction.values[0] === 'ruins') {
                await ruins();
                await /** @type {import('discord.js').Message} */ (interaction.message)
                    .edit({
                    embeds: [...embedArray, embed],
                    components: [travelComponent],
                })
                    .catch((error) => {
                    if (error.httpStatus !== 404) {
                        throw new Error(error);
                    }
                });
            }
            if (interaction.values[0] === 'lake') {
                await lake();
                await /** @type {import('discord.js').Message} */ (interaction.message)
                    .edit({
                    embeds: [...embedArray, embed],
                    components: [travelComponent, lakeButtons],
                })
                    .catch((error) => {
                    if (error.httpStatus !== 404) {
                        throw new Error(error);
                    }
                });
            }
            if (interaction.values[0] == 'prairie') {
                await prairie();
                await /** @type {import('discord.js').Message} */ (interaction.message)
                    .edit({
                    embeds: [...embedArray, embed],
                    components: [travelComponent, ...profileData.rank === 'Youngling' || profileData.rank === 'Apprentice' ? [prairieButtons] : []],
                })
                    .catch((error) => {
                    if (error.httpStatus !== 404) {
                        throw new Error(error);
                    }
                });
            }
        }
        if (interaction.isButton()) {
            if (interaction.customId.includes('execute')) {
                await /** @type {import('discord.js').Message} */ (interaction.message)
                    .delete()
                    .catch((error) => {
                    if (error.httpStatus !== 404) {
                        throw new Error(error);
                    }
                });
                message.content = `${prefix}${interaction.customId.split('-').pop()}`;
                return await execute(client, message);
            }
        }
        return await interactionCollector();
    }
    async function sleepingDen() {
        await profileModel.findOneAndUpdate({ userId: message.author.id }, (/** @type {import('../../typedef').ProfileSchema} */ p) => {
            // @ts-ignore, since message is safe to be in guild
            p.characters[p.currentCharacter[message.guildId]].profiles[message.guildId].currentRegion = 'sleeping dens';
        });
        embed.description = `*${characterData.name} slowly trots to the sleeping dens, tired from all the hard work ${pronoun(characterData, 0)} did. For a moment, the ${characterData.displayedSpecies || characterData.species} thinks about if ${pronounAndPlural(characterData, 0, 'want')} to rest or just a break.*`;
        embed.fields = [];
    }
    async function foodDen() {
        await profileModel.findOneAndUpdate({ userId: message.author.id }, (/** @type {import('../../typedef').ProfileSchema} */ p) => {
            // @ts-ignore, since message is safe to be in guild
            p.characters[p.currentCharacter[message.guildId]].profiles[message.guildId].currentRegion = 'food den';
        });
        embed.description = `*${characterData.name} runs to the food den. Maybe ${pronoun(characterData, 0)} will eat something, or put ${pronoun(characterData, 2)} food onto the pile.*`;
        embed.fields = [];
        /* Finding all users that have a character that is at the food den in the guild, mapping them to
        a mention and returning the first 44 items. More than 44 users would exceed the field limit of 1024 characters. */
        const allFoodDenUsersList = /** @type {Array<import('../../typedef').ProfileSchema>} */ (await profileModel.find((/** @type {import('../../typedef').ProfileSchema} */ p) => {
            // @ts-ignore, since message is safe to be in guild
            return Object.values(p.characters).filter(c => c.profiles[message.guildId] !== undefined && c.profiles[message.guildId].currentRegion === 'food den').length > 0;
        })).map(user => `<@${user.userId}>`).slice(0, 45);
        if (allFoodDenUsersList.length > 0) {
            embed.addField('Packmates at the food den:', allFoodDenUsersList.join('\n'));
        }
    }
    async function medicineDen() {
        await profileModel.findOneAndUpdate({ userId: message.author.id }, (/** @type {import('../../typedef').ProfileSchema} */ p) => {
            // @ts-ignore, since message is safe to be in guild
            p.characters[p.currentCharacter[message.guildId]].profiles[message.guildId].currentRegion = 'medicine den';
        });
        embed.description = `*${characterData.name} rushes over to the medicine den. Nearby are a mix of packmates, some with illnesses and injuries, others trying to heal them.*`;
        embed.fields = [];
        /* Finding all users that have a character that is at the medicine den in the guild, mapping them to
        a mention and returning the first 44 items. More than 44 users would exceed the field limit of 1024 characters. */
        const allMedicineDenUsersList = /** @type {Array<import('../../typedef').ProfileSchema>} */ (await profileModel.find((/** @type {import('../../typedef').ProfileSchema} */ p) => {
            // @ts-ignore, since message is safe to be in guild
            return Object.values(p.characters).filter(c => c.profiles[message.guildId] !== undefined && c.profiles[message.guildId].currentRegion === 'medicine den').length > 0;
        })).map(user => `<@${user.userId}>`).slice(0, 45);
        if (allMedicineDenUsersList.length > 0) {
            embed.fields.push({ name: 'Packmates at the medicine den:', value: allMedicineDenUsersList.join('\n'), inline: true });
        }
        /* Finding all users that have a character that is not a Youngling in the guild, mapping them to
        a mention and returning the first 44 items. More than 44 users would exceed the field limit of 1024 characters. */
        const allHealerUsersList = /** @type {Array<import('../../typedef').ProfileSchema>} */ (await profileModel.find((/** @type {import('../../typedef').ProfileSchema} */ p) => {
            // @ts-ignore, since message is safe to be in guild
            return Object.values(p.characters).filter(c => c.profiles[message.guildId] !== undefined && c.profiles[message.guildId].rank !== 'Youngling').length > 0;
        })).map(user => `<@${user.userId}>`).slice(0, 45);
        if (allHealerUsersList.length > 0) {
            embed.fields.push({ name: 'Packmates that can heal:', value: allHealerUsersList.join('\n'), inline: true });
        }
    }
    async function ruins() {
        await profileModel.findOneAndUpdate({ userId: message.author.id }, (/** @type {import('../../typedef').ProfileSchema} */ p) => {
            // @ts-ignore, since message is safe to be in guild
            p.characters[p.currentCharacter[message.guildId]].profiles[message.guildId].currentRegion = 'ruins';
        });
        embed.description = `*${characterData.name} walks up to the ruins, carefully stepping over broken bricks. Hopefully, ${pronoun(characterData, 0)} will find someone to talk with.*`;
        embed.fields = [];
        /* Finding all users that have a character that is at the ruins in the guild, mapping them to
        a mention and returning the first 44 items. More than 44 users would exceed the field limit of 1024 characters. */
        const allRuinUsersList = /** @type {Array<import('../../typedef').ProfileSchema>} */ (await profileModel.find((/** @type {import('../../typedef').ProfileSchema} */ p) => {
            // @ts-ignore, since message is safe to be in guild
            return Object.values(p.characters).filter(c => c.profiles[message.guildId] !== undefined && c.profiles[message.guildId].currentRegion === 'ruins').length > 0;
        })).map(user => `<@${user.userId}>`).slice(0, 45);
        if (allRuinUsersList.length > 0) {
            embed.addField('Packmates at the ruins:', allRuinUsersList.join('\n'));
        }
    }
    async function lake() {
        await profileModel.findOneAndUpdate({ userId: message.author.id }, (/** @type {import('../../typedef').ProfileSchema} */ p) => {
            // @ts-ignore, since message is safe to be in guild
            p.characters[p.currentCharacter[message.guildId]].profiles[message.guildId].currentRegion = 'lake';
        });
        embed.description = `*${characterData.name} looks at ${pronoun(characterData, 2)} reflection as ${pronounAndPlural(characterData, 0, 'passes', 'pass')} the lake. Suddenly the ${characterData.displayedSpecies || characterData.species} remembers how long ${pronounAndPlural(characterData, 0, 'has', 'have')}n't drunk anything.*`;
        embed.fields = [];
    }
    async function prairie() {
        await profileModel.findOneAndUpdate({ userId: message.author.id }, (/** @type {import('../../typedef').ProfileSchema} */ p) => {
            // @ts-ignore, since message is safe to be in guild
            p.characters[p.currentCharacter[message.guildId]].profiles[message.guildId].currentRegion = 'prairie';
        });
        embed.description = `*${characterData.name} approaches the prairie, watching younger packmates testing their strength in playful fights. Maybe the ${characterData.displayedSpecies || characterData.species} could play with them!*`;
        embed.fields = [];
        /* Finding all users that have a character that is at the prairie in the guild, mapping them to
        a mention and returning the first 44 items. More than 44 users would exceed the field limit of 1024 characters. */
        const allPrairieUsersList = /** @type {Array<import('../../typedef').ProfileSchema>} */ (await profileModel.find((/** @type {import('../../typedef').ProfileSchema} */ p) => {
            // @ts-ignore, since message is safe to be in guild
            return Object.values(p.characters).filter(c => c.profiles[message.guildId] !== undefined && c.profiles[message.guildId].currentRegion === 'prairie').length > 0;
        })).map(user => `<@${user.userId}>`).slice(0, 45);
        if (allPrairieUsersList.length > 0) {
            embed.addField('Packmates at the prairie:', allPrairieUsersList.join('\n'));
        }
    }
};
