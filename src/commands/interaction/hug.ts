import { ActionRowBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle, EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { respond, update } from '../../utils/helperFunctions';
import userModel from '../../models/userModel';
import { SlashCommand, UserSchema } from '../../typedef';
import { disableAllComponents } from '../../utils/componentDisabling';
import { addFriendshipPoints } from '../../utils/friendshipHandling';
import { generateRandomNumber } from '../../utils/randomizers';
const { error_color } = require('../../../config.json');

const name: SlashCommand['name'] = 'hug';
const description: SlashCommand['description'] = 'Hug someone, if they consent.';
export const command: SlashCommand = {
	name: name,
	description: description,
	data: new SlashCommandBuilder()
		.setName(name)
		.setDescription(description)
		.addUserOption(option =>
			option.setName('user')
				.setDescription('The user you want to hug.')
				.setRequired(true))
		.toJSON(),
	disablePreviousCommand: false,
	sendCommand: async (client, interaction, userData) => {

		const quidData = userData ? userData.quids[userData.currentQuid[interaction.guildId || 'DM'] || ''] : undefined;
		const member = interaction.inCachedGuild() ? await interaction.guild.members.fetch(interaction.user.id).catch(() => { return undefined; }) : undefined;

		const mentionedUser = interaction.options.getUser('user');
		if (!mentionedUser) {

			await respond(interaction, {
				embeds: [new EmbedBuilder()
					.setColor(error_color)
					.setTitle('Please mention a user that you want to hug!')],
				ephemeral: true,
			}, false)
				.catch((error) => {
					if (error.httpStatus !== 404) { throw new Error(error); }
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

			await respond(interaction, {
				embeds: [new EmbedBuilder()
					.setColor(quidData?.color || member?.displayColor || interaction.user.accentColor || '#ffffff')
					.setAuthor({
						name: quidData?.name || member?.displayName || interaction.user.tag,
						iconURL: quidData?.avatarURL || member?.displayAvatarURL() || interaction.user.avatarURL() || undefined,
					})
					.setImage(selfHugURLs[generateRandomNumber(selfHugURLs.length, 0)] || null)],
			}, true)
				.catch((error) => {
					if (error.httpStatus !== 404) { throw new Error(error); }
				});
			return;
		}

		await respond(interaction, {
			content: mentionedUser.toString(),
			embeds: [new EmbedBuilder()
				.setColor(quidData?.color || member?.displayColor || interaction.user.accentColor || '#ffffff')
				.setAuthor({
					name: quidData?.name || member?.displayName || interaction.user.tag,
					iconURL: quidData?.avatarURL || member?.displayAvatarURL() || interaction.user.avatarURL() || undefined,
				})
				.setDescription(`${mentionedUser.username}, do you accept the hug?`)],
			components: [new ActionRowBuilder<ButtonBuilder>()
				.setComponents([
					new ButtonBuilder()
						.setCustomId(`hug_accept_${mentionedUser.id}_${interaction.user.id}`)
						.setLabel('Accept')
						.setEmoji('🫂')
						.setStyle(ButtonStyle.Success),
					new ButtonBuilder()
						.setCustomId(`hug_decline_${mentionedUser.id}_${interaction.user.id}`)
						.setLabel('Decline')
						.setStyle(ButtonStyle.Danger),
				])],
		}, true)
			.catch((error) => { throw new Error(error); });
	},
};

/**
 * A function that is called when the user accepts or declines the hug. It edits the message to show a hug gif and adds friendship points, or that the user didn't accept the hug.
 */
export async function hugInteractionCollector(
	interaction: ButtonInteraction,
	partnerUserData: UserSchema | null,
): Promise<void> {

	const originalUserId = interaction.customId.split('_')[3];
	const originalUser = originalUserId ? await interaction.client.users.fetch(originalUserId).catch(() => { return undefined; }) : undefined;
	const originalMember = interaction.inCachedGuild() && originalUserId ? await interaction.guild.members.fetch(originalUserId).catch(() => { return undefined; }) : undefined;
	if (!originalUser || !originalUserId || originalUserId === interaction.user.id) {

		await respond(interaction, {
			content: 'You can\'t accept or decline this hug!',
			ephemeral: true,
		}, false)
			.catch((error) => { throw new Error(error); });
		return;
	}

	const userData = await userModel.findOne(u => u.userId.includes(originalUserId)).catch(() => { return null; });
	const quidData = userData ? userData.quids[userData.currentQuid[interaction.guildId || 'DM'] || ''] : undefined;

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
		];

		await update(interaction, {
			content: null,
			embeds: [new EmbedBuilder()
				.setColor(quidData?.color || originalMember?.displayColor || originalUser.accentColor || '#ffffff')
				.setAuthor({
					name: quidData?.name || originalMember?.displayName || originalUser.tag,
					iconURL: quidData?.avatarURL || originalMember?.displayAvatarURL() || originalUser.avatarURL() || undefined,
				})
				.setImage(hugURLs[generateRandomNumber(hugURLs.length, 0)] || null)],
			components: [],
		})
			.catch((error) => {
				if (error.httpStatus !== 404) { throw new Error(error); }
			});

		const partnerQuidData = partnerUserData ? partnerUserData.quids[partnerUserData.currentQuid[interaction.guildId || 'DM'] || ''] : undefined;

		if (userData && quidData && partnerUserData && partnerQuidData) { await addFriendshipPoints(interaction.message, userData, quidData._id, partnerUserData, partnerQuidData._id); }
		return;
	}

	if (interaction.customId.includes('decline')) {

		await update(interaction, {
			content: null,
			embeds: [new EmbedBuilder()
				.setColor(quidData?.color || originalMember?.displayColor || originalUser.accentColor || '#ffffff')
				.setAuthor({
					name: quidData?.name || originalMember?.displayName || originalUser.tag,
					iconURL: quidData?.avatarURL || originalMember?.displayAvatarURL() || originalUser.avatarURL() || undefined,
				})
				.setDescription(`${interaction.user.toString()} did not accept the hug.`)],
			components: disableAllComponents(interaction.message.components.map(component => component.toJSON())),
		})
			.catch((error) => {
				if (error.httpStatus !== 404) { throw new Error(error); }
			});
		return;
	}
}