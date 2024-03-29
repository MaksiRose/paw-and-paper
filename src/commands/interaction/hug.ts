import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { getArrayElement, respond } from '../../utils/helperFunctions';
import { disableAllComponents } from '../../utils/componentDisabling';
import { addFriendshipPoints } from '../../utils/friendshipHandling';
import { getRandomNumber } from '../../utils/randomizers';
import { missingPermissions } from '../../utils/permissionHandler';
import { SlashCommand } from '../../typings/handle';
import { hasNameAndSpecies } from '../../utils/checkUserState';
import { getDisplayname } from '../../utils/getQuidInfo';
import DiscordUser from '../../models/discordUser';
import User from '../../models/user';
import UserToServer from '../../models/userToServer';
import Quid from '../../models/quid';
import QuidToServer from '../../models/quidToServer';
const { error_color } = require('../../../config.json');

export const command: SlashCommand = {
	data: new SlashCommandBuilder()
		.setName('hug')
		.setDescription('Hug someone, if they consent.')
		.addUserOption(option =>
			option.setName('user')
				.setDescription('The user you want to hug.')
				.setRequired(true))
		.toJSON(),
	category: 'page4',
	position: 4,
	disablePreviousCommand: false,
	modifiesServerProfile: false,
	sendCommand: async (interaction, { user, quid, userToServer, quidToServer }) => {

		if (await missingPermissions(interaction, [
			'ViewChannel', interaction.channel?.isThread() ? 'SendMessagesInThreads' : 'SendMessages', 'EmbedLinks', // Needed for channel.send call in addFriendshipPoints
		]) === true) { return; }

		const member = interaction.inCachedGuild() ? await interaction.guild.members.fetch(interaction.user.id).catch(() => { return undefined; }) : undefined;

		const mentionedUser = interaction.options.getUser('user');
		if (!mentionedUser) {

			// This is always a reply
			await respond(interaction, {
				embeds: [new EmbedBuilder()
					.setColor(error_color)
					.setTitle('Please mention a user that you want to hug!')],
				ephemeral: true,
			});
			return;
		}

		if (mentionedUser && mentionedUser.id === interaction.user.id) {

			const selfHugURLs = [
				'https://c.tenor.com/kkW-x5TKP-YAAAAC/seal-hug.gif',
				'https://c.tenor.com/a2ZPJZC3E50AAAAC/duck-sleeping.gif',
				'https://c.tenor.com/uPyoU80DaMsAAAAd/yawn-pampered-pandas.gif',
				'https://c.tenor.com/P5lPftY1nzUAAAAd/tired-exhausted.gif',
			];

			// This is always a reply
			await respond(interaction, {
				embeds: [new EmbedBuilder()
					.setColor(quid?.color || member?.displayColor || interaction.user.accentColor || '#ffffff')
					.setAuthor({
						name: quid ? await getDisplayname(quid, { serverId: interaction.guildId ?? undefined, userToServer, quidToServer, user }) : (member?.displayName || interaction.user.tag),
						iconURL: quid?.avatarURL || member?.displayAvatarURL() || interaction.user.avatarURL() || undefined,
					})
					.setImage(selfHugURLs[getRandomNumber(selfHugURLs.length)] || null)],
			});
			return;
		}

		// This is always a reply
		await respond(interaction, {
			content: mentionedUser.toString(),
			embeds: [new EmbedBuilder()
				.setColor(quid?.color || member?.displayColor || interaction.user.accentColor || '#ffffff')
				.setAuthor({
					name: quid ? await getDisplayname(quid, { serverId: interaction.guildId ?? undefined, userToServer, quidToServer, user }) : (member?.displayName || interaction.user.tag),
					iconURL: quid?.avatarURL || member?.displayAvatarURL() || interaction.user.avatarURL() || undefined,
				})
				.setDescription(`${mentionedUser.username}, do you accept the hug?`)],
			components: [new ActionRowBuilder<ButtonBuilder>()
				.setComponents([
					new ButtonBuilder()
						.setCustomId(`hug_accept_@${mentionedUser.id}_@${interaction.user.id}`)
						.setLabel('Accept')
						.setEmoji('🫂')
						.setStyle(ButtonStyle.Success),
					new ButtonBuilder()
						.setCustomId(`hug_decline_@${mentionedUser.id}_@${interaction.user.id}`)
						.setLabel('Decline')
						.setStyle(ButtonStyle.Danger),
				])],
		});
	},
	async sendMessageComponentResponse(interaction, partner) {

		if (!interaction.isButton()) { return; }
		if (await missingPermissions(interaction, [
			'ViewChannel', interaction.channel?.isThread() ? 'SendMessagesInThreads' : 'SendMessages', 'EmbedLinks', // Needed for channel.send call in addFriendshipPoints
		]) === true) { return; }

		const originalUserId = getArrayElement(interaction.customId.split('_'), 3).replace('@', '');
		const originalUser = originalUserId ? await interaction.client.users.fetch(originalUserId).catch(() => { return undefined; }) : undefined;
		const originalMember = interaction.inCachedGuild() && originalUserId ? await interaction.guild.members.fetch(originalUserId).catch(() => { return undefined; }) : undefined;
		if (originalUser === undefined || originalUserId === interaction.user.id) {

			// This is always a reply
			await respond(interaction, {
				content: 'You can\'t accept or decline this hug!',
				ephemeral: true,
			});
			return;
		}

		const discordUser = await DiscordUser.findByPk(originalUserId, {
			include: [{ model: User, as: 'user' }],
		}) ?? undefined;
		const user = discordUser?.user;

		const userToServer = user && interaction.inGuild() ? await UserToServer.findOne({
			where: { userId: user?.id, serverId: interaction.guildId },
			include: [{ model: Quid, as: 'activeQuid' }],
		}) ?? undefined : undefined;

		const quid = userToServer?.activeQuid ?? undefined;
		const quidToServer = quid && interaction.inGuild() ? await QuidToServer.findOne({
			where: { quidId: quid.id, serverId: interaction.guildId },
		}) ?? undefined : undefined;

		if (interaction.customId.includes('accept')) {

			const hugURLs = [
				'https://c.tenor.com/h94rl66G50cAAAAC/hug-cats.gif',
				'https://c.tenor.com/-YZ5lgNG7ecAAAAd/yes-love.gif',
				'https://c.tenor.com/K-mORy7U1SsAAAAd/wolf-animal.gif',
				'https://c.tenor.com/x2Ne9xx0SBgAAAAC/funny-animals-monkey-hug.gif',
				'https://c.tenor.com/a8H63f_WrqEAAAAC/border-collie-hug.gif',
				'https://c.tenor.com/jQud2Zph9OoAAAAC/animal-animals.gif',
				'https://c.tenor.com/tyK64-bjkikAAAAC/sweet-animals-cute.gif',
				'https://c.tenor.com/K2uYNMCeqe4AAAAC/bear-hug.gif',
				'https://c.tenor.com/j9ovpes78QsAAAAd/huge-hug-bromance.gif',
				'https://c.tenor.com/EKlPRdcuoccAAAAC/otter-cute.gif',
				'https://c.tenor.com/N-MAzVmbytEAAAAd/cat-dog.gif',
				'https://c.tenor.com/WvsUTL2ocVkAAAAd/cute-cats-cuddling-cats.gif',
				'https://c.tenor.com/8SjdZ9f64s8AAAAd/animals-kiss.gif',
				'https://c.tenor.com/VOLRmvc9PawAAAAd/cute-animals.gif',
				'https://c.tenor.com/N4wxlSS6s6YAAAAd/wake-up-360baby-pandas.gif',
				'https://c.tenor.com/twkOV4hc7JUAAAAd/kitty-cat.gif',
				'https://c.tenor.com/4tu5hJ3Rl2EAAAAC/snuggle-bunny.gif',
				'https://c.tenor.com/cQN_bn443gMAAAAS/fast-quick.gif',
			];

			// This is always an update to the message with the button
			await respond(interaction, {
				content: '', // This is converted to null within the function
				embeds: [new EmbedBuilder()
					.setColor(quid?.color || originalMember?.displayColor || originalUser.accentColor || '#ffffff')
					.setAuthor({
						name: quid ? await getDisplayname(quid, { serverId: interaction.guildId ?? undefined, userToServer, quidToServer, user }) : (originalMember?.displayName || originalUser.tag),
						iconURL: quid?.avatarURL || originalMember?.displayAvatarURL() || originalUser.avatarURL() || undefined,
					})
					.setImage(hugURLs[getRandomNumber(hugURLs.length)] || null)],
				components: [],
			}, 'update', interaction.message.id);

			if (hasNameAndSpecies(quid) && hasNameAndSpecies(partner.quid)) { await addFriendshipPoints(interaction.message, quid, partner.quid, { serverId: interaction.guildId ?? undefined, userToServer, quidToServer, user }); }
			return;
		}

		if (interaction.customId.includes('decline')) {

			// This is always an update to the message with the button
			await respond(interaction, {
				content: '', // This is converted to null within the function
				embeds: [new EmbedBuilder()
					.setColor(quid?.color || originalMember?.displayColor || originalUser.accentColor || '#ffffff')
					.setAuthor({
						name: quid ? await getDisplayname(quid, { serverId: interaction.guildId ?? undefined, userToServer, quidToServer, user }) : (originalMember?.displayName || originalUser.tag),
						iconURL: quid?.avatarURL || originalMember?.displayAvatarURL() || originalUser.avatarURL() || undefined,
					})
					.setDescription(`${interaction.user.toString()} did not accept the hug.`)],
				components: disableAllComponents(interaction.message.components),
			}, 'update', interaction.message.id);
			return;
		}

	},
};