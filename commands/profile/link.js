// @ts-check

const { MessageEmbed, MessageActionRow, MessageButton, MessageSelectMenu } = require('discord.js');
const { profileModel, otherProfileModel } = require('../../models/profileModel');
const serverModel = require('../../models/serverModel');
const { error_color, default_color } = require('../../config.json');
const disableAllComponents = require('../../utils/disableAllComponents');
const { createCommandCollector } = require('../../utils/commandCollector');
const updateLinkedProfiles = require('../../utils/updateLinkedProfiles');

module.exports.name = 'link';

/**
 *
 * @param {import('../../paw').client} client
 * @param {import('discord.js').Message} message
 * @param {Array<string>} argumentsArray
 * @param {import('../../typedef').ProfileSchema} profileData
 * @returns {Promise<void>}
 */
module.exports.sendMessage = async (client, message, argumentsArray, profileData) => {

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
				embeds: [new MessageEmbed({
					color: /** @type {`#${string}`} */ (error_color),
					title: 'You have no accounts (or none outside of this server)!',
				})],
				failIfNotExists: false,
			})
			.catch((error) => {
				if (error.httpStatus !== 404) { throw new Error(error); }
			});
		return;
	}

	/** @type {'create' | 'destroy' | null} */
	const linkType = ['create', 'destroy'].includes(argumentsArray.join(' ').toLowerCase()) ? /** @type {'create' | 'destroy'} */ (argumentsArray.join(' ').toLowerCase()) : await getType();

	/* It's checking if the user didn't respond to the question, and if they didn't, it returns. */
	if (linkType === null) { return; }

	/* Checking if the linkType is create, and if it is, it checks if the profileData is null, and if it
	is, it sends a message saying that they need to switch to a non-empty slot to link that profile
	with another account. If it isn't, it will call the createLink function. */
	if (linkType === 'create') {

		/* Checking if the profile data is null, and if it is, it sends a message saying that they need to switch to a non-empty slot. */
		if (profileData === null) {

			await message
				.reply({
					embeds: [new MessageEmbed({
						color: /** @type {`#${string}`} */ (error_color),
						description: 'Please use `rp accounts` to switch to a non-empty slot to link that profile with another account.',
					})],
					failIfNotExists: false,
				})
				.catch((error) => {
					if (error.httpStatus !== 404) { throw new Error(error); }
				});
			return;
		}

		/* Checking if the account is already linked to another account. If it is, it will send a message to
		the user saying that the account is already linked to another account. */
		if (profileData.linkedTo !== '') {

			await message
				.reply({
					embeds: [new MessageEmbed({
						color: /** @type {`#${string}`} */ (error_color),
						description: 'This account is already linked to another account. Either use `rp accounts` to select another account, or use `rp link destroy` to destroy the link this account has.',
					})],
					failIfNotExists: false,
				})
				.catch((error) => {
					if (error.httpStatus !== 404) { throw new Error(error); }
				});
			return;
		}

		createLink();
	}

	/* Checking to see if the linkType is equal to destroy. If it is, it will call the destroyLink
	function. */
	if (linkType === 'destroy') { destroyLink(); }

	/**
	 * It asks the user if they want to create or destroy a link, and returns the answer
	 * @returns {Promise<'create' | 'destroy' | null>} A string
	 */
	async function getType() {

		const getLinkMessage = await message
			.reply({
				embeds: [{
					color: /** @type {`#${string}`} */ (default_color),
					title: 'Do you want to create or destroy a link?',
				}],
				components: [new MessageActionRow({
					components: [new MessageButton({
						customId: 'link-create',
						label: 'Create',
						style: 'PRIMARY',
					}), new MessageButton({
						customId: 'link-destroy',
						label: 'Destroy',
						style: 'PRIMARY',
					})],
				})],
				failIfNotExists: false,
			})
			.catch((error) => { throw new Error(error); });

		createCommandCollector(message.author.id, message.guild.id, getLinkMessage);

		const filter = (/** @type {import('discord.js').MessageComponentInteraction} */ i) => i.customId.includes('link') && i.user.id == message.author.id;

		return await getLinkMessage
			.awaitMessageComponent({ filter, time: 30_000 })
			.then(async interaction => {

				await /** @type {import('discord.js').Message} */ (interaction.message)
					.delete()
					.catch((error) => {
						if (error.httpStatus !== 404) {
							throw new Error(error);
						}
					});

				return interaction.customId.split('-')[1];
			})
			.catch(async () => {

				await getLinkMessage
					.edit({ components: disableAllComponents(getLinkMessage.components) })
					.catch((error) => {
						if (error.httpStatus !== 404) { throw new Error(error); }
					});

				return null;
			});
	}

	/**
	 * It creates a message with a list of all the user's profiles, and when the user clicks on one of
	 * them, it links the profile to the one they clicked on
	 * @returns {Promise<void>}
	 */
	async function createLink() {

		let linkPage = 0;
		let botReply = await message
			.reply({
				embeds: [ new MessageEmbed({
					color: /** @type {`#${string}`} */ (default_color),
					title: `Please select the profile that you want your current profile (${profileData.name}) to create a link to.`,
					description: 'Linking two profiles means that changing general information like name, avatar, description, pronouns, color etc. on one profile will also change it on all the other linked profiles. You can always unlink the profiles later using `rp link destroy`.',
					footer: { text: 'DISCLAIMER: The species will not be linked. This means that if the species don\'t match up, information such as descriptions, avatars etc. may not make sense if they are specific to one species.' },
				})],
				components: [new MessageActionRow({
					components: [getAccountsPage(linkPage, allAccounts, allServers)],
				})],
				failIfNotExists: false,
			})
			.catch((error) => { throw new Error(error); });

		createCommandCollector(message.author.id, message.guild.id, botReply);

		const filter = (/** @type {import('discord.js').MessageComponentInteraction} */ i) => i.customId.includes('link') && i.user.id == message.author.id;

		return await botReply
			.awaitMessageComponent({ filter, time: 120_000 })
			.then(async interaction => {

				/* It's checking if the user clicked on the "Show more profiles" button, and if they did, it
				increases the page number by 1, and if the page number is greater than the total number of
				pages, it sets it back to 0. Then it edits the message to show the next page of profiles. */
				if (interaction.isSelectMenu() && interaction.values[0] === 'link-page') {

					linkPage++;
					if (linkPage >= Math.ceil(allAccounts.length / 24)) {

						linkPage = 0;
					}

					botReply = await botReply
						.edit({
							components: [botReply.components[0], new MessageActionRow({
								components: [getAccountsPage(linkPage, allAccounts, allServers)],
							})],
						})
						.catch((error) => { throw new Error(error); });

					await createLink();
					return;
				}

				/* Checking if the user has selected a profile to link to. If they have, it will check if the user
				has a profile with the same name as the one they are trying to link to. If they do, it will send
				an error message. If they don't, it will link the profile. */
				if (interaction.isSelectMenu() && allAccounts.map(p => p.uuid).includes(interaction.values[0].replace('link_', ''))) {

					const linkedProfileData = allAccounts.filter(p => p.uuid === interaction.values[0].replace('link_', ''))[0];

					const thisServerUserProfiles = /** @type {Array<import('../../typedef').ProfileSchema>} */ (await otherProfileModel.find({ userId: message.author.id, serverId: message.guild.id }));

					/* Checking if the user has a profile with the same name as the one they are trying to create. */
					if (thisServerUserProfiles.map(p => p.name).includes(linkedProfileData.name)) {

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

					profileData = /** @type {import('../../typedef').ProfileSchema} */ (await profileModel.findOneAndUpdate(
						{ uuid: profileData.uuid },
						{
							$set: {
								name: linkedProfileData.name,
								description: linkedProfileData.description,
								color: linkedProfileData.color,
								avatarURL: linkedProfileData.avatarURL,
								pronounSets: linkedProfileData.pronounSets,
								linkedTo: linkedProfileData.uuid,
							},
						},
					));

					botReply = await botReply
						.edit({
							embeds: [new MessageEmbed({
								color: /** @type {`#${string}`} */ (default_color),
								title: `Successfully linked this profile to the profile "${profileData.name}" of the server "${allServers.find(s => s.serverId === allAccounts.find(p => p.uuid === interaction.values[0].replace('link_', '')).serverId).name}"!`,
								description: 'You can unlink the profiles later using `rp link destroy`.',
							})],
							components: disableAllComponents(botReply.components),
						})
						.catch((error) => { throw new Error(error); });

					await updateLinkedProfiles(profileData, [linkedProfileData.uuid]);
					return;
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

	/**
	 * It creates a message with a select menu that contains all the linked profiles, and when the user
	 * clicks on one of the profiles, it unlinks the profile
	 * @returns {Promise<void>}
	 */
	async function destroyLink() {

		const linkedAccounts = [
			.../** @type {Array<import('../../typedef').ProfileSchema>} */ (await profileModel.find({ userId: message.author.id, linkedTo: { $nin: [''] } })),
			.../** @type {Array<import('../../typedef').ProfileSchema>} */ (await otherProfileModel.find({ userId: message.author.id, linkedTo: { $nin: [''] } })),
		];
		const linkedServers = /** @type {Array<import('../../typedef').ServerSchema>} */ (await Promise.all([...new Set(linkedAccounts.map(p => p.serverId))].map(async serverId => serverModel.findOne({ serverId: serverId }))));

		/* Checking if the user has any linked accounts. If they do not, it will send a message saying that
		they have no accounts to destroy the link of. */
		if (linkedAccounts.length === 0) {

			await message
				.reply({
					embeds: [new MessageEmbed({
						color: /** @type {`#${string}`} */ (error_color),
						title: 'You have no accounts to destroy the link of!',
					})],
					failIfNotExists: false,
				})
				.catch((error) => {
					if (error.httpStatus !== 404) { throw new Error(error); }
				});
			return;
		}

		let linkPage = 0;
		let botReply = await message
			.reply({
				embeds: [ new MessageEmbed({
					color: /** @type {`#${string}`} */ (default_color),
					title: 'Please select the profile that you want to destroy the link of.',
				})],
				components: [new MessageActionRow({
					components: [getAccountsPage(linkPage, linkedAccounts, linkedServers)],
				})],
				failIfNotExists: false,
			})
			.catch((error) => { throw new Error(error); });

		createCommandCollector(message.author.id, message.guild.id, botReply);

		const filter = (/** @type {import('discord.js').MessageComponentInteraction} */ i) => i.customId.includes('link') && i.user.id == message.author.id;

		return await botReply
			.awaitMessageComponent({ filter, time: 120_000 })
			.then(async interaction => {

				/* It's checking if the user clicked on the "Show more profiles" button, and if they did, it
				increases the page number by 1, and if the page number is greater than the total number of
				pages, it sets it back to 0. Then it edits the message to show the next page of profiles. */
				if (interaction.isSelectMenu() && interaction.values[0] === 'link-page') {

					linkPage++;
					if (linkPage >= Math.ceil(linkedAccounts.length / 24)) {

						linkPage = 0;
					}

					botReply = await botReply
						.edit({
							components: [botReply.components[0], new MessageActionRow({
								components: [getAccountsPage(linkPage, linkedAccounts, linkedServers)],
							})],
						})
						.catch((error) => { throw new Error(error); });

					await createLink();
					return;
				}

				/* Checking if the interaction is a select menu and if the selected value is a linked account. If
				it is, it will unlink the account. */
				if (interaction.isSelectMenu() && linkedAccounts.map(p => p.uuid).includes(interaction.values[0].replace('link_', ''))) {

					const linkedProfileData = linkedAccounts.filter(p => p.uuid === interaction.values[0].replace('link_', ''))[0];
					const linkedToProfileData = allAccounts.filter(p => p.uuid === linkedProfileData.linkedTo)[0];

					/** @type {import('../../typedef').ProfileSchema} */ (await profileModel.findOneAndUpdate(
						{ uuid: linkedProfileData.uuid },
						{ $set: { linkedTo: '' } },
					));

					/** @type {import('../../typedef').ProfileSchema} */ (await otherProfileModel.findOneAndUpdate(
						{ uuid: linkedProfileData.uuid },
						{ $set: { linkedTo: '' } },
					));

					botReply = await botReply
						.edit({
							embeds: [new MessageEmbed({
								color: /** @type {`#${string}`} */ (default_color),
								title: `Successfully unlinked this profile from the profile "${linkedToProfileData.name}" of the server "${allServers.find(s => s.serverId === allAccounts.find(p => p.uuid === linkedToProfileData.uuid).serverId).name}"!`,
								description: 'You can link the profiles again later using `rp link create`.',
							})],
							components: disableAllComponents(botReply.components),
						})
						.catch((error) => { throw new Error(error); });
					return;
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
 * @param {number} page - The page number of the accounts menu.
 * @param {Array<import('../../typedef').ProfileSchema>} allAccounts - An array of all the accounts of the user
 * @param {Array<import('../../typedef').ServerSchema>} allServers - An array of all servers that the user is in.
 * @returns A message select menu with the options of all the profiles.
 */
function getAccountsPage(page, allAccounts, allServers) {

	const accountsMenu = new MessageSelectMenu({
		customId: 'link-options',
		placeholder: 'Select a profile',
	});

	for (const profile of allAccounts) {

		accountsMenu.addOptions({ label: `${profile.name} ${`(${allServers.find(s => s.serverId === profile.serverId)?.name})` || ''}`, value: `link_${profile.uuid}` });
	}

	if (accountsMenu.options.length > 25) {

		accountsMenu.options = accountsMenu.options.splice(page * 24, (page + 1) * 24);
		accountsMenu.addOptions({ label: 'Show more profiles', value: 'link-page', description: `You are currently on page ${page + 1}`, emoji: '📋' });
	}

	return accountsMenu;
}