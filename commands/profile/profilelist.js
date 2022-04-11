const profileModel = require('../../models/profileModel');
const config = require('../../config.json');
const { hasNotCompletedAccount } = require('../../utils/checkAccountCompletion');
const startCooldown = require('../../utils/startCooldown');

module.exports = {
	name: 'profilelist',
	async sendMessage(client, message, argumentsArray, profileData) {

		if (await hasNotCompletedAccount(message, profileData)) {

			return;
		}

		profileData = await startCooldown(message, profileData);

		let components = [{
			type: 'ACTION_ROW',
			components: [{
				type: 'SELECT_MENU',
				customId: 'profilelist-rank',
				placeholder: 'Select a rank',
				options: [
					{ label: 'Younglings', value: 'profilelist-younglings' },
					{ label: 'Apprentices', value: 'profilelist-apprentices' },
					{ label: 'Hunters/Healers', value: 'profilelist-huntershealers' },
					{ label: 'Elderlies', value: 'profilelist-elderlies' },
				],
			}],
		}];

		let rankProfilesPages = await getRank('Youngling');

		if (rankProfilesPages.length > 1) {

			components.unshift({
				type: 'ACTION_ROW',
				components: [{
					type: 'BUTTON',
					customId: 'profilelist-left',
					emoji: { name: '⬅️' },
					style: 'SECONDARY',
				}, {
					type: 'BUTTON',
					customId: 'profilelist-right',
					emoji: { name: '➡️' },
					style: 'SECONDARY',
				}],
			});
		}

		let pageNumber = 0;
		let botReply = await message
			.reply({
				embeds: [{
					color: config.default_color,
					author: { name: message.guild.name, icon_url: message.guild.iconURL() },
					title: 'Profiles - Younglings',
					description: rankProfilesPages[pageNumber],
				}],
				components: components,
				failIfNotExists: false,
			})
			.catch((error) => { throw new Error(error); });

		components = [components.pop()];

		interactionCollector();

		async function interactionCollector() {

			const filter = i => i.customId.includes('profilelist') && i.user.id == message.author.id;

			const interaction = await botReply
				.awaitMessageComponent({ filter, time: 120000 })
				.catch(async () => {

					return await botReply
						.edit({
							components: [],
						})
						.catch((error) => {
							if (error.httpStatus !== 404) { throw new Error(error); }
						});
				});

			if (interaction.customId == 'profilelist-rank') {

				const rankName = (interaction.values[0] == 'profilelist-elderlies') ? 'Elderly' : (interaction.values[0] == 'profilelist-huntershealers') ? { $or: ['Hunter', 'Healer'] } : (interaction.values[0] == 'profilelist-apprentices') ? 'Apprentice' : 'Youngling';

				rankProfilesPages = await getRank(rankName);

				if (rankProfilesPages.length > 1) {

					components.unshift({
						type: 'ACTION_ROW',
						components: [{
							type: 'BUTTON',
							customId: 'profilelist-left',
							emoji: { name: '⬅️' },
							style: 'SECONDARY',
						}, {
							type: 'BUTTON',
							customId: 'profilelist-right',
							emoji: { name: '➡️' },
							style: 'SECONDARY',
						}],
					});
				}

				pageNumber = 0;
				botReply.embeds[0].title = `Profiles - ${interaction.component.options.find(element => element.value == interaction.values[0]).label}`;
				botReply.embeds[0].description = rankProfilesPages[pageNumber];
			}

			if (interaction.customid == 'profilelist-left') {

				pageNumber -= 1;

				if (pageNumber < 0) {

					pageNumber = rankProfilesPages.length - 1;
				}

				botReply.embeds[0].description = rankProfilesPages[pageNumber];
			}

			if (interaction.customId == 'profilelist-right') {

				pageNumber += 1;

				if (pageNumber >= rankProfilesPages.length) {

					pageNumber = 0;
				}

				botReply.embeds[0].description = rankProfilesPages[pageNumber];
			}

			botReply = await botReply
				.edit({
					embeds: botReply.embeds,
					components: components,
				})
				.catch((error) => {
					if (error.httpStatus !== 404) { throw new Error(error); }
					return botReply;
				});

			components = [components.pop()];

			interactionCollector();
		}

		async function getRank(rankName) {

			const allRankProfilesArray = (await profileModel
				.find({
					serverId: message.guild.id,
					rank: rankName,
				}))
				.sort((a, b) => (a.name.toUpperCase() < b.name.toUpperCase()) ? -1 : (a.name.toUpperCase() > b.name.toUpperCase()) ? 1 : 0)
				.map(doc => `${doc.name} - <@${doc.userId}>`);

			const allRankProfilesPages = [];

			while (allRankProfilesArray.length) {

				allRankProfilesPages.push(allRankProfilesArray.splice(0, 25).join('\n'));
			}

			return allRankProfilesPages;
		}
	},
};