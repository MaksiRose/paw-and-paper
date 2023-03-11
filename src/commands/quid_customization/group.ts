import { generateId } from 'crystalid';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, InteractionReplyOptions, ModalBuilder, RestOrArray, SelectMenuComponentOptionData, SlashCommandBuilder, StringSelectMenuBuilder, TextInputBuilder, TextInputStyle } from 'discord.js';
import Group from '../../models/group';
import GroupToQuid from '../../models/groupToQuid';
import GroupToServer from '../../models/groupToServer';
import Quid from '../../models/quid';
import QuidToServer from '../../models/quidToServer';
import User from '../../models/user';
import UserToServer from '../../models/userToServer';
import { SlashCommand } from '../../typings/handle';
import { hasName } from '../../utils/checkUserState';
import { constructCustomId, constructSelectOptions, deconstructCustomId, deconstructSelectOptions } from '../../utils/customId';
import { getDisplayname } from '../../utils/getQuidInfo';
import { capitalize, respond } from '../../utils/helperFunctions';
import { createId } from './name';
const { default_color } = require('../../../config.json');

type CustomIdArgs = ['groupselect', `${number}`] | ['create'] | ['rename' | 'delete' | 'tag' | 'confirm' | 'cancel' | 'join' | 'leave' | 'maingroup', string]
type SelectOptionArgs = ['nextpage', string] | ['switchto', string]

export const command: SlashCommand = {
	data: new SlashCommandBuilder()
		.setName('group')
		.setDescription('Create, delete, edit, join and leave groups.')
		.toJSON(),
	category: 'page1',
	position: 10,
	disablePreviousCommand: false,
	modifiesServerProfile: false,
	sendCommand: async (interaction, { user, quid, userToServer, quidToServer }) => {

		if (!user) { throw new TypeError('user is undefined'); }

		// This is always a reply
		await respond(interaction, await getGroupMessage(0, user, userToServer, quid, quidToServer));
	},
	async sendMessageComponentResponse(interaction, { user, quid, userToServer, quidToServer }) {

		if (!user) { return; }

		const customId = deconstructCustomId<CustomIdArgs>(interaction.customId);
		if (customId === null) { return; }

		if (interaction.isStringSelectMenu()) {

			const selectOptionId = deconstructSelectOptions<SelectOptionArgs>(interaction)[0];
			if (selectOptionId === undefined) { throw new TypeError('selectOptionId is undefined'); }

			let groupsPage = Number(customId.args[1]);
			const groupId = selectOptionId[1];

			/* Getting the quidsPage from the value Id, incrementing it by one or setting it to zero if the page number is bigger than the total amount of pages. */
			if (selectOptionId[0] === 'nextpage') {

				groupsPage += 1;
			}

			// This is always an update to the message with the select menu
			await respond(interaction, await getGroupMessage(groupsPage, user, userToServer, quid, quidToServer, groupId), 'update', interaction.message.id);
			return;
		}

		if (interaction.isButton() && (customId.args[0] === 'create' || customId.args[0] === 'rename')) {

			const groupId = customId.args[1];
			const group = groupId === undefined ? null : await Group.findByPk(groupId);

			const textInput = new TextInputBuilder()
				.setCustomId('name')
				.setLabel('Name')
				.setStyle(TextInputStyle.Short)
				.setMaxLength(48)
				.setRequired(true);
			if (group) { textInput.setValue(group.name); }

			await interaction
				.showModal(new ModalBuilder()
					.setCustomId(constructCustomId<CustomIdArgs>(command.data.name, user.id, customId.args))
					.setTitle(`${capitalize(customId.args[0])} a group`)
					.addComponents(
						new ActionRowBuilder<TextInputBuilder>()
							.setComponents([textInput]),
					),
				);
			return;
		}

		if (interaction.isButton() && customId.args[0] === 'delete') {

			const groupId = customId.args[1];
			const group = await Group.findByPk(groupId, { rejectOnEmpty: true });

			await respond(interaction, {
				content: `Are you sure you want to delete group \`${group.name}\`? This is permanent!`,
				embeds: [],
				components: [new ActionRowBuilder<ButtonBuilder>()
					.setComponents(new ButtonBuilder()
						.setCustomId(constructCustomId<CustomIdArgs>(command.data.name, user.id, ['confirm', customId.args[1]]))
						.setLabel('Confirm')
						.setStyle(ButtonStyle.Danger),
					new ButtonBuilder()
						.setCustomId(constructCustomId<CustomIdArgs>(command.data.name, user.id, ['cancel', customId.args[1]]))
						.setLabel('Cancel')
						.setStyle(ButtonStyle.Secondary))],
			}, 'update', interaction.message.id);
			return;
		}

		if (interaction.isButton() && (customId.args[0] === 'confirm' || customId.args[0] === 'cancel')) {

			const groupId = customId.args[1];
			if (customId.args[0] === 'confirm') {

				await Group.destroy({ where: { id: groupId } });
			}

			// This is always an update to the message with the select menu
			await respond(interaction, await getGroupMessage(0, user, userToServer, quid, quidToServer, customId.args[0] === 'confirm' ? undefined : groupId), 'update', interaction.message.id);
			return;
		}

		if (interaction.isButton() && customId.args[0] === 'tag') {

			const groupId = customId.args[1];
			const group = await Group.findByPk(groupId, { rejectOnEmpty: true });

			await interaction
				.showModal(new ModalBuilder()
					.setCustomId(constructCustomId<CustomIdArgs>(command.data.name, user.id, customId.args))
					.setTitle('Set group tag')
					.addComponents(
						new ActionRowBuilder<TextInputBuilder>()
							.setComponents([new TextInputBuilder()
								.setCustomId('tag')
								.setLabel('Tag')
								.setStyle(TextInputStyle.Short)
								.setMinLength(0)
								.setMaxLength(16)
								.setRequired(false)
								.setValue((userToServer ? await GroupToServer.findOne({ where: { groupId: group.id, serverId: userToServer.serverId } }) : null)?.tag || group.tag || ''),
							]),
					),
				);
			return;
		}

		if (!hasName(quid)) { return; }

		if (interaction.isButton() && customId.args[0] === 'join') {

			const groupId = customId.args[1];
			const group = await Group.findByPk(groupId, { rejectOnEmpty: true });

			const hasMainGroup = quid.mainGroupId !== null;
			if (!hasMainGroup) { await quid.update({ mainGroupId: groupId }); }
			await GroupToQuid.create({ id: generateId(), quidId: quid.id, groupId: groupId });

			// This is always an update to the message with the select menu
			await respond(interaction, await getGroupMessage(0, user, userToServer, quid, quidToServer, groupId), 'update', interaction.message.id);

			// This is always a followUp
			await respond(interaction, {
				embeds: [new EmbedBuilder()
					.setColor(quid.color)
					.setAuthor({
						name: await getDisplayname(quid, { serverId: interaction?.guildId ?? undefined, userToServer, quidToServer, user }),
						iconURL: quid.avatarURL,
					})
					.setTitle(`${quid.name} joined the group ${group.name}!`)
					.setDescription(!hasMainGroup ? 'This is now this quids main group. The main group determines which groups tag is going to displayed. If your quid has an individual tag, it will overwrite the group tag. To change the quids main group, just select another group from the command and click "Make this the main group".' : null)],
				ephemeral: true,
			});
			return;
		}

		if (interaction.isButton() && customId.args[0] === 'leave') {

			const groupId = customId.args[1];
			const group = await Group.findByPk(groupId, { rejectOnEmpty: true });

			await GroupToQuid.destroy({ where: { groupId: groupId, quidId: quid.id } });

			const isMainGroup = quid.mainGroupId === groupId;
			if (isMainGroup) {

				const randomGroupToQuid = await GroupToQuid.findOne({ where: { quidId: quid.id } });
				await quid.update({ mainGroupId: randomGroupToQuid?.groupId ?? null });
			}
			const mainGroup = quid.mainGroupId === null ? null : await Group.findByPk(quid.mainGroupId, { rejectOnEmpty: true });

			// This is always an update to the message with the select menu
			await respond(interaction, await getGroupMessage(0, user, userToServer, quid, quidToServer, groupId), 'update', interaction.message.id);

			// This is always a followUp
			await respond(interaction, {
				embeds: [new EmbedBuilder()
					.setColor(quid.color)
					.setAuthor({
						name: await getDisplayname(quid, { serverId: interaction?.guildId ?? undefined, userToServer, quidToServer, user }),
						iconURL: quid.avatarURL,
					})
					.setTitle(`${quid.name} left the group ${group.name}!`)
					.setDescription((isMainGroup && mainGroup !== null) ? `This was this quids main group, so the main group has been changed to ${mainGroup.name}. The main group determines which groups tag is going to displayed. If your quid has an individual tag, it will overwrite the group tag. To change the quids main group, just select another group from the command and click "Make this the main group".` : null)],
				ephemeral: true,
			});
			return;
		}

		if (interaction.isButton() && customId.args[0] === 'maingroup') {

			const groupId = customId.args[1];
			const group = await Group.findByPk(groupId, { rejectOnEmpty: true });

			await quid.update({ mainGroupId: groupId });

			// This is always an update to the message with the select menu
			await respond(interaction, await getGroupMessage(0, user, userToServer, quid, quidToServer, groupId), 'update', interaction.message.id);

			// This is always a followUp
			await respond(interaction, {
				embeds: [new EmbedBuilder()
					.setColor(quid.color)
					.setAuthor({
						name: await getDisplayname(quid, { serverId: interaction?.guildId ?? undefined, userToServer, quidToServer, user }),
						iconURL: quid.avatarURL,
					})
					.setTitle(`${group.name} is now the main group for ${quid.name}!`)
					.setDescription('The main group determines which groups tag is going to displayed. If your quid has an individual tag, it will overwrite the group tag.')],
				ephemeral: true,
			});
			return;
		}
	},
	async sendModalResponse(interaction, { user, quid, userToServer, quidToServer }) {

		if (!user || !interaction.isFromMessage()) { return; }

		const customId = deconstructCustomId<CustomIdArgs>(interaction.customId);
		if (customId === null) { return; }

		if (customId.args[0] === 'create') {

			const name = interaction.fields.getTextInputValue('name');
			const groupId = await createId();

			await Group.create({ id: groupId, name: name, tag: '', userId: user.id });

			// This is always an update to the message with the select menu
			await respond(interaction, await getGroupMessage(0, user, userToServer, quid, quidToServer, groupId), 'update', interaction.message.id);
			return;
		}

		if (customId.args[0] === 'rename') {

			const name = interaction.fields.getTextInputValue('name');
			const groupId = customId.args[1];

			const group = await Group.findByPk(groupId, { rejectOnEmpty: true });
			await group.update({ name: name });

			// This is always an update to the message with the select menu
			await respond(interaction, await getGroupMessage(0, user, userToServer, quid, quidToServer, groupId), 'update', interaction.message.id);
			return;
		}

		if (customId.args[0] === 'tag') {

			const tag = interaction.fields.getTextInputValue('tag');
			const groupId = customId.args[1];

			if (interaction.inGuild()) {

				const groupToServer = await GroupToServer.findOne({ where: { groupId: groupId, serverId: interaction.guildId } });
				if (!groupToServer) { await GroupToServer.create({ id: generateId(), groupId: groupId, serverId: interaction.guildId, tag: tag }); }
				else { await groupToServer.update({ tag: tag }); }
			}
			else {

				const group = await Group.findByPk(groupId, { rejectOnEmpty: true });
				await group.update({ tag: tag });
			}

			// This is always an update to the message with the select menu
			await respond(interaction, await getGroupMessage(0, user, userToServer, quid, quidToServer, groupId), 'update', interaction.message.id);

			// This is always a followUp
			await respond(interaction, {
				embeds: [new EmbedBuilder()
					.setColor(quid?.color ?? default_color)
					.setAuthor(!quid ? null : {
						name: await getDisplayname(quid, { serverId: interaction?.guildId ?? undefined, userToServer, quidToServer, user }),
						iconURL: quid.avatarURL,
					})
					.setTitle(`Tag ${tag ? `set to ${tag}` : 'removed'} ${interaction.inGuild() ? `in ${interaction.guild?.name}!` : 'globally!'}`)
					.setDescription(interaction.inGuild() ? 'Tip: Tags can be set globally (cross-server) too by executing the /group command in DMs. The global tag will be displayed when no server-specific tag has been chosen.' : 'Tip: Tags can be set server-specific too by executing the command in the server. The server-specific tag will overwrite the global tag for that server.' + ' You can remove the tag again by leaving the text box empty.')],
				ephemeral: true,
			});
			return;
		}
	},
};

/**
 * It gets the main group of the user, and if it exists, it creates an embed with the group's name, tag, and members
 * @param userData - UserData<never, ''>
 * @returns A function that returns an object with a content property and an embeds property.
 */
export async function getGroupMessage(
	page: number,
	user: User,
	userToServer?: UserToServer,
	quid?: Quid,
	quidToServer?: QuidToServer,
	groupId?: string,
): Promise<InteractionReplyOptions> {

	const groups = await Group.findAll({ where: { userId: user.id } });
	const currentGroup = groups.find(g => g.id === (groupId ?? quid?.mainGroupId ?? ''));

	let groupOptions: RestOrArray<SelectMenuComponentOptionData> = groups.map(group => ({
		label: group.name,
		value: constructSelectOptions<SelectOptionArgs>(['switchto', group.id]),
		default: currentGroup?.id === group.id ? true : false,
	}));

	groupOptions.push({
		label: 'Empty Slot',
		value: constructSelectOptions<SelectOptionArgs>(['switchto', '']),
		default: currentGroup === undefined ? true : false,
	});

	if (groupOptions.length > 25) {

		const pageCount = Math.ceil(groupOptions.length / 24);
		page = page % pageCount;
		if (page < 0) { page += pageCount; }

		groupOptions = groupOptions.splice(page * 24, 24);
		groupOptions.push({
			label: 'Show more groups',
			value: constructSelectOptions<SelectOptionArgs>(['nextpage', currentGroup?.id ?? '']),
			description: `You are currently on page ${page + 1}`,
			emoji: '📋',
		});
	}

	const quidInGroup = (currentGroup === undefined || quid === undefined) ? false : !!(await GroupToQuid.findOne({ where: { groupId: currentGroup.id, quidId: quid.id } }));

	return {
		content: currentGroup === undefined ? 'You are on an Empty Slot. Select a group to view below.' : '',
		embeds: currentGroup === undefined ? [] : [new EmbedBuilder()
			.setColor(quid?.color ?? default_color)
			.setAuthor(!quid ? null : {
				name: await getDisplayname(quid, { serverId: userToServer?.serverId ?? undefined, userToServer, quidToServer, user }),
				iconURL: quid.avatarURL,
			})
			.setTitle(currentGroup.name)
			.setFields([
				{ name: '**🏷️ Tag**', value: (userToServer ? await GroupToServer.findOne({ where: { groupId: currentGroup.id, serverId: userToServer.serverId } }) : null)?.tag || currentGroup.tag || '/' },
				{
					name: '**☂️ Members**',
					value: (await GroupToQuid.findAll({ where: { groupId: currentGroup.id }, include: [{ model: Quid, as: 'quid' }] }))
						.map(g => `${g.quid.name}${(g.quid.proxy_endsWith !== '' || g.quid.proxy_startsWith !== '') ? ` (\`${g.quid.proxy_startsWith}text${g.quid.proxy_endsWith}\`)` : ''}`)
						.join('\n') || 'No members',
				},
			])
			.setFooter({ text: `Group ID: ${currentGroup.id}` })],
		components: [
			new ActionRowBuilder<StringSelectMenuBuilder>()
				.setComponents(new StringSelectMenuBuilder()
					.setCustomId(constructCustomId<CustomIdArgs>(command.data.name, user.id, ['groupselect', `${page}`]))
					.setPlaceholder('Select a group to view/edit')
					.setOptions(groupOptions)),
			new ActionRowBuilder<ButtonBuilder>()
				.setComponents(currentGroup === undefined ?
					[new ButtonBuilder()
						.setCustomId(constructCustomId<CustomIdArgs>(command.data.name, user.id, ['create']))
						.setLabel('Create new group')
						.setStyle(ButtonStyle.Success)]
					: [new ButtonBuilder()
						.setCustomId(constructCustomId<CustomIdArgs>(command.data.name, user.id, ['rename', currentGroup.id]))
						.setLabel('Rename group')
						.setStyle(ButtonStyle.Secondary),
					new ButtonBuilder()
						.setCustomId(constructCustomId<CustomIdArgs>(command.data.name, user.id, ['delete', currentGroup.id]))
						.setLabel('Delete group')
						.setStyle(ButtonStyle.Secondary),
					new ButtonBuilder()
						.setCustomId(constructCustomId<CustomIdArgs>(command.data.name, user.id, ['tag', currentGroup.id]))
						.setLabel('Set group tag')
						.setStyle(ButtonStyle.Secondary)]),
			...(currentGroup === undefined || quid === undefined) ? [] : [new ActionRowBuilder<ButtonBuilder>()
				.setComponents([new ButtonBuilder()
					.setCustomId(constructCustomId<CustomIdArgs>(command.data.name, user.id, [!quidInGroup ? 'join' : 'leave', currentGroup.id]))
					.setLabel(`${!quidInGroup ? 'Join' : 'Leave'} group`)
					.setStyle(ButtonStyle.Primary),
				...(currentGroup.id === quid.mainGroupId || !quidInGroup) ? [] : [new ButtonBuilder()
					.setCustomId(constructCustomId<CustomIdArgs>(command.data.name, user.id, ['maingroup', currentGroup.id]))
					.setLabel('Make this the main group')
					.setStyle(ButtonStyle.Secondary),
				]])],
		],
	};
}