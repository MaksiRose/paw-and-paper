// @ts-check
const { MessageEmbed, MessageActionRow, MessageSelectMenu, MessageButton } = require('discord.js');
const { profileModel, otherProfileModel } = require('../../models/profileModel');
const { error_color, default_color } = require('../../config.json');
const serverModel = require('../../models/serverModel');
const { createCommandCollector } = require('../../utils/commandCollector');
const disableAllComponents = require('../../utils/disableAllComponents');
const { commonPlantsMap, uncommonPlantsMap, rarePlantsMap, speciesMap } = require('../../utils/itemsInfo');
const { checkRankRequirements, checkLevelRequirements } = require('../../utils/checkRoleRequirements');

module.exports.name = 'copy';
module.exports.aliases = ['duplicate'];

/**
 *
 * @param {import('../../paw').client} client
 * @param {import('discord.js').Message} message
 * @param {Array<string>} argumentsArray
 * @param {import('../../typedef').ProfileSchema} profileData
 * @param {import('../../typedef').ServerSchema} serverData
 * @returns {Promise<void>}
 */
module.exports.sendMessage = async (client, message, argumentsArray, profileData, serverData) => {

	const allAccounts = [
		.../** @type {Array<import('../../typedef').ProfileSchema>} */ (await profileModel.find({ userId: message.author.id, serverId: { $nin: [message.guild.id] } })),
		.../** @type {Array<import('../../typedef').ProfileSchema>} */ (await otherProfileModel.find({ userId: message.author.id, serverId: { $nin: [message.guild.id] } })),
	];
	const allServers = /** @type {Array<import('../../typedef').ServerSchema>} */ (await Promise.all([...new Set(allAccounts.map(p => p.serverId))].map(async serverId => serverModel.findOne({ serverId: serverId }))));

	/* Checking if the user has any accounts outside of this server, and if they don't, it sends a message saying that they don't
	have any accounts. */
	if (allAccounts.length === 0) {

		await message
			.reply({
				embeds: [ new MessageEmbed({
					color: /** @type {`#${string}`} */ (error_color),
					author: { name: message.guild.name, icon_url: message.guild.iconURL() },
					title: 'You have no accounts (or none outside of this server) to copy!',
				})],
				failIfNotExists: false,
			})
			.catch((error) => {
				if (error.httpStatus !== 404) { throw new Error(error); }
			});
		return;
	}

	/* Checking if the profileData is null. If it is, it will send a message to the user saying that they
	need to use the command rp accounts to switch to an empty slot before copying another account. */
	if (profileData !== null) {

		await message
			.reply({
				embeds: [ new MessageEmbed({
					color: /** @type {`#${string}`} */ (error_color),
					author: { name: message.guild.name, icon_url: message.guild.iconURL() },
					description: 'Please use `rp accounts` to switch to an empty slot before copying another account.',
				})],
				failIfNotExists: false,
			})
			.catch((error) => {
				if (error.httpStatus !== 404) { throw new Error(error); }
			});
		return;
	}

	let copyPage = 0;
	let botReply = await message
		.reply({
			embeds: [ new MessageEmbed({
				color: /** @type {`#${string}`} */ (default_color),
				title: 'Please select the profile that you want to copy.',
				description: 'Copying a profile means that all the general information like name, avatar, description, pronouns, color etc. get copied over. Server-specific information like stats, levels, inventory, wounds etc. stays separate.',
			})],
			components: [new MessageActionRow({
				components: [getAccountsPage(copyPage, allAccounts, allServers)],
			})],
			failIfNotExists: false,
		})
		.catch((error) => { throw new Error(error); });

	createCommandCollector(message.author.id, message.guild.id, botReply);

	interactionCollector();

	async function interactionCollector() {

		const filter = (/** @type {import('discord.js').MessageComponentInteraction} */ i) => i.customId.includes('copy') && i.user.id == message.author.id;

		await botReply
			.awaitMessageComponent({ filter, time: 120_000 })
			.then(async interaction => {

				/* It's checking if the user clicked on the "Show more profiles" button, and if they did, it
				increases the page number by 1, and if the page number is greater than the total number of
				pages, it sets it back to 0. Then it edits the message to show the next page of profiles. */
				if (interaction.isSelectMenu() && interaction.values[0] === 'copy-page') {

					copyPage++;
					if (copyPage >= Math.ceil(allAccounts.length / 24)) {

						copyPage = 0;
					}

					botReply = await botReply
						.edit({
							components: [botReply.components[0], new MessageActionRow({
								components: [getAccountsPage(copyPage, allAccounts, allServers)],
							})],
						})
						.catch((error) => { throw new Error(error); });

					await interactionCollector();
					return;
				}

				/* Checking if the user has selected a profile to copy and if the user has a profile with the
				same name as the one they are trying to create.
				If it does, it will copy the profile and ask the user if they want to link the profiles. */
				if (interaction.isSelectMenu() && allAccounts.map(p => p.uuid).includes(interaction.values[0].replace('copy_', ''))) {

					profileData = allAccounts.filter(p => p.uuid === interaction.values[0].replace('copy_', ''))[0];

					const thisServerUserProfiles = [
						.../** @type {Array<import('../../typedef').ProfileSchema>} */ (await profileModel.find({ userId: message.author.id, serverId: message.guild.id })),
						.../** @type {Array<import('../../typedef').ProfileSchema>} */ (await otherProfileModel.find({ userId: message.author.id, serverId: message.guild.id })),
					];

					/* Checking if the user has a profile with the same name as the one they are trying to create. */
					if (thisServerUserProfiles.map(p => p.name).includes(profileData.name)) {

						await botReply
							.edit({
								embeds: [ new MessageEmbed({
									color: /** @type {`#${string}`} */ (error_color),
									author: { name: message.guild.name, icon_url: message.guild.iconURL() },
									title: 'You cannot have two accounts in one server with the same name.',
								})],
								components: disableAllComponents(botReply.components),
							})
							.catch((error) => {
								if (error.httpStatus !== 404) { throw new Error(error); }
							});
						return;
					}

					profileData = /** @type {import('../../typedef').ProfileSchema} */ (await profileModel.create({
						userId: message.author.id,
						serverId: message.guild.id,
						name: profileData.name,
						description: profileData.description,
						color: profileData.color,
						species: '',
						rank: 'Youngling',
						avatarURL: profileData.avatarURL,
						levels: 1,
						experience: 0,
						health: 100,
						energy: 100,
						hunger: 100,
						thirst: 100,
						maxHealth: 100,
						maxEnergy: 100,
						maxHunger: 100,
						maxThirst: 100,
						isResting: false,
						hasCooldown: false,
						hasQuest: false,
						currentRegion: 'sleeping dens',
						unlockedRanks: 0,
						saplingObject: { exists: false, health: 50, waterCycles: 0, nextWaterTimestamp: null, reminder: false },
						pronounSets: profileData.pronounSets,
						injuryObject: { wounds: 0, infections: 0, cold: false, sprains: 0, poison: false },
						inventoryObject: {
							commonPlants: Object.fromEntries([...commonPlantsMap.keys()].sort().map(key => [key, 0])),
							uncommonPlants: Object.fromEntries([...uncommonPlantsMap.keys()].sort().map(key => [key, 0])),
							rarePlants: Object.fromEntries([...rarePlantsMap.keys()].sort().map(key => [key, 0])),
							meat: Object.fromEntries([...speciesMap.keys()].sort().map(key => [key, 0])),
						},
						advice: { resting: false, drinking: false, eating: false, passingout: false },
						roles: [],
						linkedTo: null,
					}));

					botReply = await botReply
						.edit({
							embeds: [new MessageEmbed({
								color: /** @type {`#${string}`} */ (default_color),
								title: `Successfully copied the profile "${profileData.name}" of the server "${allServers.find(s => s.serverId === allAccounts.find(p => p.uuid === interaction.values[0].replace('copy_', '')).serverId).name}"! Do you want to link the profiles as well?`,
								description: 'Linking two profiles means that changing general information like name, avatar, description, pronouns, color etc. on one profile will also change it on all the other linked profiles. You can always unlink the profiles later using `rp link destroy`.',
								footer: { text: 'DISCLAIMER: The species will not be linked. This means that if the species don\'t match up, information such as descriptions, avatars etc. may not make sense if they are specific to one species.' },
							})],
							components: [...disableAllComponents([botReply.components[0]]), new MessageActionRow({
								components: [new MessageButton({
									customId: `copy-confirm_${interaction.values[0].replace('copy_', '')}`,
									label: 'Link the profiles',
									emoji: '✔',
									style: 'SUCCESS',
								}), new MessageButton({
									customId: 'copy-cancel',
									label: 'Continue without linking',
									emoji: '✖',
									style: 'SECONDARY',
								})],
							})],
						})
						.catch((error) => { throw new Error(error); });

					await checkRankRequirements(serverData, message, message.member, 'Youngling');
					await checkLevelRequirements(serverData, message, message.member, 1);

					await interactionCollector();
					return;
				}

				/* Checking if the interaction is a button and if the customId includes 'copy-confirm'. If it does,
				it will update the profileData to the linkedTo value of the UUID.
				It will then edit the botReply to a success message. */
				if (interaction.isButton() && interaction.customId.includes('copy-confirm')) {

					profileData = /** @type {import('../../typedef').ProfileSchema} */ (await profileModel.findOneAndUpdate(
						{ uuid: profileData.uuid },
						{ $set: { linkedTo: interaction.customId.replace('copy-confirm_', '') } },
					));

					botReply = await botReply
						.edit({
							embeds: [new MessageEmbed({
								color: /** @type {`#${string}`} */ (default_color),
								title: `Successfully linked this profile to the profile "${profileData.name}" of the server "${allServers.find(s => s.serverId === allAccounts.find(p => p.uuid === interaction.customId.replace('copy-confirm_', '')).serverId).name}"!`,
								description: 'You can unlink the profiles later using `rp link destroy`.',
							})],
							components: disableAllComponents(botReply.components),
						})
						.catch((error) => { throw new Error(error); });
				}

				/* Disabling all components in the bot reply. */
				if (interaction.isButton() && interaction.customId === 'copy-cancel') {

					botReply = await botReply
						.edit({
							components: disableAllComponents(botReply.components),
						})
						.catch((error) => { throw new Error(error); });
				}

			})
			.catch(async () => {

				await botReply
					.edit({
						components: disableAllComponents(botReply.components),
					})
					.catch((error) => {
						if (error.httpStatus !== 404) { throw new Error(error); }
					});
				return;
			});
	}
};

/**
 * It takes in a page number, a list of all accounts, and a list of all servers, and returns a
 * MessageSelectMenu with all the profiles on that page
 * @param {number} copyPage - The page number of the accounts menu.
 * @param {Array<import('../../typedef').ProfileSchema>} allAccounts - An array of all the accounts of the user
 * @param {Array<import('../../typedef').ServerSchema>} allServers - An array of all servers that the user is in.
 * @returns A message select menu with the options of all the profiles.
 */
function getAccountsPage(copyPage, allAccounts, allServers) {

	const accountsMenu = new MessageSelectMenu({
		customId: 'copy-options',
		placeholder: 'Select a profile',
	});

	for (const profile of allAccounts) {

		accountsMenu.addOptions({ label: `${profile.name} ${`(${allServers.find(s => s.serverId === profile.serverId)?.name})` || ''}`, value: `copy_${profile.uuid}` });
	}

	if (accountsMenu.options.length > 25) {

		accountsMenu.options = accountsMenu.options.splice(copyPage * 24, (copyPage + 1) * 24);
		accountsMenu.addOptions({ label: 'Show more profiles', value: 'copy-page', description: `You are currently on page ${copyPage + 1}`, emoji: '📋' });
	}

	return accountsMenu;
}