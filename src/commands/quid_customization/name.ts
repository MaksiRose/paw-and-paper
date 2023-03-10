import { EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { respond } from '../../utils/helperFunctions';
import { checkLevelRequirements, checkRankRequirements, updateAndGetMembers } from '../../utils/checkRoleRequirements';
import { getRandomNumber } from '../../utils/randomizers';
import { generateId } from 'crystalid';
import { SlashCommand } from '../../typings/handle';
import BannedUser from '../../models/bannedUser';
import User from '../../models/user';
import DiscordUser from '../../models/discordUser';
import DiscordUserToServer from '../../models/discordUserToServer';
import Quid from '../../models/quid';
import QuidToServer from '../../models/quidToServer';
import UserToServer from '../../models/userToServer';
import Group from '../../models/group';
const { version } = require('../../../package.json');
const { default_color, error_color } = require('../../../config.json');

export const command: SlashCommand = {
	data: new SlashCommandBuilder()
		.setName('name')
		.setDescription('Start your adventure! (Re-)name a quid.')
		.addStringOption(option =>
			option.setName('name')
				.setDescription('The name that you want your quid to have.')
				.setMaxLength(24) // A normal name should only have 24 characters, but a displayname/nickname should still have 32 characters max length.
				.setRequired(true))
		.toJSON(),
	category: 'page1',
	position: 0,
	disablePreviousCommand: false,
	modifiesServerProfile: false,
	sendCommand: async (interaction, { user, quid, userToServer, quidToServer }) => {

		let isNewAccount = false;
		/* This is checking if the user has any data saved in the database. If they don't, it will create a new user. */
		if (!user) {

			isNewAccount = true;
			/* Checking if the user is banned from using the bot. */
			const bannedUser = await BannedUser.findByPk(interaction.user.id);
			if (bannedUser !== null) {

				// This should always be a reply
				await respond(interaction, {
					content: 'I am sorry to inform you that you have been banned from using this bot.',
					ephemeral: true,
				});
				return;
			}

			user = await User.create({
				lastPlayedVersion: `${version.split('.').slice(0, -1).join('.')}`,
				id: generateId(),
			});

			await DiscordUser.create({ id: interaction.user.id, userId: user.id });

			if (interaction.inGuild()) {

				await DiscordUserToServer.create({ id: generateId(), discordUserId: interaction.user.id, serverId: interaction.guildId, isMember: true, lastUpdatedTimestamp: Date.now() });
			}
		}

		const name = interaction.options.getString('name');

		/* This is checking if the user has inputted a name for their quid. If they haven't, it will send them an error message. If they have, it will check if the name is too long. If it is, it will send them an error message. */
		if (!name) {

			// This should always be a reply
			await respond(interaction, {
				embeds: [new EmbedBuilder()
					.setColor(error_color)
					.setTitle('Please input a name for your quid.')],
				ephemeral: true,
			});
			return;
		}

		let isNewQuid = false;
		if (quid) { await quid.update({ name: name }); }
		else {

			isNewQuid = true;
			quid = await Quid.create({
				id: await createId(),
				name,
				userId: user.id,
			});
		}

		if (!quidToServer && interaction.inGuild()) {

			quidToServer = await QuidToServer.create({ id: generateId(), serverId: interaction.guildId, quidId: quid.id });
		}

		if (interaction.inGuild()) {

			if (userToServer) { await userToServer.update({ activeQuidId: quid.id }); }
			else { userToServer = await UserToServer.create({ id: generateId(), userId: user.id, serverId: interaction.guildId, activeQuidId: quid.id }); }
		}
		else { await user.update({ lastGlobalActiveQuidId: quid.id }); }

		// This should always be a reply
		await respond(interaction, {
			embeds: [new EmbedBuilder()
				.setColor(default_color)
				.setTitle(isNewQuid ? `You successfully created the quid ${name}!` : `You successfully renamed your quid to ${name}!`)
				.setDescription(isNewAccount === false ? null : '__What is a quid?__\nTo avoid using limiting words like "character" or "person", Paw and Paper uses the made-up word quid. It is based off of the word [Quiddity](https://en.wikipedia.org/wiki/Quiddity), which means "what makes something what it is". Quid then means "someone who is what they are", which is vague on purpose because it changes based on what they are.')
				.setFooter(isNewQuid ? { text: 'To continue setting up your profile for the RPG, type "/species". For other options, review "/help".' } : null)],
		});

		/* This is checking if the user is in a guild, if the server has data saved in the database, and if the guildmember data is cached. If all of these are true, it will check if the user has reached the requirements to get roles based on their rank and level. */
		if (interaction.inCachedGuild() && quidToServer) {

			const members = await updateAndGetMembers(user.id, interaction.guild);
			await checkRankRequirements(interaction, members, quidToServer, true);
			await checkLevelRequirements(interaction, members, quidToServer, true);
		}
	},
};

/**
 * Creates a unique 6-character ID.
 */
export async function createId(): Promise<string> {

	const legend = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'm', 'n', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
	let id = '';

	for (let index = 0; index < 6; index++) { id += legend[getRandomNumber(legend.length)]; }

	const givenIds = [
		...(await Quid.findAll({ attributes: ['id'] })).map(q => q.id),
		...(await Group.findAll({ attributes: ['id'] })).map(g => g.id),
	];

	if (givenIds.includes(id)) { return await createId(); }

	return id;
}