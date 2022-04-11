// @ts-check
const { profileModel } = require('../models/profileModel');
const config = require('../config.json');
const errorHandling = require('../utils/errorHandling');
const { version } = require('../package.json');
const { commonPlantsMap, uncommonPlantsMap, rarePlantsMap, speciesMap } = require('../utils/itemsInfo');
const { execute } = require('./messageCreate');
const { sendReminder, stopReminder } = require('../commands/maintenance/water');

/**
 * @type {import('../typedef').Event}
 */
const event = {
	name: 'interactionCreate',
	once: false,

	/**
	 * Emitted when an interaction is created.
	 * @param {import('../paw').client} client
	 * @param {(import('discord.js').SelectMenuInteraction | import('discord.js').ButtonInteraction) & { message: import('discord.js').Message }} interaction
	 */
	async execute(client, interaction) {

		await interaction
			.deferUpdate()
			.catch(async (error) => {
				return await errorHandling.output(interaction.message, error);
			});

		// there are DM interactions and dont have referenced messages, so thet get processed before everything else
		if (interaction.customId == 'ticket') {

			const user = await client.users.fetch(interaction.user.id);
			const message = await user.dmChannel.messages.fetch(interaction.message.id);

			return await message
				.delete()
				.catch(async (error) => {
					if (error.httpStatus !== 404) {
						return await errorHandling.output(interaction.message, error);
					}
				});
		}

		if (!interaction.message.reference || !interaction.message.reference.messageId) {

			return;
		}

		const referencedMessage = await interaction.channel.messages
			.fetch(interaction.message.reference.messageId)
			.catch(async () => { return null; });

		if (referencedMessage && referencedMessage.author.id !== interaction.user.id) {

			return;
		}

		let profileData = /** @type {import('../typedef').ProfileSchema} */ (await profileModel.findOne({
			userId: interaction.user.id,
			serverId: interaction.guild.id,
		}));

		if (interaction.isSelectMenu()) {

			console.log(`\x1b[32m${interaction.user.tag}\x1b[0m successfully selected \x1b[33m${interaction.values[0]} \x1b[0mfrom the menu \x1b[33m${interaction.customId} \x1b[0min \x1b[32m${interaction.guild.name} \x1b[0mat \x1b[3m${new Date().toLocaleString()} \x1b[0m`);


			if (interaction.values[0] == 'help_page1') {

				return await interaction.message
					.edit({
						embeds: [{
							color: /** @type {`#${string}`} */ (config.default_color),
							title: 'Page 1: 📝 Profile Creation',
							description: 'Remember that the brackets -> [] don\'t need to be typed out. Replace the content with what you want, and leave the brackets out.',
							fields: [
								{ name: '**rp name [name]**', value: '__START YOUR ADVENTURE!__ Name your character.' },
								{ name: '**rp species [species]**', value: 'Specify the species of your character. If you don\'t specify a species, it will give you an overview of the available ones.' },
								{ name: '**rp pronouns**', value: 'Choose the pronouns you are using during roleplay.' },
								{ name: '**rp picture [attachment of the desired image]**', value: 'Choose a picture for your character.' },
								{ name: '**rp color [hex code]**', value: 'Enter a valid hex code to give your messages and profile that color.' },
								{ name: '**rp desc [description text]**', value: 'Give a more detailed description of your character.' },
								{ name: '**rp profilelist**', value: 'View a list of all the profiles that exist on this server.' },
								{ name: '**rp delete**', value: 'Delete your account and reset your data permanently.' },
							],
							footer: { text: 'ℹ️ Select a command from the list below to view more information about it.' },
						}],
						components: [interaction.message.components[0], {
							type: 'ACTION_ROW',
							components: [{
								type: 'SELECT_MENU',
								customId: 'help-page1-commands',
								placeholder: 'Select a command',
								options: [
									{ label: 'Name', value: 'help_name', description: 'START YOUR ADVENTURE! Name your character.' },
									{ label: 'Species', value: 'help_species', description: 'Specify the species of your character.' },
									{ label: 'Pronouns', value: 'help_pronouns', description: 'Choose the pronouns you are using during roleplay.' },
									{ label: 'Picture', value: 'help_picture', description: 'Choose a picture for your character.' },
									{ label: 'Color', value: 'help_color', description: 'Enter a valid hex code to give your messages and profile that color.' },
									{ label: 'Desc', value: 'help_desc', description: 'Give a more detailed description of your character.' },
									{ label: 'Profilelist', value: 'help_profilelist', description: 'View a list of all the profiles that exist on this server.' },
									{ label: 'Delete', value: 'help_delete', description: 'Delete your account and reset your data permanently.' },
								],
							}],
						}],
					})
					.catch(async (error) => {
						if (error.httpStatus !== 404) {
							throw new Error(error);
						}
					});
			}

			if (interaction.values[0] == 'help_page2') {

				return await interaction.message
					.edit({
						embeds: [{
							color: /** @type {`#${string}`} */ (config.default_color),
							title: 'Page 2: 🎲 Gameplay',
							description: 'Remember that the brackets -> [] don\'t need to be typed out. Replace the content with what you want, and leave the brackets out.',
							fields: [
								{ name: '**rp play (@user)**', value: 'The main activity of Younglings. Costs energy, but gives XP. Additionally, you can mention someone to play with them. __Only available to Younglings and Apprentices.__' },
								{ name: '**rp practice**', value: 'Practice fighting wild animals. You cannot get hurt here. __Not available to Younglings__.' },
								{ name: '**rp explore**', value: 'The main activity of every rank above Younglings. Find meat and herbs. Costs energy, but gives XP. __Not available to Younglings.__' },
								{ name: '**rp go (region)**', value: 'Go to a specific region in your pack.' },
								{ name: '**rp attack**', value: 'If humans are attacking the pack, you can fight back using this command.' },
								{ name: '**rp quest**', value: 'Get quests by playing (as Youngling) and exploring. Start them with this command. If you are successful, you can move up a rank.' },
								{ name: '**rp rank**', value: 'Once you successfully finished a quest, you can move up a rank using this command.' },
							],
							footer: { text: 'ℹ️ Select a command from the list below to view more information about it.' },
						}],
						components: [interaction.message.components[0], {
							type: 'ACTION_ROW',
							components: [{
								type: 'SELECT_MENU',
								customId: 'help-page2-commands',
								placeholder: 'Select a command',
								options: [
									{ label: 'Play', value: 'help_play', description: 'The main activity of Younglings. Costs energy, but gives XP.' },
									{ label: 'Practice', value: 'help_practice', description: 'Practice fighting wild animals. You cannot get hurt here.' },
									{ label: 'Explore', value: 'help_explore', description: 'The main activity of every rank above Younglings. Find meat and herbs. Costs energy, but gives XP.' },
									{ label: 'Go', value: 'help_go', description: 'Go to a specific region in your pack.' },
									{ label: 'Attack', value: 'help_attack', description: 'If humans are attacking the pack, you can fight back using this command.' },
									{ label: 'Quest', value: 'help_quest', description: 'Get quests by playing (as Youngling) and exploring. Start them with this command.' },
									{ label: 'Rank', value: 'help_rank', description: 'Once you successfully finished a quest, you can move up a rank using this command.' },
								],
							}],
						}],
					})
					.catch(async (error) => {
						if (error.httpStatus !== 404) {
							throw new Error(error);
						}
					});
			}

			if (interaction.values[0] == 'help_page3') {

				return await interaction.message
					.edit({
						embeds: [{
							color: /** @type {`#${string}`} */ (config.default_color),
							title: 'Page 3: 🍗 Maintenance',
							description: 'Remember that the brackets -> [] don\'t need to be typed out. Replace the content with what you want, and leave the brackets out.',
							fields: [
								{ name: '**rp profile (@user)**', value: 'Look up all the available info about a character.' },
								{ name: '**rp stats**', value: 'Quick view of your characters condition.' },
								{ name: '**rp inventory**', value: 'This is a collection of all the things your pack has gathered, listed up.' },
								{ name: '**rp store**', value: 'Take items you have gathered for your pack, and put them in the pack inventory.' },
								{ name: '**rp eat (item)**', value: 'Take the appropriate food for your species out of the packs food pile and fill up your hunger meter.' },
								{ name: '**rp drink**', value: 'Drink some water and fill up your thirst meter.' },
								{ name: '**rp rest**', value: 'Get some sleep and fill up your energy meter. Takes some time to refill.' },
								{ name: '**rp heal (@user)**', value: 'Heal your packmates. Costs energy, but gives XP. __Only available to Apprentices, Healers and Elderlies.__' },
								{ name: '**rp dispose**', value: 'Remove obstacles blocking dens. Costs energy, but gives XP. __Only available to Apprentices, Hunters and Elderlies.__' },
								{ name: '**rp water**', value: 'If you have a ginkgo sapling, you can water it using this command.' },
							],
							footer: { text: 'ℹ️ Select a command from the list below to view more information about it.' },
						}],
						components: [interaction.message.components[0], {
							type: 'ACTION_ROW',
							components: [{
								type: 'SELECT_MENU',
								customId: 'help-page3-commands',
								placeholder: 'Select a command',
								options: [
									{ label: 'Profile', value: 'help_profile', description: 'Look up all the available info about a character.' },
									{ label: 'Stats', value: 'help_stats', description: 'Quick view of your characters condition.' },
									{ label: 'Inventory', value: 'help_inventory', description: 'This is a collection of all the things your pack has gathered, listed up.' },
									{ label: 'Store', value: 'help_store', description: 'Take items you have gathered for your pack, and put them in the pack inventory.' },
									{ label: 'Eat', value: 'help_eat', description: 'Take the appropriate food for your species out of the packs food pile and fill up your hunger meter.' },
									{ label: 'Drink', value: 'help_drink', description: 'Drink some water and fill up your thirst meter.' },
									{ label: 'Rest', value: 'help_rest', description: 'Get some sleep and fill up your energy meter. Takes some time to refill.' },
									{ label: 'Heal', value: 'help_heal', description: 'Heal your packmates. Costs energy, but gives XP.' },
									{ label: 'Dispose', value: 'help_dispose', description: 'Remove obstacles blocking dens. Costs energy, but gives XP.' },
									{ label: 'Water', value: 'help_water', description: 'If you have a ginkgo sapling, you can water it using this command.' },
								],
							}],
						}],
					})
					.catch(async (error) => {
						if (error.httpStatus !== 404) {
							throw new Error(error);
						}
					});
			}

			if (interaction.values[0] == 'help_page4') {

				return await interaction.message
					.edit({
						embeds: [{
							color: /** @type {`#${string}`} */ (config.default_color),
							title: 'Page 4: 👥 Interaction',
							description: 'Remember that the brackets -> [] don\'t need to be typed out. Replace the content with what you want, and leave the brackets out.',
							fields: [
								{ name: '**rp requestvisit**', value: 'Find, visit and talk to people from far away packs.' },
								{ name: '**rp endvisit**', value: 'End a visit between your and another pack.' },
								{ name: '**rp say [text]**', value: 'Talk to your fellow packmates. Gives 1 experience point per use.' },
								{ name: '**rp hug [@user]**', value: 'Hug a fellow packmate, if they consent.' },
								{ name: '**rp share (@user)**', value: 'Mention someone to share a story or anecdote. Costs energy, but gives XP to the other person. __Only available to Elderlies.__' },
								{ name: '**rp playfight [@user] (c4 / ttt)**', value: 'Playfully fight with another packmate. You can play Connect Four or Tic Tac Toe.' },
							],
							footer: { text: 'ℹ️ Select a command from the list below to view more information about it.' },
						}],
						components: [interaction.message.components[0], {
							type: 'ACTION_ROW',
							components: [{
								type: 'SELECT_MENU',
								customId: 'help-page4-commands',
								placeholder: 'Select a command',
								options: [
									{ label: 'Requestvisit', value: 'help_requestvisit', description: 'Find, visit and talk to people from far away packs.' },
									{ label: 'Endvisit', value: 'help_endvisit', description: 'End a visit between your and another pack.' },
									{ label: 'Say', value: 'help_say', description: 'Talk to your fellow packmates. Gives 1 experience point per use.' },
									{ label: 'Hug', value: 'help_hug', description: 'Hug a fellow packmate, if they consent.' },
									{ label: 'Share', value: 'help_share', description: 'Mention someone to share a story or anecdote. Costs energy, but gives XP to the other person.' },
									{ label: 'Playfight', value: 'help_playfight', description: 'Playfully fight with another packmate. You can play Connect Four or Tic Tac Toe.' },
								],
							}],
						}],
					})
					.catch(async (error) => {
						if (error.httpStatus !== 404) {
							throw new Error(error);
						}
					});
			}

			if (interaction.values[0] == 'help_page5') {

				const maksi = await client.users
					.fetch(config.maksi)
					.catch(() => { return null; });

				const ezra = await client.users
					.fetch(config.ezra)
					.catch(() => { return null; });

				const ren = await client.users
					.fetch(config.ren)
					.catch(() => { return null; });

				const jags = await client.users
					.fetch(config.jags)
					.catch(() => { return null; });

				const elliott = await client.users
					.fetch(config.elliott)
					.catch(() => { return null; });

				await interaction.message
					.edit({
						embeds: [{
							color: /** @type {`#${string}`} */ (config.default_color),
							title: 'Page 5: ⚙️ Bot',
							description: 'Remember that the brackets -> [] don\'t need to be typed out. Replace the content with what you want, and leave the brackets out.',
							fields: [
								{ name: '**rp vote**', value: 'Vote for this bot on one of three websites and get +30 energy each time.' },
								{ name: '**rp accounts**', value: 'Change the account/profile you are using. You can have up to three per server.' },
								{ name: '**rp shop**', value: 'Buy roles with experience points.' },
								{ name: '**rp shopadd [@role] [rank/levels/XP] [requirement]**', value: '__Server admins only.__ Add a role to the shop.' },
								{ name: '**rp shopremove**', value: '__Server admins only.__ Remove a role from the shop.' },
								{ name: '**rp allowvisits [#channel/off]**', value: '__Server admins only.__ Allow or disallow visits between your and other packs.' },
								{ name: '**rp getupdates [#channel]**', value: '__Server admins only.__ Specify a channel in which updates, new features etc. should be posted.' },
								{ name: '**rp ticket [text]**', value: 'Report a bug, give feedback, suggest a feature!' },
								{ name: '\n**__CREDITS:__**', value: `This bot was made with love by ${maksi?.tag}. Special thanks goes out to ${ezra?.tag}, ${ren?.tag} and ${elliott.tag}, who did a lot of the custom bot responses, and ${jags.tag} who did the profile picture. Thank you also to everyone who tested the bot and gave feedback.\nThis bot was originally created for a Discord server called [Rushing River Pack](https://disboard.org/server/854522091328110595). If you are otherkin, therian, or supporter of those, you are welcome to join.` },
								{ name: '\n**__OTHER:__**', value: `If you want to support me, you can donate [here](https://streamlabs.com/maksirose/tip)! :)\nYou can find the GitHub repository for this project [here](https://github.com/MaksiRose/paw-and-paper).\nThe bot is currently running on version ${version}.` },
							],
							footer: { text: 'ℹ️ Select a command from the list below to view more information about it.' },
						}],
						components: [interaction.message.components[0], {
							type: 'ACTION_ROW',
							components: [{
								type: 'SELECT_MENU',
								customId: 'help-page5-commands',
								placeholder: 'Select a command',
								options: [
									{ label: 'Vote*', value: 'help_vote', description: 'Vote for this bot on one of three websites and get +30 energy each time.' },
									{ label: 'Accounts', value: 'help_accounts', description: 'Change the account/profile you are using. You can have up to three per server.' },
									{ label: 'Shop', value: 'help_shop', description: 'Buy roles with experience points.' },
									{ label: 'Shopadd', value: 'help_shopadd', description: 'Server admins only. Add a role to the shop' },
									{ label: 'Shopremove', value: 'help_shopremove', description: 'Server admins only. Remove a role from the shop.' },
									{ label: 'Allowvisits', value: 'help_allowvisits', description: 'Server admins only. Allow or disallow visits between your and other packs.' },
									{ label: 'Getupdates', value: 'help_getupdates', description: 'Server admins only. Specify a channel in which updates should be posted.' },
									{ label: 'Ticket', value: 'help_ticket', description: 'Report a bug, give feedback, suggest a feature!' },
								],
							}],
						}],
					})
					.catch(async (error) => {
						if (error.httpStatus !== 404) {
							throw new Error(error);
						}
					});
			}

			if (interaction.values[0] === 'help_name') {

				return await interaction
					.followUp({
						embeds: [{
							color: /** @type {`#${string}`} */ (config.default_color),
							title: 'rp name [name]',
							description: '__START YOUR ADVENTURE!__ Name your character.',
							fields: [
								{ name: '**Aliases**', value: 'none' },
								{ name: '**Arguments**', value: 'The name of your character.' },
								{ name: '**More information**', value: 'This will be the name displayed and used for your character during gameplay. It can be changed at any time just by retyping the command.' },
								{ name: '**Example**', value: '`rp name Max`' },
							],
						}],
						ephemeral: true,
					})
					.catch(async (error) => {
						if (error.httpStatus !== 404) {
							throw new Error(error);
						}
					});
			}

			if (interaction.values[0] === 'help_species') {

				return await interaction
					.followUp({
						embeds: [{
							color: /** @type {`#${string}`} */ (config.default_color),
							title: 'rp species (species)',
							description: 'Specify the species of your character.',
							fields: [
								{ name: '**Aliases**', value: 'none' },
								{ name: '**Arguments**', value: 'Optional: The species of your character.' },
								{ name: '**More information**', value: 'This cannot be changed later on.\nSeveral things will be unique about your experience based on which species you choose: The diet (harbivore, omnivore, carnivore) and therefore the food you can eat, the biomes you can visit and the animals you encounter.\nIf you don\'t specify a species, an overview of the available ones will be displayed to you and you can pick from a list.' },
								{ name: '**Example**', value: '`rp species wolf`\n`rp species`' },
							],
						}],
						ephemeral: true,
					})
					.catch(async (error) => {
						if (error.httpStatus !== 404) {
							throw new Error(error);
						}
					});
			}

			if (interaction.values[0] === 'help_pronouns') {

				return await interaction
					.followUp({
						embeds: [{
							color: /** @type {`#${string}`} */ (config.default_color),
							title: 'rp pronouns [none OR [subject pronoun]/[object pronoun]/[possessive adjective]/[possessive pronoun]/[reflexive pronoun]/[singular OR plural]] & (optional additional sets of pronouns)',
							description: 'Choose the pronouns you are using during roleplay.',
							fields: [
								{ name: '**Aliases**', value: 'none' },
								{ name: '**Arguments**', value: '\'None\' or subject pronoun, object pronoun, possessive adjective, possessive pronoun, reflexive pronoun and \'singular\' or \'plural\' all separated by slashes. Optional: If you want several sets of pronouns, separate the sets with an \'&\'.' },
								{ name: '**More information**', value: 'The default for this is they/them/their/theirs/themselves/plural.\nThis can be changed at any time.\nThese will be the pronouns used for your character during gameplay. If you have several sets of pronouns, they will be alternated randomly. If you choose none, pronouns will be replaced with your name. You can also choose none alongside other sets of pronouns.' },
								{ name: '**Example**', value: '`rp pronouns she/her/her/hers/herself/singular`\n`rp pronouns he/him/his/his/himself/singular`\n`rp pronouns they/them/their/theirs/themselves/plural & it/its/its/its/itself/singular`' },
							],
						}],
						ephemeral: true,
					})
					.catch(async (error) => {
						if (error.httpStatus !== 404) {
							throw new Error(error);
						}
					});
			}

			if (interaction.values[0] === 'help_picture') {

				return await interaction
					.followUp({
						embeds: [{
							color: /** @type {`#${string}`} */ (config.default_color),
							title: 'rp picture (attachment of the desired image)',
							description: 'Choose a picture for your character.',
							fields: [
								{ name: '**Aliases**', value: 'pic, pfp' },
								{ name: '**Arguments**', value: 'Optional: Upload the desired picture together with the command.' },
								{ name: '**More information**', value: 'The default for this is the user\'s profile picture. Not uploading a picture will reset the picture to the users profile picture.\nThis can be changed at any time.\nThis will be the picture displayed for your character during gameplay. Only .jp(e)g, .png and .raw images are supported, GIFs and videos don\'t work. Sending links is not supported. Square images are recommended.' },
								{ name: '**Example**', value: '`rp picture` (+ image below)' },
							],
							image: { url: 'https://cdn.discordapp.com/embed/avatars/0.png' },
						}],
						ephemeral: true,
					})
					.catch(async (error) => {
						if (error.httpStatus !== 404) {
							throw new Error(error);
						}
					});
			}

			if (interaction.values[0] === 'help_color') {

				return await interaction
					.followUp({
						embeds: [{
							color: /** @type {`#${string}`} */ (config.default_color),
							title: 'rp color [hex code]',
							description: 'Enter a valid hex code to give your messages and profile that color.',
							fields: [
								{ name: '**Aliases**', value: 'colour' },
								{ name: '**Arguments**', value: 'A hex code, either with or without the #. A hexcode consists of six digits between 0-9 and a-f.' },
								{ name: '**More information**', value: 'The default for this is the bots general default color, #9d9e51.\nThis can be changed at any time.\nThis will be the color displayed at the side of the messages during gameplay.' },
								{ name: '**Example**', value: '`rp color #05FFA1`\n`rp color edfc46`' },
							],
						}],
						ephemeral: true,
					})
					.catch(async (error) => {
						if (error.httpStatus !== 404) {
							throw new Error(error);
						}
					});
			}

			if (interaction.values[0] === 'help_desc') {

				return await interaction
					.followUp({
						embeds: [{
							color: /** @type {`#${string}`} */ (config.default_color),
							title: 'rp desc (description text)',
							description: 'Give a more detailed description of your character.',
							fields: [
								{ name: '**Aliases**', value: 'description' },
								{ name: '**Arguments**', value: 'Optional: A description text about your character' },
								{ name: '**More information**', value: 'Using this command without a description will delete the description.\nThis can be changed at any time.\nThis will be the description displayed in your profile.' },
								{ name: '**Example**', value: '`rp description A fluffy, honey-colored dog.`' },
							],
						}],
						ephemeral: true,
					})
					.catch(async (error) => {
						if (error.httpStatus !== 404) {
							throw new Error(error);
						}
					});
			}

			if (interaction.values[0] === 'help_profilelist') {

				return await interaction
					.followUp({
						embeds: [{
							color: /** @type {`#${string}`} */ (config.default_color),
							title: 'rp profilelist',
							description: 'View a list of all the profiles that exist on this server.',
							fields: [
								{ name: '**Aliases**', value: 'none' },
								{ name: '**Arguments**', value: 'none' },
								{ name: '**More information**', value: 'A list of profiles with their name and a mention of the user associated with the account is displayed. By default, Younglings are displayed, but other ranks can be chosen from a drop-down list.' },
							],
						}],
						ephemeral: true,
					})
					.catch(async (error) => {
						if (error.httpStatus !== 404) {
							throw new Error(error);
						}
					});
			}

			if (interaction.values[0] === 'help_delete') {

				return await interaction
					.followUp({
						embeds: [{
							color: /** @type {`#${string}`} */ (config.default_color),
							title: 'rp profilelist',
							description: 'Delete your account and reset your data permanently.',
							fields: [
								{ name: '**Aliases**', value: 'purge, remove, reset' },
								{ name: '**Arguments**', value: 'none' },
								{ name: '**More information**', value: 'This cannot be undone.\nThis does not affect any other profiles you might have.\nIf a user leaves a server, their account will be deleted automatically after 24 days, unless they rejoin.' },
							],
						}],
						ephemeral: true,
					})
					.catch(async (error) => {
						if (error.httpStatus !== 404) {
							throw new Error(error);
						}
					});
			}

			if (interaction.values[0] === 'help_play') {

				return await interaction
					.followUp({
						embeds: [{
							color: /** @type {`#${string}`} */ (config.default_color),
							title: 'rp play (@user)',
							description: 'The main activity of Younglings. Costs energy, but gives XP. Additionally, you can mention someone to play with them. __Only available to Younglings and Apprentices.__',
							fields: [
								{ name: '**Aliases**', value: 'none' },
								{ name: '**Arguments**', value: 'Optional: The mention of a user that you want to play with.' },
								{ name: '**More information**', value: 'This first checks if the player mentioned someone with a valid account. If so, the player will play with them. Playing with someone will give them 1-5 health.\nIf no one is mentioned and the player is a Youngling of at least level 2, they might get a quest with a 1 in 20 chance.\nIf there are other players located in the prairie, the player has a 7 in 10 chance of automatically playing with a random one.\nIf you play with someone who has a cold, you have a 3 in 10 chance to get infected.\nIf you don\'t play with anyone, with a 90 in 100 chance you will play without any special events.\nThe special events being either getting hurt (10 in 100) if you aren\'t a Youngling or finding a random common plant (90 in 100). When getting hurt, there\'s a 50/50 chance between it being a cold or a wound.\nIf you have a living ginkgo sapling, the chance of getting a special event and the chance of that special event being that you find a plant is increased by one for the amount of times you watered the sapling successfully.' },
							],
						}],
						ephemeral: true,
					})
					.catch(async (error) => {
						if (error.httpStatus !== 404) {
							throw new Error(error);
						}
					});
			}

			if (interaction.values[0] === 'help_practice') {

				return await interaction
					.followUp({
						embeds: [{
							color: /** @type {`#${string}`} */ (config.default_color),
							title: 'rp practice',
							description: 'Practice fighting wild animals. You cannot get hurt here. __Not available to Younglings__.',
							fields: [
								{ name: '**Aliases**', value: 'train' },
								{ name: '**Arguments**', value: 'none' },
								{ name: '**More information**', value: 'This command exists to practice the mechanic used when fighting wild animals while exploring as well as fighting humans when they are attacking. It can be used every 5 minutes.\nYou are presented three buttons: Attack (⏫), dodge (⏺️) and defend (↪️). Your opponent randomly selects one of them, and you have to choose which button is the correct response. The footer provides hints as to which button you should click. This is a memory game, so the goal is to remember which button to click in which situation.' },
							],
						}],
						ephemeral: true,
					})
					.catch(async (error) => {
						if (error.httpStatus !== 404) {
							throw new Error(error);
						}
					});
			}

			if (interaction.values[0] === 'help_explore') {

				return await interaction
					.followUp({
						embeds: [{
							color: /** @type {`#${string}`} */ (config.default_color),
							title: 'rp explore (biome)',
							description: 'The main activity of every rank above Younglings. Find meat and herbs. Costs energy, but gives XP. __Not available to Younglings.__',
							fields: [
								{ name: '**Aliases**', value: 'e' },
								{ name: '**Arguments**', value: 'Optional: The biome that you want to explore.' },
								{ name: '**More information**', value: 'If you don\'t choose a biome, you will be presented 1-3 buttons of possible biomes based on what rank and species you are.\nIt takes 15 seconds to find something. During that time, a grid with a pushpin (the player) and 3-5 emojis is being displayed. The emojis are randomly selected from one of 3 lists based on your habitat (cold, warm, water). The pushpin will move every 1.5 seconds in a random orthogonal direction. It will only move back if there is no other place to move.\n\nIf there are 3 or more active players in this pack in the last 5 minutes, the player will find a human attack.\nElse, with a 1 in 250 (for Apprentices), 1 in 375 (for Hunters/Healers) or 1 in 500 (Elderly) chance you find a quest.\nElse, with a 10 in 100 chance you will find a ginkgo sapling. If you already have one, you will find nothing, but the chance of finding nothing is decreased by one for the amount of times you watered your ginkgo sapling successfully.\nWith a 50/50 chance, you will find a plant or a wild animal.' },
								{ name: '**About the plant minigame**', value: 'An emoji that is to be found is pulled from a list of plant emojis. From the other plant emojis plus the aforementioned habitat-emoji list, 5 emojis will be randomly placed on 5 buttons, with emojis being able to repeat once. The emoji to find is being placed randomly on two different buttons, and a campsite emoji is also placed on one of those buttons.\nTo win, you have to press the button with the emoji to find that doesn\'t also contain the campsite emoji.\nIf you pick wrong, you have a 1 in 3 chance to be poisoned if there is an Elderly in the pack, else a 50/50 between getting a cold and geting an infection. If you win, you get a random plant. There is a 30 in 100 chance that you find something other than a common plant (except if you are in the 1st biome), and a 30 in 100 chance that that other plant is a rare plant (if you are in the 3rd biome) instead of an uncommon plant.\nThe chance of a better plant is increased by one for the amount of times you watered your ginkgo sapling successfully.' },
								{ name: '**About the wild animal minigame**', value: 'An opponent level is randomly chosen. It is between 1 and 10 (1st biome), 11 and 25 (2nd biome), or between 26 and 50 or 10 higher than your level (3rd biome). The opponents species is randomly chosen based on who your species can encounter. You are presented three buttons: Attack (⏫), dodge (⏺️) and defend (↪️). Your opponent choses one, and you have to respond based on what you memorize in the `practice` command. If you choose correct, your temporary level goes up. If you don\'t choose or choose wrong, your opponents level goes up. If you choose the same as your opponent, no one gains levels. The amount you and your opponents level goes up by is equal to your normal level divided by ten, rounded up. After three rounds, of your final scores are chosen as a random number between 0 and your respective levels. If both scores are equal or differ by one, it is a tie. If your score is higher, you get the animal\'s meat. If their score is higher, you get a wound or a sprain with a 50/50 chance.' },
								{ name: '**Example**', value: '`rp explore forest`' },
							],
						}],
						ephemeral: true,
					})
					.catch(async (error) => {
						if (error.httpStatus !== 404) {
							throw new Error(error);
						}
					});
			}

			if (interaction.values[0] === 'help_go') {

				return await interaction
					.followUp({
						embeds: [{
							color: /** @type {`#${string}`} */ (config.default_color),
							title: 'rp go (region)',
							description: 'Go to a specific region in your pack.',
							fields: [
								{ name: '**Aliases**', value: 'region' },
								{ name: '**Arguments**', value: 'Optional: The region you want to visit' },
								{ name: '**More information**', value: 'If no region is specified, you can choose from a drop-down list of the possible regions.\nThe food den, medicine den, ruins and prairie provide a list of players who are at that region.\nThe medicine den provides a list of players that can heal.\nThe sleeping dens has a button to rest.\nThe food den has buttons to view the inventory or store food away.\nThe medicine den has a button to heal.\nThe lake has a button to drink.\nThe prairie has a button to play.' },
								{ name: '**Example**', value: '`rp go medicine den`' },
							],
						}],
						ephemeral: true,
					})
					.catch(async (error) => {
						if (error.httpStatus !== 404) {
							throw new Error(error);
						}
					});
			}

			if (interaction.values[0] === 'help_attack') {

				return await interaction
					.followUp({
						embeds: [{
							color: /** @type {`#${string}`} */ (config.default_color),
							title: 'rp attack',
							description: 'If humans are attacking the pack, you can fight back using this command.',
							fields: [
								{ name: '**Aliases**', value: 'none' },
								{ name: '**Arguments**', value: 'none' },
								{ name: '**More information**', value: 'An attack event starts when someone explores while 3 or more players are active in a pack in the last 5 minutes. \nAfter 60 seconds of preparation time, the attack starts with as many humans as there are active players. This command can now be used to attack.\nThe attacks follow the same formula the `practice` command and the wild animal minigame of the `explore` command do, except it\'s 5 rounds. You gain and lose points by winning and losing rounds. You cannot go below 0 points.\nTieing has a 8 in 16 chance. The chance of winning is your total points in 16. Losing is the remaining amount in 16. When you win, the human you fought leaves. When you tie or loose, the human stays and steals some of the most posessed item. The amount stolen is equal to the available amount divided through ten, rounded. When you loose, there is a 50/50 chance between getting a wound and getting a sprain. After 5 minutes or once all humans are gone, the attack is over. Each remaining human steals one more time.' },
							],
						}],
						ephemeral: true,
					})
					.catch(async (error) => {
						if (error.httpStatus !== 404) {
							throw new Error(error);
						}
					});
			}

			if (interaction.values[0] === 'help_quest') {

				return await interaction
					.followUp({
						embeds: [{
							color: /** @type {`#${string}`} */ (config.default_color),
							title: 'rp quest',
							description: 'Get quests by playing (as Youngling) and exploring. Start them with this command. If you are successful, you can move up a rank.',
							fields: [
								{ name: '**Aliases**', value: 'none' },
								{ name: '**Arguments**', value: 'none' },
								{ name: '**More information**', value: 'The quest minigame includes three buttons of the colors blue, red and green. Each of the buttons are randomly labeled \'Blue\', \'Red\' and \'Green\'. You are asked to press a button either based on its color, or based on its text. If you press the wrong button, you lose a round. If you press the right button, you win a round if a random number between 0 and 99 is higher than the win number. The win number is calculated through a sigmoid function where if your current level is equal to the recommended level, you have a win number of 90, and if your current level is half of the recommended level, your win number is 5. The exact equation is 100/(1+e^(-5.11 * (c/0.5r - 1.58))), with c being the current level and r being the recommended level. Winning 10 times grants you the ability to rank up, losing 10 times means you have to find another quest.' },
							],
						}],
						ephemeral: true,
					})
					.catch(async (error) => {
						if (error.httpStatus !== 404) {
							throw new Error(error);
						}
					});
			}

			if (interaction.values[0] === 'help_rank') {

				return await interaction
					.followUp({
						embeds: [{
							color: /** @type {`#${string}`} */ (config.default_color),
							title: 'rp rank',
							description: 'Once you successfully finished a quest, you can move up a rank using this command.',
							fields: [
								{ name: '**Aliases**', value: 'role' },
								{ name: '**Arguments**', value: 'none' },
								{ name: '**More information**', value: 'Once you have ranked up, it is not reversable.\nWhen ranking up to Hunter/Healer, it gives you two buttons to chose a rank.' },
							],
						}],
						ephemeral: true,
					})
					.catch(async (error) => {
						if (error.httpStatus !== 404) {
							throw new Error(error);
						}
					});
			}

			if (interaction.values[0] === 'help_profile') {

				return await interaction
					.followUp({
						embeds: [{
							color: /** @type {`#${string}`} */ (config.default_color),
							title: 'rp profile (@user)',
							description: 'Look up all the available info about a character.',
							fields: [
								{ name: '**Aliases**', value: 'info, about' },
								{ name: '**Arguments**', value: 'Optional: Mention someone to get their profile instead of yours.' },
								{ name: '**More information**', value: 'This shows all the information about someone, including their name, description, avatar, species, rank, pronouns, current region, levels, XP, health, energy, hunger, thirst, injuries/illnesses, ginkgo sapling and quest status. There is a button to refresh the information at any time. If the user has items in their inventory, a "Store food away" button is displayed as well.' },
							],
						}],
						ephemeral: true,
					})
					.catch(async (error) => {
						if (error.httpStatus !== 404) {
							throw new Error(error);
						}
					});
			}

			if (interaction.values[0] === 'help_stats') {

				return await interaction
					.followUp({
						embeds: [{
							color: /** @type {`#${string}`} */ (config.default_color),
							title: 'rp stats',
							description: 'Quick view of your characters condition.',
							fields: [
								{ name: '**Aliases**', value: 'none' },
								{ name: '**Arguments**', value: 'none' },
								{ name: '**More information**', value: 'This shows a condensed version of the players most important stats. This includes levels, XP, health, energy, hunger, thirst and injuries/illnesses.' },
							],
						}],
						ephemeral: true,
					})
					.catch(async (error) => {
						if (error.httpStatus !== 404) {
							throw new Error(error);
						}
					});
			}

			if (interaction.values[0] === 'help_inventory') {

				return await interaction
					.followUp({
						embeds: [{
							color: /** @type {`#${string}`} */ (config.default_color),
							title: 'rp inventory',
							description: 'This is a collection of all the things your pack has gathered, listed up.',
							fields: [
								{ name: '**Aliases**', value: 'storage, i' },
								{ name: '**Arguments**', value: 'none' },
								{ name: '**More information**', value: 'This shows a list of items that the pack has, plus the amount. Any item is only displayed if there is more than zero of it. In the case of herbs, a short description is given for each herb, containing information about edibility and healing capabilities. The inventory has three pages, the first one is for common herbs, the second one is for uncommon and rare herbs, and the third one is for meat. If the user has below maximum hunger, they can select any herb or meat from a drop-down list to eat one of it.' },
							],
						}],
						ephemeral: true,
					})
					.catch(async (error) => {
						if (error.httpStatus !== 404) {
							throw new Error(error);
						}
					});
			}

			if (interaction.values[0] === 'help_store') {

				return await interaction
					.followUp({
						embeds: [{
							color: /** @type {`#${string}`} */ (config.default_color),
							title: 'rp store',
							description: 'Take items you have gathered for your pack, and put them in the pack inventory.',
							fields: [
								{ name: '**Aliases**', value: 'none' },
								{ name: '**Arguments**', value: 'none' },
								{ name: '**More information**', value: 'This command is used to store things away. You can either store everything away with the "Store everything" button, or choose any of the items that you have in your inventory from a drop-down list, then choose the amount that you want to store away from a second drop-down list. Any item put into the packs inventory cannot be put back into your own inventory.' },
							],
						}],
						ephemeral: true,
					})
					.catch(async (error) => {
						if (error.httpStatus !== 404) {
							throw new Error(error);
						}
					});
			}

			if (interaction.values[0] === 'help_eat') {

				return await interaction
					.followUp({
						embeds: [{
							color: /** @type {`#${string}`} */ (config.default_color),
							title: 'rp eat (item)',
							description: 'Take the appropriate food for your species out of the packs food pile and fill up your hunger meter.',
							fields: [
								{ name: '**Aliases**', value: 'none' },
								{ name: '**Arguments**', value: 'Optional: The name of the item you want to eat' },
								{ name: '**More information**', value: 'If no item is specified, this executes the inventory command.\nAny food can either be edible, inedible, or toxic. This depends on your species diet, ie if it is a carnivore and only eats meat, a herbivore and only eats herbs, or an omnivore and can eat both. While all meat is edible, not all herbs are edible, even for herbivores. The edibality of a herb is provided through its description in the inventory.\nEating a toxic item will make the player lose between 3 and 5 hunger points, as well as between 8 and 10 health points. If an item is inedible, the player loses between 1 and 3 hunger points. If an item is edible but doesn\'t suit your species\' diet, you gain between 1 and 5 hunger points, and if it does suit your species\' diet, you gain between 11 and 20 hunger points.' },
							],
						}],
						ephemeral: true,
					})
					.catch(async (error) => {
						if (error.httpStatus !== 404) {
							throw new Error(error);
						}
					});
			}

			if (interaction.values[0] === 'help_drink') {

				return await interaction
					.followUp({
						embeds: [{
							color: /** @type {`#${string}`} */ (config.default_color),
							title: 'rp drink',
							description: 'Drink some water and fill up your thirst meter.',
							fields: [
								{ name: '**Aliases**', value: 'none' },
								{ name: '**Arguments**', value: 'none' },
								{ name: '**More information**', value: 'This gives you 15 seconds to click a button as many times as possible. The amount of thirst you gain is the amount of times you clicked the button at least, or 2 more points at best. This is due to Discord\'s rate limit, which prevents some button clicks from being sent through.' },
							],
						}],
						ephemeral: true,
					})
					.catch(async (error) => {
						if (error.httpStatus !== 404) {
							throw new Error(error);
						}
					});
			}

			if (interaction.values[0] === 'help_rest') {

				return await interaction
					.followUp({
						embeds: [{
							color: /** @type {`#${string}`} */ (config.default_color),
							title: 'rp rest',
							description: 'Get some sleep and fill up your energy meter. Takes some time to refill.',
							fields: [
								{ name: '**Aliases**', value: 'sleep' },
								{ name: '**Arguments**', value: 'none' },
								{ name: '**More information**', value: 'This will increase your energy by 1 every 30 seconds. If you execute any other commands, you stop resting and only get the amount of energy you have gathered up until that point. If you don\'t execute any commands for 10 minutes, you will automatically start resting. When you reach full energy, you will be pinged to let you know.' },
							],
						}],
						ephemeral: true,
					})
					.catch(async (error) => {
						if (error.httpStatus !== 404) {
							throw new Error(error);
						}
					});
			}

			if (interaction.values[0] === 'help_heal') {

				return await interaction
					.followUp({
						embeds: [{
							color: /** @type {`#${string}`} */ (config.default_color),
							title: 'rp heal (@user)',
							description: 'Heal your packmates. Costs energy, but gives XP. __Only available to Apprentices, Healers and Elderlies.__',
							fields: [
								{ name: '**Aliases**', value: 'none' },
								{ name: '**Arguments**', value: 'Optional: A mention of the user that you want to heal.' },
								{ name: '**More information**', value: 'If you do mention someone, this will check if they need to be healed. If you don\'t, it will check how many players need to be healed. If it is only one, that player will automatically be selected. It will also automatically select page 1 of the inventory, but page 2 of the inventory can also be selected. Then, you select a herb from a drop-down list.\nThis will first check if the herb\'s healing abilities overlap with the illnesses/injuries of the player you want to heal. If so, you are successful. If the player you want to heal is yourself, there is a 60 in 100 chance that you will be unsuccessful even if you chose right. If you are Apprentice, there is a 40 in 100 chance that you are unsuccessful even if you chose right.\nIf you have a living ginkgo sapling, both of these chances are increased in your favor by one for the amount of times you watered the sapling successfully.\nIf you heal someone who has a cold, you have a 3 in 10 chance to get infected.' },
							],
						}],
						ephemeral: true,
					})
					.catch(async (error) => {
						if (error.httpStatus !== 404) {
							throw new Error(error);
						}
					});
			}

			if (interaction.values[0] === 'help_dispose') {

				return await interaction
					.followUp({
						embeds: [{
							color: /** @type {`#${string}`} */ (config.default_color),
							title: 'rp dispose',
							description: 'Remove obstacles blocking dens. Costs energy, but gives XP. __Only available to Apprentices, Hunters and Elderlies.__',
							fields: [
								{ name: '**Aliases**', value: 'none' },
								{ name: '**Arguments**', value: 'none' },
								{ name: '**More information**', value: 'This command is used when the entrance to a den is blocked. When any player that isn\'t a Youngling executes a command associated with a den, and there isn\'t already something blocking a den, there is a 1 in 20 chance that the den will be blocked off. After that, the command associated with that den can\'t be executed anymore until someone uses `dispose` successfully.\nDens and commands that are associated with each other are the sleeping dens with `rest`, the food den with `eat`, `store` and `inventory`, and the medicine den with `heal`.\nDepending on what is blocking the den, the player has to choose the right way to get rid of it.\nApprentices have a lowered chance of 50 in 100 to be successful, even if they chose correctly. If you have a living ginkgo sapling, that chance is increased in your favor by one for the amount of times you watered the sapling successfully.' },
							],
						}],
						ephemeral: true,
					})
					.catch(async (error) => {
						if (error.httpStatus !== 404) {
							throw new Error(error);
						}
					});
			}

			if (interaction.values[0] === 'help_water') {

				return await interaction
					.followUp({
						embeds: [{
							color: /** @type {`#${string}`} */ (config.default_color),
							title: 'rp water',
							description: 'If you have a ginkgo sapling, you can water it using this command.',
							fields: [
								{ name: '**Aliases**', value: 'none' },
								{ name: '**Arguments**', value: 'none' },
								{ name: '**More information**', value: 'Ginkgo saplings are found by `exploring`.\nYou are supposed to water it every 24 hours. If you water it within 30 minutes before or after that time, your plant gains health depending on how close to the perfect time you were (4 - minutes/10, rounded). This is also your chance to gain health. If you water it within 3 hours before or after, the plant lives on. In both of these cases, successful watering gets increased by one and you get twice its value in XP.\nIf you water it too soon, it will loose health based on the amount of hours it was too soon by, starting at the 3 hours before the 24 hour mark where it would have still been successful (minutes / 60, rounded up). If you don\'t water it in time, it will loose health each hour that you don\'t water it, starting at the 3 hours after the 24 hour mark where it still would have been successful. The amount of health subtracted each hour is equal to the amount of hours watering has been overdue by.' },
							],
						}],
						ephemeral: true,
					})
					.catch(async (error) => {
						if (error.httpStatus !== 404) {
							throw new Error(error);
						}
					});
			}

			if (interaction.values[0] === 'help_say') {

				return await interaction
					.followUp({
						embeds: [{
							color: /** @type {`#${string}`} */ (config.default_color),
							title: 'rp say [text]',
							description: 'Talk to your fellow packmates. Gives 1 experience point per use.',
							fields: [
								{ name: '**Aliases**', value: 'none' },
								{ name: '**Arguments**', value: 'The text that you want to say.' },
								{ name: '**More information**', value: 'This will create a webhook with your player name and your player avatar, and then send a message with the text you chose as its content.' },
							],
						}],
						ephemeral: true,
					})
					.catch(async (error) => {
						if (error.httpStatus !== 404) {
							throw new Error(error);
						}
					});
			}

			if (interaction.values[0] === 'help_hug') {

				return await interaction
					.followUp({
						embeds: [{
							color: /** @type {`#${string}`} */ (config.default_color),
							title: 'rp hug [@user]',
							description: 'Hug a fellow packmate, if they consent.',
							fields: [
								{ name: '**Aliases**', value: 'snuggle' },
								{ name: '**Arguments**', value: 'A mention of the user you want to hug.' },
								{ name: '**More information**', value: 'This will first ask the receiving user if they accept the hug. If they do, a random GIF of two non-human animals hugging is being displayed. The receiving user does not need an account for this.' },
							],
						}],
						ephemeral: true,
					})
					.catch(async (error) => {
						if (error.httpStatus !== 404) {
							throw new Error(error);
						}
					});
			}

			if (interaction.values[0] === 'help_share') {

				return await interaction
					.followUp({
						embeds: [{
							color: /** @type {`#${string}`} */ (config.default_color),
							title: 'rp share (@user)',
							description: 'Mention someone to share a story or anecdote. Costs energy, but gives XP to the other person. __Only available to Elderlies.__',
							fields: [
								{ name: '**Aliases**', value: 'none' },
								{ name: '**Arguments**', value: 'Optional: A mention of the user you want to share a story with.' },
								{ name: '**More information**', value: 'This command can only be executed every 2 hours.\nThe receiving player needs a valid account that isn\'t passed out for this.\nIf no user is being mentioned, a random player in the ruins is being selected. If there is no player in the ruins, no one is shared a story with. The 2 hour cooldown will not start in this case.\nThe amount of experience points the mentioned player gets is a random number between their level times 2.5 and their level times 7.5.' },
							],
						}],
						ephemeral: true,
					})
					.catch(async (error) => {
						if (error.httpStatus !== 404) {
							throw new Error(error);
						}
					});
			}

			if (interaction.values[0] === 'help_playfight') {

				return await interaction
					.followUp({
						embeds: [{
							color: /** @type {`#${string}`} */ (config.default_color),
							title: 'rp playfight [@user] (c4 or connectfour / ttt or tictactoe)',
							description: 'Playfully fight with another packmate. You can play Connect Four or Tic Tac Toe.',
							fields: [
								{ name: '**Aliases**', value: 'none' },
								{ name: '**Arguments**', value: 'A mention of the user you want to playfight with. Optional: `c4` or `connectfour` to play Connect Four, or `ttt` or `tictactoe` to play Tic Tac Toe.' },
								{ name: '**More information**', value: 'If no game is selected, a random game will be chosen.\nBoth users need an account to play this.\nThe receiving user will first be asked if they want to play, and if they say yes, the users alternate as per the game. If a player doesn\'t click a button for too long, the game will be aborted.\nIn the case of a tie, both players get between 5 and 15 XP. In the case that one player wins, They get between 10 and 20 XP, with an extra amount of XP being calculated in a sigmoid function based on the difference between the winners and losers level, where the lower the winners level is than the losers level, the more extra XP they get. The maximum extra XP is 40.\nThe losing player has a 10 in 100 chance of being injured. If the losing player has a living ginkgo sapling, this chance is increased in their favor by one for the amount of times they watered the sapling successfully. If they do get injured, it is a 50/50 chance between getting a sprain and getting an infection.' },
							],
						}],
						ephemeral: true,
					})
					.catch(async (error) => {
						if (error.httpStatus !== 404) {
							throw new Error(error);
						}
					});
			}

			if (interaction.values[0] === 'help_accounts') {

				return await interaction
					.followUp({
						embeds: [{
							color: /** @type {`#${string}`} */ (config.default_color),
							title: 'rp accounts',
							description: 'Change the account/profile you are using. You can have up to three per server.',
							fields: [
								{ name: '**Aliases**', value: 'switch' },
								{ name: '**Arguments**', value: 'none' },
								{ name: '**More information**', value: 'Any player can have up to three accounts per pack. Only the account that is selected is active, the other accounts are being treated as non-existent until they are selected. They will not show up in the `profilelist` command, the `go` command etc.\nWith this command, you can click on any of three buttons to select the account associated with it. If you have less than three accounts, the remaining buttons will be replaced by "Empty Slot" buttons. Clicking those means you are on no account, meaning you can create a new one.' },
							],
						}],
						ephemeral: true,
					})
					.catch(async (error) => {
						if (error.httpStatus !== 404) {
							throw new Error(error);
						}
					});
			}

			if (interaction.values[0] === 'help_shop') {

				return await interaction
					.followUp({
						embeds: [{
							color: /** @type {`#${string}`} */ (config.default_color),
							title: 'rp shop',
							description: 'Buy roles with experience points.',
							fields: [
								{ name: '**Aliases**', value: 'none' },
								{ name: '**Arguments**', value: 'none' },
								{ name: '**More information**', value: 'This shows you a list of all the roles that are buyable with experience points. You can select any from a drop-down list. First it will check if you already have the role. If you do, you will be refunded your experience points in exchange for losing the role. If you don\'t have the role, it will check whether you have enough experience points, and will only give you the role if you do. Your levels also count into your experience points, so you might lose levels to afford the role.' },
							],
						}],
						ephemeral: true,
					})
					.catch(async (error) => {
						if (error.httpStatus !== 404) {
							throw new Error(error);
						}
					});
			}

			if (interaction.values[0] === 'help_requestvisit') {

				return await interaction
					.followUp({
						embeds: [{
							color: /** @type {`#${string}`} */ (config.default_color),
							title: 'rp requestvisit',
							description: 'Find, visit and talk to people from far away packs.',
							fields: [
								{ name: '**Aliases**', value: 'none' },
								{ name: '**Arguments**', value: 'none' },
								{ name: '**More information**', value: 'This shows you a list of all the servers that have this bot and that have visits enabled. You can then choose one from the drop-down list, sending a visit request to them. Both you and they have the ability to cancel this request. After five minutes, the request will automatically denied. If they accept within this timeframe, the visit-channels that the admins of both servers have selected will be connected in the sense that whenever someone with a profile sends a message in it, the message will be sent to the other server via a webhook that has their profile name and server as name and profile avatar as the avatar. This way, two servers can practically talk to each other for the time of the visit.' },
							],
						}],
						ephemeral: true,
					})
					.catch(async (error) => {
						if (error.httpStatus !== 404) {
							throw new Error(error);
						}
					});
			}

			if (interaction.values[0] === 'help_endvisit') {

				return await interaction
					.followUp({
						embeds: [{
							color: /** @type {`#${string}`} */ (config.default_color),
							title: 'rp requestvisit',
							description: 'End a visit between your and another pack.',
							fields: [
								{ name: '**Aliases**', value: 'none' },
								{ name: '**Arguments**', value: 'none' },
								{ name: '**More information**', value: 'During a visit, this can be done by anyone with an account. The visit will be ended and the connection between the two servers will be stopped.' },
							],
						}],
						ephemeral: true,
					})
					.catch(async (error) => {
						if (error.httpStatus !== 404) {
							throw new Error(error);
						}
					});
			}

			if (interaction.values[0] === 'help_shopadd') {

				return await interaction
					.followUp({
						embeds: [{
							color: /** @type {`#${string}`} */ (config.default_color),
							title: 'rp shopadd [@role] [rank/levels/XP] [requirement]',
							description: '__Server admins only.__ Add a role to the shop.',
							fields: [
								{ name: '**Aliases**', value: 'none' },
								{ name: '**Arguments**', value: 'The first argument is a mention of the role that should be added to the shop. The second argument is either "rank", "levels" or "XP". The first two mean that a user will automatically acquire the role when achieving the specified rank/level. The last one means that they have to spend the specified amount of XP to acquire it. The third argument is either a number (for levels or XP) or a rank name (Youngling, Apprentice, Hunter, Healer, Elderly).' },
								{ name: '**More information**', value: 'Roles that are given for ranks or levels will be given once any player reaches the requirement. For XP, the role can be bought in a shop. The user has to have the needed experience points. Their levels also count into their experience points. Leveling up is always associated with a +50 increase in needed experience points. Therefore, being level 2 equals an extra 50 XP, level 3 150 XP, level 4 300 XP, level 5 500 XP etc. The formula is (level * (level -1) / 2 * 50). Starting at level 35 a user is considered being in the endgame, at that point they would have a little less than 30k XP, although losing that much XP would mean they would have to essentially start over.\nThe same role cannot be added under the same conditions twice.\nThe same role cannot be acquired both through earning (rank, levels) and buying (experience) due to the refund system.\nThe same role cannot be sold at two different XP prices.' },
								{ name: '**Example**', value: '`rp shopadd @TeamHunter rank Hunter`\n`rp shopadd @VIPlayers levels 35`\n`rp shopadd @greencolor XP 5000`' },
							],
						}],
						ephemeral: true,
					})
					.catch(async (error) => {
						if (error.httpStatus !== 404) {
							throw new Error(error);
						}
					});
			}

			if (interaction.values[0] === 'help_shopadd') {

				return await interaction
					.followUp({
						embeds: [{
							color: /** @type {`#${string}`} */ (config.default_color),
							title: 'rp shopadd [@role] [rank/levels/XP] [requirement]',
							description: '__Server admins only.__ Add a role to the shop.',
							fields: [
								{ name: '**Aliases**', value: 'none' },
								{ name: '**Arguments**', value: 'The first argument is a mention of the role that should be added to the shop. The second argument is either "rank", "levels" or "XP". The first two mean that a user will automatically acquire the role when achieving the specified rank/level. The last one means that they have to spend the specified amount of XP to acquire it. The third argument is either a number (for levels or XP) or a rank name (Youngling, Apprentice, Hunter, Healer, Elderly).' },
								{ name: '**More information**', value: 'Roles that are given for ranks or levels will be given once any player reaches the requirement. For XP, the role can be bought in a shop. The user has to have the needed experience points. Their levels also count into their experience points. Leveling up is always associated with a +50 increase in needed experience points. Therefore, being level 2 equals an extra 50 XP, level 3 150 XP, level 4 300 XP, level 5 500 XP etc. The formula is (level * (level -1) / 2 * 50). Starting at level 35 a user is considered being in the endgame, at that point they would have a little less than 30k XP, although losing that much XP would mean they would have to essentially start over.\nThe same role cannot be added under the same conditions twice.\nThe same role cannot be acquired both through earning (rank, levels) and buying (experience) due to the refund system.\nThe same role cannot be sold at two different XP prices.' },
								{ name: '**Example**', value: '`rp shopadd @TeamHunter rank Hunter`\n`rp shopadd @VIPlayers levels 35`\n`rp shopadd @greencolor XP 5000`' },
							],
						}],
						ephemeral: true,
					})
					.catch(async (error) => {
						if (error.httpStatus !== 404) {
							throw new Error(error);
						}
					});
			}

			if (interaction.values[0] === 'help_shopremove') {

				return await interaction
					.followUp({
						embeds: [{
							color: /** @type {`#${string}`} */ (config.default_color),
							title: 'rp shopremove',
							description: '__Server admins only.__ Remove a role from the shop.',
							fields: [
								{ name: '**Aliases**', value: 'shopdelete' },
								{ name: '**Arguments**', value: 'none' },
								{ name: '**More information**', value: 'This gives you a list of the created shop entries with the role, way of acquiring and requirement. You can then choose one from a drop-down list to delete it.' },
							],
						}],
						ephemeral: true,
					})
					.catch(async (error) => {
						if (error.httpStatus !== 404) {
							throw new Error(error);
						}
					});
			}

			if (interaction.values[0] === 'help_allowvisits') {

				return await interaction
					.followUp({
						embeds: [{
							color: /** @type {`#${string}`} */ (config.default_color),
							title: 'rp allowvists [#channel/off]',
							description: '__Server admins only.__ Allow or disallow visits between your and other packs.',
							fields: [
								{ name: '**Aliases**', value: 'none' },
								{ name: '**Arguments**', value: 'Either the mention of a channel that is the visit-channel, or "off" to turn visits off.' },
								{ name: '**More information**', value: 'Visits are a feature where to servers can connect in order to talk with each other. Only messages in the channel you select will be sent to the visiting server, and only that channel will receive messages from the visiting server. Only messages by users with an account will be sent.' },
							],
						}],
						ephemeral: true,
					})
					.catch(async (error) => {
						if (error.httpStatus !== 404) {
							throw new Error(error);
						}
					});
			}

			if (interaction.values[0] === 'help_getupdates') {

				return await interaction
					.followUp({
						embeds: [{
							color: /** @type {`#${string}`} */ (config.default_color),
							title: 'rp getupdates [#channel]',
							description: '__Server admins only.__ Allow or disallow visits between your and other packs.',
							fields: [
								{ name: '**Aliases**', value: 'updates, enableupdates' },
								{ name: '**Arguments**', value: 'The mention of a channel.' },
								{ name: '**More information**', value: 'Whenever important information is available such as new features being available, that information is posted in the updates channel of the Paw and Paper Support server. With this command, this updates channel is being followed, so that all the posts there will be posted in the specified channel. To turn this off, just unfollow from within your channels settings.' },
							],
						}],
						ephemeral: true,
					})
					.catch(async (error) => {
						if (error.httpStatus !== 404) {
							throw new Error(error);
						}
					});
			}

			if (interaction.values[0] === 'help_ticket') {

				return await interaction
					.followUp({
						embeds: [{
							color: /** @type {`#${string}`} */ (config.default_color),
							title: 'rp ticket [text]',
							description: 'Report a bug, give feedback, suggest a feature!',
							fields: [
								{ name: '**Aliases**', value: 'none' },
								{ name: '**Arguments**', value: 'Text of the ticket that you want to send.' },
								{ name: '**More information**', value: 'Tickets are a way to contribute to the bot. Any form of feedback, either by reporting an issue or suggesting a new feature is appreciated. Thank you!' },
								{ name: '**Example**', value: '`rp ticket Attacking a chicken should lead to millions of chickens spawning and attacking you back until you die!`' },
							],
						}],
						ephemeral: true,
					})
					.catch(async (error) => {
						if (error.httpStatus !== 404) {
							throw new Error(error);
						}
					});
			}

			if (interaction.values[0] === 'help_vote') {

				return await interaction
					.followUp({
						embeds: [{
							color: /** @type {`#${string}`} */ (config.default_color),
							title: 'rp vote',
							description: 'Vote for this bot on one of three websites and get +30 energy each time.',
							fields: [
								{ name: '**Aliases**', value: 'none' },
								{ name: '**Arguments**', value: 'none' },
								{ name: '**More information**', value: 'There will be three buttons with links to websites where this bot is listed. You can vote for this bot on these websites, and then come back and select that website from the drop-down list to get +30 energy. If you are less than 30 energy away from your maximum energy, you will get whatever is left to fill your energy all the way up. You can vote every 12 hours, and you can only redeem the +30 energy on one account.' },
							],
						}],
						ephemeral: true,
					})
					.catch(async (error) => {
						if (error.httpStatus !== 404) {
							throw new Error(error);
						}
					});
			}

			const plantNamesArray = [...commonPlantsMap.keys(), ...uncommonPlantsMap.keys(), ...rarePlantsMap.keys(), ...speciesMap.keys() ].sort();

			if (interaction.customId == 'eat-options' && plantNamesArray.some(elem => elem == interaction.values[0])) {

				interaction.message
					.delete()
					.catch(async (error) => {
						if (error.httpStatus !== 404) {
							throw new Error(error);
						}
					});

				referencedMessage.content = `${config.prefix}eat ${interaction.values[0]}`;

				return await execute(client, referencedMessage);
			}
		}

		if (interaction.isButton()) {

			console.log(`\x1b[32m${interaction.user.tag}\x1b[0m successfully clicked the button \x1b[33m${interaction.customId} \x1b[0min \x1b[32m${interaction.guild.name} \x1b[0mat \x1b[3m${new Date().toLocaleString()} \x1b[0m`);


			if (interaction.customId === 'report') {

				interaction.message
					.edit({
						components: [],
					})
					.catch(async (error) => {
						if (error.httpStatus !== 404) {
							throw new Error(error);
						}
					});

				const maksi = await client.users.fetch(config.maksi);
				return await maksi
					.send({
						content: `https://discord.com/channels/${interaction.guild.id}/${interaction.message.channel.id}/${interaction.message.id}`,
						embeds: interaction.message.embeds,
						components: [{
							type: 'ACTION_ROW',
							components: [{
								type: 'BUTTON',
								customId: 'ticket',
								label: 'Resolve',
								style: 'SUCCESS',
							}],
						}],
					})
					.catch(async (error) => {
						return await errorHandling.output(interaction.message, error);
					});
			}

			if (interaction.customId === 'profile-refresh') {

				const components = [{
					type: 'ACTION_ROW',
					components: [{
						type: 'BUTTON',
						customId: 'profile-refresh',
						emoji: { name: '🔁' },
						style: 'SECONDARY',
					}, {
						type: 'BUTTON',
						customId: 'profile-store',
						label: 'Store food away',
						style: 'SECONDARY',
					}],
				}];

				if (referencedMessage.mentions.users.size > 0) {

					profileData = /** @type {import('../typedef').ProfileSchema} */ (await profileModel.findOne({
						userId: referencedMessage.mentions.users.first().id,
						serverId: referencedMessage.guild.id,
					}));

					components[0].components.pop();
				}
				else if (Object.values(profileData.inventoryObject).map(itemType => Object.values(itemType)).flat().filter(amount => amount > 0).length == 0) {

					components[0].components.pop();
				}

				let injuryText = (Object.values(profileData.injuryObject).every(item => item == 0)) ? 'none' : '';

				for (const [injuryKey, injuryAmount] of Object.entries(profileData.injuryObject)) {

					if (injuryAmount > 0) {

						const injuryName = injuryKey.charAt(0).toUpperCase() + injuryKey.slice(1);
						injuryText += `${injuryAmount} ${(injuryAmount > 1) ? injuryName.slice(0, -1) : injuryName}\n`;
					}
				}

				const description = (profileData.description == '') ? '' : `*${profileData.description}*`;
				const user = await client.users
					.fetch(profileData.userId)
					.catch(() => { return null; });

				await interaction.message
					.edit({
						embeds: [{
							color: profileData.color,
							title: `Profile - ${user.tag}`,
							author: { name: profileData.name, icon_url: profileData.avatarURL },
							description: description,
							thumbnail: { url: profileData.avatarURL },
							fields: [
								{ name: '**🦑 Species**', value: profileData.species.charAt(0).toUpperCase() + profileData.species.slice(1), inline: true },
								{ name: '**🏷️ Rank**', value: profileData.rank, inline: true },
								{ name: '**🍂 Pronouns**', value: profileData.pronounSets.map(pronounSet => `${pronounSet[0]}/${pronounSet[1]} (${pronounSet[2]}/${pronounSet[3]}/${pronounSet[4]})`).join('\n') },
								{ name: '**🗺️ Region**', value: profileData.currentRegion },

							],
						},
						{
							color: /** @type {`#${string}`} */ (profileData.color),
							description: `🚩 Levels: \`${profileData.levels}\` - ✨ XP: \`${profileData.experience}/${profileData.levels * 50}\`\n❤️ Health: \`${profileData.health}/${profileData.maxHealth}\`\n⚡ Energy: \`${profileData.energy}/${profileData.maxEnergy}\`\n🍗 Hunger: \`${profileData.hunger}/${profileData.maxHunger}\`\n🥤 Thirst: \`${profileData.thirst}/${profileData.maxThirst}\``,
							fields: [
								{ name: '**🩹 Injuries/Illnesses**', value: injuryText, inline: true },
								{ name: '**🌱 Ginkgo Sapling**', value: profileData.saplingObject.exists === false ? 'none' : `${profileData.saplingObject.waterCycles} days alive - ${profileData.saplingObject.health} health\nNext watering <t:${Math.floor(profileData.saplingObject.nextWaterTimestamp / 1000)}:R>`, inline: true },
							],
							footer: { text: profileData.hasQuest == true ? 'There is one open quest!' : null },
						}],
						components: /** @type {Array<import('discord.js').MessageActionRow>} */ (components),
					})
					.catch(async (error) => {
						if (error.httpStatus !== 404) {
							throw new Error(error);
						}
					});
			}

			if (interaction.customId === 'stats-refresh') {

				let injuryText = (Object.values(profileData.injuryObject).every(item => item == 0)) ? null : '';

				for (const [injuryKey, injuryAmount] of Object.entries(profileData.injuryObject)) {

					if (injuryAmount > 0) {

						if (typeof injuryAmount === 'number') {

							injuryText += `, ${injuryAmount} ${(injuryAmount < 2) ? injuryKey.slice(0, -1) : injuryKey}`;
						}
						else {

							injuryText += `${injuryKey}: yes\n`;
						}
					}
				}

				const components = [{
					type: 'ACTION_ROW',
					components: [{
						type: 'BUTTON',
						customId: 'stats-refresh',
						emoji: { name: '🔁' },
						style: 'SECONDARY',
					}, {
						type: 'BUTTON',
						customId: 'profile-store',
						label: 'Store food away',
						style: 'SECONDARY',
					}],
				}];

				if (Object.values(profileData.inventoryObject).map(itemType => Object.values(itemType)).flat().filter(amount => amount > 0).length == 0) {

					components[0].components.pop();
				}

				await interaction.message
					.edit({
						content: `🚩 Levels: \`${profileData.levels}\` - ✨ XP: \`${profileData.experience}/${profileData.levels * 50}\`\n❤️ Health: \`${profileData.health}/${profileData.maxHealth}\` - ⚡ Energy: \`${profileData.energy}/${profileData.maxEnergy}\`\n🍗 Hunger: \`${profileData.hunger}/${profileData.maxHunger}\` - 🥤 Thirst: \`${profileData.thirst}/${profileData.maxThirst}\`${(injuryText == null) ? '' : `🩹 Injuries/Illnesses: ${injuryText.slice(2)}`}`,
						components: /** @type {Array<import('discord.js').MessageActionRow>} */ (components),
					})
					.catch((error) => {
						if (error.httpStatus !== 404) {
							throw new Error(error);
						}
					});
			}

			if (interaction.customId === 'profile-store') {

				interaction.message
					.delete()
					.catch(async (error) => {
						if (error.httpStatus !== 404) {
							throw new Error(error);
						}
					});

				referencedMessage.content = `${config.prefix}store`;

				return await execute(client, referencedMessage);
			}

			if (interaction.customId === 'water-reminder-off') {

				profileData.saplingObject.reminder = false;

				await profileModel.findOneAndUpdate(
					{ userId: profileData.userId, serverId: profileData.serverId },
					{ $set: { saplingObject: profileData.saplingObject } },
				);

				stopReminder(profileData);

				await interaction
					.followUp({
						content: 'You turned reminders for watering off!',
						ephemeral: true,
					})
					.catch((error) => {
						if (error.httpStatus !== 404) {
							throw new Error(error);
						}
					});

				return await interaction
					.editReply({
						components: [{
							type: 'ACTION_ROW',
							components: [{
								type: 'BUTTON',
								customId: 'water-reminder-on',
								label: 'Turn water reminders on',
								style: 'SECONDARY',
							}],
						}],
					})
					.catch((error) => {
						if (error.httpStatus !== 404) {
							throw new Error(error);
						}
					});
			}

			if (interaction.customId === 'water-reminder-on') {

				profileData.saplingObject.reminder = true;

				await profileModel.findOneAndUpdate(
					{ userId: profileData.userId, serverId: profileData.serverId },
					{ $set: { saplingObject: profileData.saplingObject } },
				);

				sendReminder(client, profileData, interaction.message.channel.id);

				await interaction
					.followUp({
						content: 'You turned reminders for watering on!',
						ephemeral: true,
					})
					.catch((error) => {
						if (error.httpStatus !== 404) {
							throw new Error(error);
						}
					});

				return await interaction
					.editReply({
						components: [{
							type: 'ACTION_ROW',
							components: [{
								type: 'BUTTON',
								customId: 'water-reminder-off',
								label: 'Turn water reminders off',
								style: 'SECONDARY',
							}],
						}],
					})
					.catch((error) => {
						if (error.httpStatus !== 404) {
							throw new Error(error);
						}
					});
			}
		}
	},
};
module.exports = event;