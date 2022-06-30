"use strict";
// @ts-check
const profileModel = require('../../models/profileModel');
const { default_color } = require('../../../config.json');
const { MessageActionRow, MessageSelectMenu, MessageButton, MessageEmbed } = require('discord.js');
const disableAllComponents = require('../../utils/disableAllComponents');
const isInGuild = require('../../utils/isInGuild');
module.exports.name = 'profilelist';
/**
 *
 * @param {import('../../paw').client} client
 * @param {import('discord.js').Message} message
 * @returns {Promise<void>}
 */
module.exports.sendMessage = async (client, message) => {
    if (!isInGuild(message)) {
        return;
    }
    await message.guild.members
        .fetch()
        .catch((error) => { throw new Error(error); });
    const profilelistRankComponent = new MessageActionRow().addComponents([new MessageSelectMenu({
            customId: 'profilelist-rank',
            placeholder: 'Select a rank',
            options: [
                { label: 'Younglings', value: 'profilelist-younglings' },
                { label: 'Apprentices', value: 'profilelist-apprentices' },
                { label: 'Hunters/Healers', value: 'profilelist-huntershealers' },
                { label: 'Elderlies', value: 'profilelist-elderlies' },
            ],
        })]);
    const profilelistPageComponent = new MessageActionRow().addComponents([new MessageButton({
            customId: 'profilelist-left',
            emoji: '⬅️',
            style: 'SECONDARY',
        }), new MessageButton({
            customId: 'profilelist-right',
            emoji: '➡️',
            style: 'SECONDARY',
        })]);
    let rankProfilesPages = await getRank('Youngling');
    let pageNumber = 0;
    let botReply = await message
        .reply({
        embeds: [new MessageEmbed({
                color: /** @type {`#${string}`} */ (default_color),
                author: { name: message.guild.name, icon_url: message.guild.iconURL() || undefined },
                title: 'Profiles - Younglings',
                description: rankProfilesPages[pageNumber],
            })],
        components: [profilelistRankComponent, ...rankProfilesPages.length > 1 ? [profilelistPageComponent] : []],
        failIfNotExists: false,
    })
        .catch((error) => { throw new Error(error); });
    interactionCollector();
    async function interactionCollector() {
        const filter = (/** @type {import('discord.js').MessageComponentInteraction} */ i) => i.customId.includes('profilelist') && i.user.id == message.author.id;
        /** @type {import('discord.js').MessageComponentInteraction | null} */
        await botReply
            .awaitMessageComponent({ filter, time: 120_000 })
            .then(async (interaction) => {
            if (interaction.inCachedGuild() && interaction.isSelectMenu() && interaction.customId === 'profilelist-rank') {
                const rankName = (interaction.values[0] === 'profilelist-elderlies') ? 'Elderly' : (interaction.values[0] === 'profilelist-huntershealers') ? 'Hunter' : (interaction.values[0] === 'profilelist-apprentices') ? 'Apprentice' : 'Youngling';
                rankProfilesPages = await getRank(rankName, (interaction.values[0] === 'profilelist-huntershealers') ? 'Healer' : undefined);
                botReply.components = [profilelistRankComponent, ...rankProfilesPages.length > 1 ? [profilelistPageComponent] : []];
                pageNumber = 0;
                botReply.embeds[0].title = `Profiles - ${interaction.component.options.find(element => element.value == interaction.values[0])?.label}`;
                botReply.embeds[0].description = rankProfilesPages[pageNumber];
            }
            if (interaction.customId === 'profilelist-left') {
                pageNumber -= 1;
                if (pageNumber < 0) {
                    pageNumber = rankProfilesPages.length - 1;
                }
                botReply.embeds[0].description = rankProfilesPages[pageNumber];
            }
            if (interaction.customId === 'profilelist-right') {
                pageNumber += 1;
                if (pageNumber >= rankProfilesPages.length) {
                    pageNumber = 0;
                }
                botReply.embeds[0].description = rankProfilesPages[pageNumber];
            }
            botReply = await botReply
                .edit({
                embeds: botReply.embeds,
                components: botReply.components,
            })
                .catch((error) => {
                if (error.httpStatus !== 404) {
                    throw new Error(error);
                }
                return botReply;
            });
            interactionCollector();
        })
            .catch(async () => {
            await botReply
                .edit({
                components: disableAllComponents(botReply.components),
            })
                .catch((error) => {
                if (error.httpStatus !== 404) {
                    throw new Error(error);
                }
            });
            return;
        });
    }
    /**
     * Finds all the users of a given rank and returns an array of strings, each being a "page" of 25 users with their profile name and a mention of their Discord account.
     * @param {'Youngling' | 'Elderly' | 'Apprentice' | 'Hunter' | 'Healer'} rankName1
     * @param {'Youngling' | 'Elderly' | 'Apprentice' | 'Hunter' | 'Healer'} [rankName2]
     * @returns {Promise<Array<string>>}
     */
    async function getRank(rankName1, rankName2) {
        const allRankProfilesArray = [];
        if (!message.inGuild()) {
            return [];
        }
        const allRankUsersList = /** @type {Array<import('../../typedef').ProfileSchema>} */ (await profileModel.find((/** @type {import('../../typedef').ProfileSchema} */ u) => {
            // @ts-ignore, since message must be in guild
            const thisServerProfiles = Object.values(u.characters).filter(c => c.profiles[message.guildId] !== undefined).map(c => c.profiles[message.guildId]);
            return thisServerProfiles.filter(p => {
                return p.rank === rankName1 || p.rank === rankName2;
            }).length > 0;
        }));
        for (const u of Object.values(allRankUsersList)) {
            if (!message.guild.members.cache.has(u.userId)) {
                continue;
            }
            for (const c of Object.values(u.characters)) {
                const p = c.profiles[message.guildId];
                if (p !== undefined && (p.rank === rankName1 || p.rank === rankName2)) {
                    allRankProfilesArray.push(`${c.name} (\`${p.health}/${p.maxHealth} HP\`) - <@${u.userId}>`);
                }
            }
        }
        /** @type {Array<string>} */
        const allRankProfilesPages = [];
        while (allRankProfilesArray.length) {
            allRankProfilesPages.push(allRankProfilesArray.splice(0, 25).join('\n'));
        }
        return allRankProfilesPages;
    }
};
