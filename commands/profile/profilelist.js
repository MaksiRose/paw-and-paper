// @ts-check
const { profileModel } = require('../../models/profileModel');
const { default_color } = require('../../config.json');
const { hasNotCompletedAccount } = require('../../utils/checkAccountCompletion');
const startCooldown = require('../../utils/startCooldown');
const { MessageActionRow, MessageSelectMenu, MessageButton } = require('discord.js');
const disableAllComponents = require('../../utils/disableAllComponents');

module.exports.name = 'profilelist';

/**
 *
 * @param {import('../../paw').client} client
 * @param {import('discord.js').Message} message
 * @param {Array<string>} argumentsArray
 * @param {import('../../typedef').ProfileSchema} profileData
 * @returns {Promise<void>}
 */
module.exports.sendMessage = async (client, message, argumentsArray, profileData) => {

	if (await hasNotCompletedAccount(message, profileData)) {

		return;
	}

	profileData = await startCooldown(message, profileData);

	const profilelistRankComponent = new MessageActionRow({
		components: [ new MessageSelectMenu({
			customId: 'profilelist-rank',
			placeholder: 'Select a rank',
			options: [
				{ label: 'Younglings', value: 'profilelist-younglings' },
				{ label: 'Apprentices', value: 'profilelist-apprentices' },
				{ label: 'Hunters/Healers', value: 'profilelist-huntershealers' },
				{ label: 'Elderlies', value: 'profilelist-elderlies' },
			],
		})],
	});

	const profilelistPageComponent = new MessageActionRow({
		components: [ new MessageButton({
			customId: 'profilelist-left',
			emoji: '⬅️',
			style: 'SECONDARY',
		}), new MessageButton({
			customId: 'profilelist-right',
			emoji: '➡️',
			style: 'SECONDARY',
		})],
	});

	let rankProfilesPages = await getRank('Youngling');

	let pageNumber = 0;
	let botReply = await message
		.reply({
			embeds: [{
				color: /** @type {`#${string}`} */ (default_color),
				author: { name: message.guild.name, icon_url: message.guild.iconURL() },
				title: 'Profiles - Younglings',
				description: rankProfilesPages[pageNumber],
			}],
			components: [profilelistRankComponent, ...rankProfilesPages.length > 1 ? [profilelistPageComponent] : []],
			failIfNotExists: false,
		})
		.catch((error) => { throw new Error(error); });

	interactionCollector();

	async function interactionCollector() {

		const filter = (/** @type {import('discord.js').MessageComponentInteraction} */ i) => i.customId.includes('profilelist') && i.user.id == message.author.id;

		/** @type {import('discord.js').MessageComponentInteraction | null} */
		const interaction = await botReply
			.awaitMessageComponent({ filter, time: 120000 })
			.catch(async () => { return null; });

		if (interaction === null) {

			await botReply
				.edit({
					components: disableAllComponents(botReply.components),
				})
				.catch((error) => {
					if (error.httpStatus !== 404) { throw new Error(error); }
				});
			return;
		}

		if (interaction.isSelectMenu() && interaction.customId === 'profilelist-rank') {

			const rankName = (interaction.values[0] === 'profilelist-elderlies') ? 'Elderly' : (interaction.values[0] === 'profilelist-huntershealers') ? /** @type { {$or: Array<'Hunter' | 'Healer'>} } */ ({ $or: ['Hunter', 'Healer'] }) : (interaction.values[0] === 'profilelist-apprentices') ? 'Apprentice' : 'Youngling';

			rankProfilesPages = await getRank(rankName);

			botReply.components = [profilelistRankComponent, ...rankProfilesPages.length > 1 ? [profilelistPageComponent] : []];

			pageNumber = 0;
			botReply.embeds[0].title = `Profiles - ${interaction.component.options.find(element => element.value == interaction.values[0]).label}`;
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
				if (error.httpStatus !== 404) { throw new Error(error); }
				return botReply;
			});

		interactionCollector();
	}

	/**
	 * Finds all the users of a given rank and returns an array of strings, each being a "page" of 25 users with their profile name and a mention of their Discord account.
	 * @param {'Youngling' | 'Elderly' | 'Apprentice' | {$or: Array<'Hunter' | 'Healer'>} } rankName
	 * @returns {Promise<Array<string>>}
	 */
	async function getRank(rankName) {

		const allRankProfilesArray = /** @type {Array<import('../../typedef').ProfileSchema>} */ (await profileModel
			.find({
				serverId: message.guild.id,
				rank: rankName,
			}))
			.sort((a, b) => (a.name.toUpperCase() < b.name.toUpperCase()) ? -1 : (a.name.toUpperCase() > b.name.toUpperCase()) ? 1 : 0)
			.map(doc => `${doc.name} - <@${doc.userId}>`);

		/** @type {Array<string>} */
		const allRankProfilesPages = [];

		while (allRankProfilesArray.length) {

			allRankProfilesPages.push(allRankProfilesArray.splice(0, 25).join('\n'));
		}

		return allRankProfilesPages;
	}
};